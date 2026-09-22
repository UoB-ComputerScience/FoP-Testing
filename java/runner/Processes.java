package runner;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.TimeUnit;

/** Bounded process execution. This is process separation, not an OS security sandbox. */
final class Processes {
    record Outcome(int exitCode, boolean timedOut, String output, boolean truncated, List<Long> survivingProcesses) {}
    static final int OUTPUT_LIMIT = 64 * 1024;

    static Outcome run(List<String> command, Path directory, int seconds) throws IOException, InterruptedException {
        var builder = new ProcessBuilder(command).directory(directory.toFile()).redirectErrorStream(true);
        for (String key : List.of("CLASSPATH", "JAVA_TOOL_OPTIONS", "_JAVA_OPTIONS", "JDK_JAVA_OPTIONS")) builder.environment().remove(key);
        Process process = builder.start();
        process.getOutputStream().close();
        ByteArrayOutputStream kept = new ByteArrayOutputStream();
        boolean[] truncated = {false};
        Thread drain = new Thread(() -> {
            try (var input = process.getInputStream()) {
                byte[] buffer = new byte[8192];
                for (int count; (count = input.read(buffer)) >= 0;) {
                    int retain = Math.min(count, OUTPUT_LIMIT - kept.size());
                    if (retain > 0) kept.write(buffer, 0, retain);
                    if (retain < count) truncated[0] = true;
                }
            } catch (IOException ignored) { /* Pipe can close when the process is terminated. */ }
        }, "bounded-process-output");
        drain.setDaemon(true);
        drain.start();
        Map<Long,ProcessHandle> children = new LinkedHashMap<>();
        boolean finished = false;
        try {
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(seconds);
            do {
                rememberChildren(process, children);
                if (process.waitFor(20, TimeUnit.MILLISECONDS)) { finished = true; break; }
            } while (System.nanoTime() < deadline);
        } finally {
            rememberChildren(process, children);
            if (process.isAlive()) process.destroyForcibly();
            // Remember handles while the parent is alive, since children can be orphaned on exit.
            // This is best-effort cleanup, not containment of deliberately hostile programs.
            for (ProcessHandle child : children.values()) {
                try { if (child.isAlive()) child.destroyForcibly(); } catch (RuntimeException ignored) {}
            }
            process.waitFor(3, TimeUnit.SECONDS);
            long cleanupDeadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(1);
            while (children.values().stream().anyMatch(ProcessHandle::isAlive) && System.nanoTime() < cleanupDeadline)
                Thread.sleep(20);
        }
        drain.join(1000);
        if (drain.isAlive()) { process.getInputStream().close(); drain.join(1000); }
        List<Long> survivors = new ArrayList<>();
        if (process.isAlive()) survivors.add(process.pid());
        children.values().stream().filter(ProcessHandle::isAlive).map(ProcessHandle::pid).forEach(survivors::add);
        return new Outcome(process.isAlive() ? -1 : process.exitValue(), !finished,
                kept.toString(StandardCharsets.UTF_8), truncated[0], List.copyOf(survivors));
    }

    private static void rememberChildren(Process process, Map<Long,ProcessHandle> children) {
        try (var descendants = process.descendants()) {
            descendants.forEach(child -> children.putIfAbsent(child.pid(), child));
        } catch (RuntimeException ignored) { /* The process may already have exited. */ }
    }
}
