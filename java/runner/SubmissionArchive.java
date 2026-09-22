package runner;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.Charset;
import java.nio.file.DirectoryStream;
import java.nio.file.FileAlreadyExistsException;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.zip.CRC32;
import java.util.zip.ZipEntry;
import java.util.zip.ZipException;
import java.util.zip.ZipFile;

/** Reads submission files only; it never invokes source code or build scripts. */
public final class SubmissionArchive {
    private static final long MAX_ARCHIVE_BYTES = 25L * 1024 * 1024;
    private static final long MAX_ENTRY_BYTES = 10L * 1024 * 1024;
    private static final long MAX_EXPANDED_BYTES = 100L * 1024 * 1024;
    private static final int MAX_ENTRIES = 4000;
    private static final int BUFFER_BYTES = 64 * 1024;
    private static final Charset LEGACY_ZIP_CHARSET = Charset.forName("CP437");

    private SubmissionArchive() { }

    public record Extracted(List<String> files, long expandedBytes, String sha256) {
        public Extracted {
            files = List.copyOf(files);
        }
    }

    private record PlannedEntry(ZipEntry entry, String name, Path target,
                                boolean directory, long size, long crc) { }

    /**
     * Unpacks a trusted host snapshot into an existing, empty, private directory.
     * The caller must not change either path while this method runs. No links are
     * followed or created. ZipFile does not expose Unix link attributes, so an
     * archive entry containing a link target is copied as an ordinary data file.
     * On failure, the caller remains responsible for its temporary directory;
     * this method never deletes files or overwrites an existing file.
     */
    public static Extracted unpack(Path archive, Path destination) throws IOException {
        Path input = archive.toAbsolutePath().normalize();
        Path root = destination.toAbsolutePath().normalize();
        verifyDirectoryChain(root);
        try (DirectoryStream<Path> contents = Files.newDirectoryStream(root)) {
            if (contents.iterator().hasNext()) {
                throw new IOException("The ZIP extraction directory must be empty.");
            }
        }
        verifyDirectoryChain(input.getParent());
        BasicFileAttributes attributes = Files.readAttributes(
                input, BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS);
        if (!attributes.isRegularFile() || attributes.isSymbolicLink() || attributes.isOther()) {
            throw new IOException("The selected ZIP must be a regular file, not a filesystem link.");
        }
        long archiveSize = attributes.size();
        if (archiveSize > MAX_ARCHIVE_BYTES) {
            throw new IOException("The ZIP exceeds the 25 MiB archive limit.");
        }
        String hash = hashArchive(input, archiveSize);

        // CP437 covers traditional ZIP names; the ZIP UTF-8 flag takes precedence.
        try (ZipFile zip = new ZipFile(input.toFile(), ZipFile.OPEN_READ, LEGACY_ZIP_CHARSET)) {
            List<PlannedEntry> planned = inspectMetadata(zip, root, archiveSize);
            List<String> files = new ArrayList<>();
            long expandedBytes = 0;
            byte[] buffer = new byte[BUFFER_BYTES];
            for (PlannedEntry item : planned) {
                if (item.directory()) {
                    createDirectoriesWithoutLinks(root, item.target());
                } else {
                    createDirectoriesWithoutLinks(root, item.target().getParent());
                }
                CRC32 checksum = new CRC32();
                long bytes = 0;
                try (InputStream source = zip.getInputStream(item.entry());
                     OutputStream sink = item.directory() ? OutputStream.nullOutputStream()
                             : new BufferedOutputStream(Files.newOutputStream(item.target(),
                                     StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE,
                                     LinkOption.NOFOLLOW_LINKS), BUFFER_BYTES)) {
                    if (source == null) {
                        throw new IOException("The ZIP entry could not be read: " + item.name());
                    }
                    int count;
                    while ((count = source.read(buffer)) != -1) {
                        if (count == 0) {
                            continue;
                        }
                        bytes += count;
                        expandedBytes += count;
                        if (bytes > MAX_ENTRY_BYTES || expandedBytes > MAX_EXPANDED_BYTES) {
                            throw new IOException("The actual expanded ZIP data exceeds the checking limits: "
                                    + item.name());
                        }
                        if (bytes > item.size()) {
                            throw new IOException("A ZIP entry exceeds its advertised expanded size: "
                                    + item.name());
                        }
                        checksum.update(buffer, 0, count);
                        sink.write(buffer, 0, count);
                    }
                }
                if (bytes != item.size()) {
                    throw new IOException("A ZIP entry does not match its advertised expanded size: "
                            + item.name());
                }
                if (checksum.getValue() != item.crc()) {
                    throw new IOException("A ZIP entry failed its CRC integrity check: " + item.name());
                }
                if (!item.directory()) {
                    files.add(item.name());
                }
            }
            files.sort(Comparator.naturalOrder());
            return new Extracted(files, expandedBytes, hash);
        } catch (ZipException exception) {
            String detail = exception.getMessage();
            if (detail != null && detail.toLowerCase(Locale.ROOT).contains("encrypt")) {
                throw new IOException("Password-protected ZIPs are not supported. Export an unencrypted ZIP.",
                        exception);
            }
            throw new IOException("The ZIP is corrupt or uses an unsupported ZIP format. Export a fresh ZIP.",
                    exception);
        } catch (IllegalArgumentException exception) {
            throw new IOException("The ZIP contains an invalid or unsupported filename or entry.", exception);
        }
    }

