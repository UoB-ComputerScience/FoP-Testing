package runner;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.*;
import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;

/** Local evidence runner. Submitted code runs under the caller's account, not in a security sandbox. */
public final class Main {
    public static final String VERSION = "0.1";
    private static final long MAX_ZIP = 25L * 1024 * 1024;

    public static void main(String[] args) {
        try { System.exit(run(options(args))); }
        catch (IllegalArgumentException error) { System.err.println(error.getMessage()); System.err.println("Use --help for options."); System.exit(2); }
        catch (Exception error) { System.err.println("Runner error: " + error); System.exit(2); }
    }

    private static Map<String,String> options(String[] args) {
        var result = new LinkedHashMap<String,String>();
        Set<String> flags = Set.of("--help", "--list", "--compile-only", "--keep-work");
        Set<String> values = Set.of("--zip", "--coursework", "--select", "--jdk", "--release", "--project", "--timeout", "--output");
        for (int i = 0; i < args.length; i++) {
            String key = args[i];
            if (result.containsKey(key)) throw new IllegalArgumentException("Repeated option: " + key);
            if (flags.contains(key)) result.put(key, "true");
            else if (values.contains(key) && i + 1 < args.length) result.put(key, args[++i]);
            else throw new IllegalArgumentException("Unknown option or missing value: " + key);
        }
        return result;
    }

    private static void help() {
        System.out.println("""
                Local coursework checker (Java + JUnit 4.13.2)
                From the repository folder:
                  java java/Run.java --list
                  java java/Run.java --zip PATH --coursework fop-2025-26 --select task1,task2
                  java java/Run.java --zip PATH --select task2.up --output REPORT.json

                --select       all, task group, test ID, method name, class, or Class#method; comma-separated
                --jdk PATH     full JDK to compile/run submissions (default: the launcher's JDK)
                --release N    explicit compiler target override (default: coursework profile target)
                --project PATH select a project folder inside a ZIP with multiple projects
                --timeout N    seconds per selected test, 1-60 (default: 5); compilation limit: 30 seconds
                --compile-only compile without executing coursework code
                --output PATH  new JSON evidence report; existing files are never overwritten
                --keep-work    keep the private temporary extraction/classes for investigation
                --junit PATH / --hamcrest PATH are dependency options handled by Run.java

                No build scripts from submissions are run; submitted class files are ignored.
                Results concern isolated early methods, not complete gameplay or marks.
                This local prototype executes code with your account's permissions. Use trusted
                examples or run it inside a disposable isolated environment. It is not a public upload service.
                Private working files and default reports go to temporary storage, never the repository.
                Exit codes: 0=selected checks passed, 1=compilation/test failure, 2=blocked/runner problem.
                """);
    }

