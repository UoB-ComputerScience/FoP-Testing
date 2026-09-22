package runner;

import java.util.*;
import courseworks.fop2025.Profile;

/** Each coursework supplies its own versioned requirements and named JUnit checks. */
public record Coursework(String id, String version, int javaRelease, String sourceDirectory,
                         String rootMarker, String evidenceScope, List<Check> checks) {
    public record Check(String id, String group, String testClass, String method, String description) {}

    public static List<Coursework> available() { return List.of(Profile.coursework()); }

    public static Coursework find(String id) {
        return available().stream().filter(c -> c.id.equals(id)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown coursework: " + id + ". Use --list."));
    }

    public List<Check> select(String selection) {
        var selected = new LinkedHashSet<Check>();
        for (String token : selection.split(",", -1)) {
            String value = token.trim();
            List<Check> matches = checks.stream().filter(c -> value.equals("all") || value.equals(c.id)
                    || value.equals(c.group) || value.equals(c.method) || value.equals(c.testClass)
                    || value.equals(c.testClass + "#" + c.method)).toList();
            if (matches.isEmpty()) throw new IllegalArgumentException("Unknown or empty test selection: " + value + ". Use --list.");
            selected.addAll(matches);
        }
        return List.copyOf(selected);
    }
}