    /** Completes all central-directory path, type, size and collision checks before writing. */
    private static List<PlannedEntry> inspectMetadata(ZipFile zip, Path root, long archiveSize)
            throws IOException {
        if (zip.size() > MAX_ENTRIES) {
            throw new IOException("The ZIP exceeds the 4,000-entry limit.");
        }
        List<PlannedEntry> planned = new ArrayList<>();
        Map<String, PlannedEntry> entriesByKey = new HashMap<>();
        Map<String, String> componentSpellings = new HashMap<>();
        long advertisedTotal = 0;
        Enumeration<? extends ZipEntry> entries = zip.entries();
        while (entries.hasMoreElements()) {
            ZipEntry entry = entries.nextElement();
            if (planned.size() >= MAX_ENTRIES) {
                throw new IOException("The ZIP exceeds the 4,000-entry limit.");
            }
            String normalised = validateName(entry.getName());
            boolean directory = normalised.endsWith("/");
            String name = directory ? normalised.substring(0, normalised.length() - 1) : normalised;
            Path target;
            try {
                target = root.resolve(name).normalize();
            } catch (InvalidPathException exception) {
                throw new IOException("A ZIP path is not supported on this computer: " + name, exception);
            }
            if (target.equals(root) || !target.startsWith(root)) {
                throw new IOException("A ZIP path escapes the extraction directory: " + name);
            }
            if (entry.getMethod() != ZipEntry.STORED && entry.getMethod() != ZipEntry.DEFLATED) {
                throw new IOException("A ZIP entry uses unsupported compression: " + name);
            }
            long size = entry.getSize();
            long compressedSize = entry.getCompressedSize();
            long crc = entry.getCrc();
            if (size < 0 || compressedSize < 0 || compressedSize > archiveSize
                    || crc < 0 || crc > 0xffffffffL) {
                throw new IOException("A ZIP entry has missing or invalid size/checksum metadata: " + name);
            }
            if (size > MAX_ENTRY_BYTES) {
                throw new IOException("A ZIP entry exceeds the 10 MiB expanded-file limit: " + name);
            }
            advertisedTotal += size;
            if (advertisedTotal > MAX_EXPANDED_BYTES) {
                throw new IOException("The ZIP exceeds the 100 MiB expanded-data limit.");
            }
            PlannedEntry item = new PlannedEntry(entry, name, target, directory, size, crc);
            PlannedEntry previous = entriesByKey.putIfAbsent(pathKey(name), item);
            if (previous != null) {
                throw new IOException("The ZIP contains duplicate or case/Unicode-colliding paths: "
                        + previous.name() + " and " + name);
            }
            // Include implicit parent directories so their spellings cannot differ across platforms.
            String prefix = "";
            for (String component : name.split("/")) {
                prefix = prefix.isEmpty() ? component : prefix + "/" + component;
                String prior = componentSpellings.putIfAbsent(pathKey(prefix), prefix);
                if (prior != null && !prior.equals(prefix)) {
                    throw new IOException("The ZIP contains case/Unicode-colliding directory or file paths: "
                            + prior + " and " + prefix);
                }
            }
            planned.add(item);
        }
        for (PlannedEntry item : planned) {
            int slash = item.name().indexOf('/');
            while (slash >= 0) {
                String parent = item.name().substring(0, slash);
                PlannedEntry parentEntry = entriesByKey.get(pathKey(parent));
                if (parentEntry != null && !parentEntry.directory()) {
                    throw new IOException("A ZIP file is also used as a parent directory: " + parent);
                }
                slash = item.name().indexOf('/', slash + 1);
            }
        }
        return planned;
    }