    private static int run(Map<String,String> args) throws Exception {
        if (args.isEmpty() || args.containsKey("--help")) { help(); return 0; }
        if (args.containsKey("--list")) {
            for (Coursework profile : Coursework.available()) {
                System.out.println(profile.id() + " (profile " + profile.version() + ", Java " + profile.javaRelease() + ")");
                for (var check : profile.checks()) System.out.println("  " + check.id() + " [" + check.group() + "] " + check.description());
            }
            return 0;
        }
        Coursework profile = Coursework.find(args.getOrDefault("--coursework", "fop-2025-26"));
        List<Coursework.Check> selected = profile.select(args.getOrDefault("--select", "all"));
        if (!args.containsKey("--zip")) throw new IllegalArgumentException("Supply --zip PATH.");
        Path archive = Path.of(args.get("--zip")).toAbsolutePath().normalize();
        if (!Files.isRegularFile(archive)) throw new IllegalArgumentException("ZIP not found: " + archive);
        int release = integer(args, "--release", profile.javaRelease(), 17, 99);
        int seconds = integer(args, "--timeout", 5, 1, 60);
        Path jdk = Path.of(args.getOrDefault("--jdk", System.getProperty("java.home"))).toAbsolutePath().normalize();
        Path java = executable(jdk, "java"), javac = executable(jdk, "javac");
        Path output = args.containsKey("--output") ? Path.of(args.get("--output")).toAbsolutePath().normalize() : null;
        if (output != null && (Files.exists(output) || !Files.isDirectory(output.getParent())))
            throw new IllegalArgumentException("Choose a new report filename in an existing folder: " + output);

        var report = new LinkedHashMap<String,Object>();
        var stages = new ArrayList<Map<String,Object>>();
        var results = new ArrayList<Map<String,Object>>();
        var notes = new ArrayList<String>();
        report.put("runner_version", VERSION);
        report.put("timestamp_utc", Instant.now().toString());
        report.put("archive_name", archive.getFileName().toString());
        report.put("coursework", profile.id()); report.put("profile_version", profile.version());
        report.put("evidence_scope", profile.evidenceScope());
        report.put("required_java", profile.javaRelease()); report.put("compiler_release", release);
        report.put("selected_tests", selected.stream().map(Coursework.Check::id).toList());
        report.put("execution_isolation", "Separate JVM per test, heap cap and external timeout; no OS security sandbox.");
        report.put("notes", notes); report.put("stages", stages); report.put("tests", results);
        notes.add("No marks are assigned. A failed early method does not prove that the final keyboard/gameplay path fails.");
        notes.add("Cleanup of observed child processes is best effort. An OS sandbox is required for untrusted uploads.");
        if (release != profile.javaRelease()) notes.add("Compiler target explicitly overridden; the test contract is still " + profile.id() + ".");
        Path work = Files.createTempDirectory("coursework-run-").toAbsolutePath().normalize();
        int exit = 2;
        try {
            var runtime = Processes.run(List.of(java.toString(), "-version"), work, 10);
            var compiler = Processes.run(List.of(javac.toString(), "-version"), work, 10);
            report.put("runtime", runtime.output().strip()); report.put("compiler", compiler.output().strip());
            if (runtime.timedOut() || compiler.timedOut() || runtime.exitCode() != 0 || compiler.exitCode() != 0
                    || !runtime.survivingProcesses().isEmpty() || !compiler.survivingProcesses().isEmpty())
                throw new IOException("The selected Java toolchain could not be started.");
            var compilerFeature = Pattern.compile("javac ([0-9]+)").matcher(compiler.output());
            var runtimeFeature = Pattern.compile("version [^0-9]*([0-9]+)").matcher(runtime.output());
            if (!compilerFeature.find() || !runtimeFeature.find()) throw new IOException("Could not identify the selected Java toolchain versions.");
            int compilerMajor = Integer.parseInt(compilerFeature.group(1));
            int runtimeMajor = Integer.parseInt(runtimeFeature.group(1));
            if (compilerMajor < release || runtimeMajor < release)
                throw new IOException("Selected JDK cannot compile/run Java " + release + "; this is a toolchain setup problem, not a submission failure.");
            if (compilerMajor != profile.javaRelease() || runtimeMajor != profile.javaRelease())
                notes.add("Actual JDK differs from the profile's required JDK. --release restricts compilation, but this is not an exact target-runtime verification.");

            Path snapshot = work.resolve("submission.zip");
            report.put("archive_sha256", snapshot(archive, snapshot));
            Path extracted = Files.createDirectory(work.resolve("submission"));
            SubmissionArchive.Extracted inventory = SubmissionArchive.unpack(snapshot, extracted);
            report.put("files", inventory.files()); report.put("expanded_bytes", inventory.expandedBytes());
            stages.add(stage("archive", "passed", "Archive paths, expanded sizes and CRC checks passed."));
            Path project = project(extracted, inventory.files(), profile, args.get("--project"));
            report.put("project_path", extracted.relativize(project).toString().replace('\\', '/'));
            Path sources = project.resolve(profile.sourceDirectory());
            List<Path> sourceFiles;
            try (var paths = Files.walk(sources)) { sourceFiles = paths.filter(Files::isRegularFile).filter(p -> p.toString().endsWith(".java")).sorted().toList(); }
            if (sourceFiles.isEmpty()) throw new IOException("No Java source files found in the selected source folder.");
            Path classes = Files.createDirectory(work.resolve("classes"));
            Path argumentFile = work.resolve("sources.args");
            Files.write(argumentFile, sourceFiles.stream().map(Main::javacArgument).toList(), StandardCharsets.UTF_8);
            var compile = Processes.run(List.of(javac.toString(), "-J-Xmx256m", "-proc:none", "-implicit:none",
                    "-encoding", "UTF-8", "--release", String.valueOf(release), "-classpath", classes.toString(),
                    "-sourcepath", sources.toString(), "-d", classes.toString(), "@" + argumentFile), project, 30);
            var compileStage = stage("compilation", !compile.survivingProcesses().isEmpty() ? "blocked" : compile.timedOut() ? "timeout" : compile.exitCode() == 0 ? "passed" : "failed", compile.output());
            compileStage.put("output_truncated", compile.truncated()); stages.add(compileStage);
            if (!compile.survivingProcesses().isEmpty()) compileStage.put("surviving_processes", compile.survivingProcesses());
            if (compile.timedOut() || compile.exitCode() != 0 || !compile.survivingProcesses().isEmpty()) {
                addNotRun(results, selected, "Compilation did not complete successfully.");
                exit = compile.timedOut() || !compile.survivingProcesses().isEmpty() ? 2 : 1;
            } else if (args.containsKey("--compile-only")) {
                addNotRun(results, selected, "Compilation-only run requested."); exit = 0;
            } else {
                exit = 0;
                String classpath = System.getProperty("java.class.path") + File.pathSeparator + classes;
                for (int i = 0; i < selected.size(); i++) {
                    var check = selected.get(i);
                    Path evidence = work.resolve("test-" + i + ".properties");
                    var process = Processes.run(List.of(java.toString(), "-Xmx256m", "-XX:MaxMetaspaceSize=128m",
                            "-Djava.awt.headless=true", "-cp", classpath, "runner.TestProcess",
                            check.testClass(), check.method(), evidence.toString()), project, seconds);
                    var finding = testResult(check);
                    finding.put("output", process.output()); finding.put("output_truncated", process.truncated());
                    finding.put("exit_code", process.exitCode()); finding.put("timeout_seconds", seconds);
                    if (!process.survivingProcesses().isEmpty()) {
                        finding.put("status", "blocked"); finding.put("message", "Some observed processes could not be stopped; their process IDs are recorded.");
                        finding.put("surviving_processes", process.survivingProcesses()); exit = 2;
                    } else if (process.timedOut()) {
                        finding.put("status", "timeout"); finding.put("message", "The isolated test process exceeded its time limit."); exit = 2;
                    } else if (process.exitCode() != 0 || !Files.isRegularFile(evidence) || Files.size(evidence) > 128 * 1024) {
                        finding.put("status", "blocked"); finding.put("message", "The test process ended without a valid result; it may have exited or failed during setup."); exit = 2;
                    } else {
                        Properties properties = new Properties();
                        try (var input = Files.newBufferedReader(evidence, StandardCharsets.UTF_8)) { properties.load(input); }
                        String status = properties.getProperty("status", "runner_error");
                        if (!Set.of("passed", "failed", "error", "blocked", "runner_error").contains(status)) status = "runner_error";
                        finding.put("status", status);
                        for (String key : List.of("message", "exception", "trace", "junit_version", "details_truncated"))
                            if (properties.containsKey(key)) finding.put(key, properties.getProperty(key));
                        if (Set.of("blocked", "runner_error").contains(status)) exit = 2;
                        else if (!status.equals("passed") && exit == 0) exit = 1;
                    }
                    results.add(finding);
                    System.out.println(check.id() + ": " + finding.get("status") + " — " + finding.get("message"));
                }
            }
        } catch (Exception error) {
            stages.add(stage("runner", "blocked", error.toString()));
            addNotRun(results, selected, "The runner could not complete the remaining checks: " + error);
            exit = 2;
        } finally {
            if (args.containsKey("--keep-work")) report.put("retained_work_directory", work.toString());
            else {
                try (var paths = Files.walk(work)) {
                    for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
                } catch (IOException | UncheckedIOException error) {
                    notes.add("Some temporary work could not be deleted: " + work); report.put("retained_work_directory", work.toString());
                }
            }
            report.put("status", exit == 0 ? args.containsKey("--compile-only") ? "compiled_only" : "passed" : exit == 1 ? "failed" : "blocked");
            report.put("exit_code", exit);
            if (output == null) {
                output = Files.createTempFile("coursework-report-", ".json");
                Files.writeString(output, Json.write(report) + "\n", StandardCharsets.UTF_8);
            } else Files.writeString(output, Json.write(report) + "\n", StandardCharsets.UTF_8, StandardOpenOption.CREATE_NEW);
            System.out.println("Evidence report: " + output);
            System.out.println(profile.evidenceScope());
        }
        return exit;
    }

