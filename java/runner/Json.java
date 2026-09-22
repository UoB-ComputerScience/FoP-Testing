package runner;

import java.util.*;

/** Small JSON writer for reports; no runtime library or build framework is needed. */
final class Json {
    static String write(Object value) { return write(value, 0); }
    private static String write(Object value, int depth) {
        if (value == null) return "null";
        if (value instanceof Number || value instanceof Boolean) return value.toString();
        if (value instanceof Map<?, ?> map) {
            var items = new ArrayList<String>();
            map.forEach((key, item) -> items.add("  ".repeat(depth + 1) + quote(String.valueOf(key)) + ": " + write(item, depth + 1)));
            return items.isEmpty() ? "{}" : "{\n" + String.join(",\n", items) + "\n" + "  ".repeat(depth) + "}";
        }
        if (value instanceof Collection<?> list) {
            var items = list.stream().map(item -> "  ".repeat(depth + 1) + write(item, depth + 1)).toList();
            return items.isEmpty() ? "[]" : "[\n" + String.join(",\n", items) + "\n" + "  ".repeat(depth) + "]";
        }
        return quote(String.valueOf(value));
    }
    private static String quote(String text) {
        StringBuilder result = new StringBuilder("\"");
        for (char c : text.toCharArray()) {
            switch (c) {
                case '"' -> result.append("\\\"");
                case '\\' -> result.append("\\\\");
                case '\n' -> result.append("\\n");
                case '\r' -> result.append("\\r");
                case '\t' -> result.append("\\t");
                default -> { if (c < 32) result.append(String.format("\\u%04x", (int)c)); else result.append(c); }
            }
        }
        return result.append('"').toString();
    }
}
