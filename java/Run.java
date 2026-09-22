import java.io.File;
import java.nio.file.*;
import java.util.*;
import javax.tools.ToolProvider;

/** Starts the local checker without a build tool. Requires a JDK and JUnit 4.13.2. */
public class Run {
    public static void main(String[] arguments) throws Exception {
        var args = new ArrayList<>(List.of(arguments));
        Path sources = Path.of(System.getProperty("jdk.launcher.sourcefile", "java/Run.java"))
                .toAbsolutePath().normalize().getParent();
        Path junit = dependency(args, "--junit", "JUNIT_JAR", sources, "junit-4.13.2.jar");
        Path hamcrest = dependency(args, "--hamcrest", "HAMCREST_JAR", sources, "hamcrest-core-1.3.jar");
        if (junit == null || hamcrest == null) {
            System.err.println("Provide --junit PATH and --hamcrest PATH, or put junit-4.13.2.jar and hamcrest-core-1.3.jar in java/lib.");
            System.err.println("Existing Apache NetBeans libraries are detected automatically on Windows. Nothing is downloaded.");
            System.exit(2);
        }
        var compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null) throw new IllegalStateException("Launch this file with a full JDK, not a JRE.");
        Path build = Files.createTempDirectory("coursework-runner-build-");
        int exit = 2;
        try {
            String libraries = junit + File.pathSeparator + hamcrest;
            var options = new ArrayList<>(List.of("--release", "17", "-proc:none", "-encoding", "UTF-8",
                    "-classpath", libraries, "-d", build.toString()));
            for (String folder : List.of("runner", "courseworks")) {
                try (var paths = Files.walk(sources.resolve(folder))) {
                    paths.filter(p -> p.toString().endsWith(".java")).sorted().forEach(p -> options.add(p.toString()));
                }
            }
            if (compiler.run(null, null, null, options.toArray(String[]::new)) != 0) {
                System.err.println("The checker itself did not compile; no student checks were run.");
            } else {
                String java = Path.of(System.getProperty("java.home"), "bin", isWindows() ? "java.exe" : "java").toString();
                var command = new ArrayList<>(List.of(java, "-cp", build + File.pathSeparator + libraries, "runner.Main"));
                command.addAll(args);
                var process = new ProcessBuilder(command).inheritIO().start();
                exit = process.waitFor();
            }
        } finally {
            try (var paths = Files.walk(build)) {
                for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
            } catch (java.io.IOException | java.io.UncheckedIOException error) {
                System.err.println("Some temporary checker files could not be deleted: " + build);
            }
        }
        System.exit(exit);
    }

    private static boolean isWindows() { return System.getProperty("os.name").startsWith("Windows"); }

    private static Path dependency(List<String> args, String option, String environment, Path source, String filename) {
        int index = args.indexOf(option);
        if (index >= 0) {
            if (index + 1 >= args.size()) throw new IllegalArgumentException("Missing path after " + option);
            Path value = Path.of(args.remove(index + 1)).toAbsolutePath().normalize();
            args.remove(index);
            if (!Files.isRegularFile(value)) throw new IllegalArgumentException("Library not found: " + value);
            return value;
        }
        var candidates = new ArrayList<Path>();
        if (System.getenv(environment) != null) candidates.add(Path.of(System.getenv(environment)));
        candidates.add(source.resolve("lib").resolve(filename));
        if (System.getenv("ProgramFiles") != null)
            candidates.add(Path.of(System.getenv("ProgramFiles"), "Apache NetBeans", "platform", "modules", "ext", filename));
        return candidates.stream().filter(Files::isRegularFile).map(p -> p.toAbsolutePath().normalize()).findFirst().orElse(null);
    }
}