    private static int integer(Map<String,String> args, String key, int fallback, int minimum, int maximum) {
        int value;
        try { value = Integer.parseInt(args.getOrDefault(key, String.valueOf(fallback))); }
        catch (NumberFormatException error) { throw new IllegalArgumentException(key + " must be a whole number."); }
        if (value < minimum || value > maximum) throw new IllegalArgumentException(key + " must be between " + minimum + " and " + maximum);
        return value;
    }
    private static Path executable(Path jdk, String command) {
        Path result = jdk.resolve("bin").resolve(command + (System.getProperty("os.name").startsWith("Windows") ? ".exe" : ""));
        if (!Files.isRegularFile(result)) throw new IllegalArgumentException("Full JDK executable not found: " + result);
        return result;
    }
    private static String snapshot(Path input, Path output) throws Exception {
        if (Files.size(input) > MAX_ZIP) throw new IOException("Archive exceeds the 25 MiB checking limit.");
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (var in = Files.newInputStream(input); var out = Files.newOutputStream(output, StandardOpenOption.CREATE_NEW)) {
            byte[] buffer = new byte[8192]; long total = 0;
            for (int count; (count = in.read(buffer)) >= 0;) {
                total += count; if (total > MAX_ZIP) throw new IOException("Archive grew beyond the 25 MiB checking limit.");
                digest.update(buffer, 0, count); out.write(buffer, 0, count);
            }
        }
        return HexFormat.of().formatHex(digest.digest());
    }
    private static Path project(Path extracted, List<String> files, Coursework profile, String explicit) throws IOException {
        if (explicit != null) {
            Path result = extracted.resolve(explicit.replace('\\', '/')).normalize();
            if (!result.startsWith(extracted) || !Files.isDirectory(result.resolve(profile.sourceDirectory())))
                throw new IOException("The selected project must have a source folder inside the ZIP.");
            return result;
        }
        var roots = new LinkedHashSet<String>();
        for (String file : files) if (file.equals(profile.rootMarker()) || file.endsWith("/" + profile.rootMarker()))
            roots.add(file.substring(0, file.length() - profile.rootMarker().length()));
        if (roots.size() != 1) throw new IOException("Expected one matching coursework project, found " + roots.size() + ". Use --project for an explicit folder; no project was guessed.");
        return extracted.resolve(roots.iterator().next());
    }
    private static String javacArgument(Path path) {
        return "\"" + path.toString().replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }
    private static Map<String,Object> stage(String name, String status, String message) {
        var result = new LinkedHashMap<String,Object>(); result.put("stage", name); result.put("status", status); result.put("message", message); return result;
    }
    private static Map<String,Object> testResult(Coursework.Check check) {
        var result = new LinkedHashMap<String,Object>(); result.put("test_id", check.id()); result.put("task", check.group());
        result.put("method", check.method()); result.put("description", check.description()); result.put("evidence_type", "isolated_method"); return result;
    }
    private static void addNotRun(List<Map<String,Object>> results, List<Coursework.Check> selected, String reason) {
        for (var check : selected) {
            if (results.stream().anyMatch(r -> check.id().equals(r.get("test_id")))) continue;
            var result = testResult(check); result.put("status", "not_run"); result.put("message", reason); results.add(result);
        }
    }
}