    private static String validateName(String original) throws IOException {
        if (original == null || original.isEmpty()) {
            throw new IOException("The ZIP contains an empty path.");
        }
        String name = original.replace('\\', '/');
        for (int index = 0; index < name.length(); index++) {
            if (Character.isISOControl(name.charAt(index))) {
                throw new IOException("The ZIP contains a path with a control character.");
            }
        }
        if (name.startsWith("/") || name.matches("^[A-Za-z]:.*") || name.contains("//")) {
            throw new IOException("The ZIP contains an absolute or ambiguous path: " + original);
        }
        String path = name.endsWith("/") ? name.substring(0, name.length() - 1) : name;
        for (String component : path.split("/", -1)) {
            if (component.isEmpty() || component.equals(".") || component.equals("..")) {
                throw new IOException("The ZIP contains an unsafe relative path: " + original);
            }
            // Reject alternate data streams, device names and Windows-normalised collisions.
            if (component.matches(".*[<>:\"|?*].*") || component.endsWith(".")
                    || component.endsWith(" ") || isReservedName(component)) {
                throw new IOException("The ZIP contains a filename that cannot be extracted portably: "
                        + original);
            }
        }
        return name;
    }

    private static boolean isReservedName(String component) {
        String stem = component.split("\\.", 2)[0].stripTrailing().toUpperCase(Locale.ROOT);
        return stem.equals("CON") || stem.equals("PRN") || stem.equals("AUX") || stem.equals("NUL")
                || stem.equals("CONIN$") || stem.equals("CONOUT$")
                || stem.matches("(?:COM|LPT)[1-9\u00b9\u00b2\u00b3]");
    }

    private static String pathKey(String path) {
        return Normalizer.normalize(path, Normalizer.Form.NFC).toLowerCase(Locale.ROOT);
    }

    private static void verifyDirectoryChain(Path directory) throws IOException {
        for (Path current = directory; current != null; current = current.getParent()) {
            BasicFileAttributes attributes = Files.readAttributes(
                    current, BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS);
            if (!attributes.isDirectory() || attributes.isSymbolicLink() || attributes.isOther()) {
                throw new IOException("The extraction and ZIP paths must not pass through filesystem links.");
            }
        }
    }

    private static void createDirectoriesWithoutLinks(Path root, Path directory) throws IOException {
        if (!directory.startsWith(root)) {
            throw new IOException("A ZIP directory escapes the extraction directory.");
        }
        verifyDirectoryChain(root);
        Path current = root;
        for (Path component : root.relativize(directory)) {
            if (component.toString().isEmpty()) {
                continue;
            }
            current = current.resolve(component);
            try {
                Files.createDirectory(current);
            } catch (FileAlreadyExistsException alreadyExists) {
                // An earlier entry may have created this legitimate parent directory.
            }
            BasicFileAttributes attributes = Files.readAttributes(
                    current, BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS);
            if (!attributes.isDirectory() || attributes.isSymbolicLink() || attributes.isOther()) {
                throw new IOException("A ZIP parent path is not an ordinary directory.");
            }
        }
    }

    private static String hashArchive(Path archive, long expectedSize) throws IOException {
        MessageDigest digest;
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException exception) {
            throw new IOException("This Java runtime does not support SHA-256.", exception);
        }
        byte[] buffer = new byte[BUFFER_BYTES];
        long bytes = 0;
        try (InputStream source = new BufferedInputStream(Files.newInputStream(
                archive, StandardOpenOption.READ, LinkOption.NOFOLLOW_LINKS), BUFFER_BYTES)) {
            int count;
            while ((count = source.read(buffer)) != -1) {
                bytes += count;
                if (bytes > MAX_ARCHIVE_BYTES) {
                    throw new IOException("The ZIP exceeds the 25 MiB archive limit.");
                }
                digest.update(buffer, 0, count);
            }
        }
        if (bytes != expectedSize || Files.size(archive) != expectedSize) {
            throw new IOException("The ZIP changed while it was being read. Check a fresh snapshot.");
        }
        return HexFormat.of().formatHex(digest.digest());
    }
}
