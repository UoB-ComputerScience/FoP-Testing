package runner;

import java.io.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.runner.*;
import org.junit.runner.notification.*;

/** Executes one trusted JUnit test in a fresh JVM, separate from the result collector. */
public final class TestProcess {
    public static void main(String[] args) throws Exception {
        Properties report = new Properties();
        List<String> assumptions = new ArrayList<>();
        try {
            Class<?> suite = Class.forName(args[0]);
            if (!suite.getMethod(args[1]).isAnnotationPresent(org.junit.Test.class))
                throw new IllegalArgumentException("The registered method is not a JUnit test: " + args[1]);
            var core = new JUnitCore();
            core.addListener(new RunListener() {
                @Override public void testAssumptionFailure(Failure failure) { assumptions.add(failure.getMessage()); }
            });
            Result result = core.run(Request.method(suite, args[1]));
            if (result.getFailures().stream().anyMatch(f -> "initializationError".equals(f.getDescription().getMethodName()))) {
                report.setProperty("status", "runner_error");
                report.setProperty("message", "JUnit could not initialise the selected test: " + result.getFailures().get(0).getMessage());
            } else if (!assumptions.isEmpty()) {
                report.setProperty("status", "blocked");
                report.setProperty("message", String.join("; ", assumptions));
            } else if (!result.getFailures().isEmpty()) {
                Failure failure = result.getFailures().get(0);
                Throwable error = failure.getException();
                boolean environment = causedBy(error, java.awt.HeadlessException.class);
                report.setProperty("status", environment ? "blocked" : error instanceof AssertionError ? "failed" : "error");
                report.setProperty("message", String.valueOf(failure.getMessage()));
                report.setProperty("exception", error.getClass().getName());
                report.setProperty("trace", failure.getTrace());
            } else if (result.getRunCount() != 1 || result.getIgnoreCount() != 0) {
                report.setProperty("status", "blocked");
                report.setProperty("message", "The selected test did not run exactly once.");
            } else {
                report.setProperty("status", "passed");
                report.setProperty("message", "The selected isolated-method assertion passed.");
            }
            report.setProperty("junit_version", junit.runner.Version.id());
        } catch (Throwable error) {
            report.setProperty("status", "runner_error");
            report.setProperty("message", error.toString());
        }
        // Limit report text independently of the student's stdout/stderr.
        for (String key : report.stringPropertyNames()) {
            String value = report.getProperty(key);
            if (value.length() > 4000) {
                int end = Character.isHighSurrogate(value.charAt(3999)) ? 3999 : 4000;
                report.setProperty(key, value.substring(0, end) + " [truncated]");
                report.setProperty("details_truncated", "true");
            }
        }
        // UTF-8 avoids the six-byte Unicode escaping used by Properties.store(OutputStream).
        // Replace any malformed UTF-16 in submitted exception text rather than losing the result.
        try (var output = new BufferedWriter(new OutputStreamWriter(
                Files.newOutputStream(Path.of(args[2]), StandardOpenOption.CREATE_NEW), StandardCharsets.UTF_8))) { report.store(output, null); }
        ProcessHandle.current().descendants().forEach(p -> { try { p.destroyForcibly(); } catch (RuntimeException ignored) {} });
        System.exit(0); // Stop any remaining non-daemon Java threads from the submission.
    }
    private static boolean causedBy(Throwable error, Class<?> type) {
        Set<Throwable> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        while (error != null && seen.add(error)) { if (type.isInstance(error)) return true; error = error.getCause(); }
        return false;
    }
}
