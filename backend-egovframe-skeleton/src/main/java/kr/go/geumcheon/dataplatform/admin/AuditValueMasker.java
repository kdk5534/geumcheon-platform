package kr.go.geumcheon.dataplatform.admin;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public final class AuditValueMasker {

    private static final Set<String> SECRET_PARTS = Set.of(
            "password", "passwd", "secret", "token", "api_key", "apikey", "authorization", "cookie"
    );

    private AuditValueMasker() {
    }

    public static Map<String, Object> mask(Map<String, Object> source) {
        if (source == null) {
            return Map.of();
        }
        Map<String, Object> masked = new LinkedHashMap<>();
        source.forEach((key, value) -> masked.put(key, isSecret(key) ? "***" : maskNested(value)));
        return masked;
    }

    private static Object maskNested(Object value) {
        if (value instanceof Map<?, ?> nested) {
            Map<String, Object> normalized = new LinkedHashMap<>();
            nested.forEach((key, nestedValue) -> normalized.put(String.valueOf(key), nestedValue));
            return mask(normalized);
        }
        if (value instanceof Iterable<?> iterable) {
            java.util.List<Object> values = new java.util.ArrayList<>();
            iterable.forEach(item -> values.add(maskNested(item)));
            return values;
        }
        return value;
    }

    private static boolean isSecret(String key) {
        String normalized = key == null ? "" : key.toLowerCase(Locale.ROOT).replace('-', '_');
        return SECRET_PARTS.stream().anyMatch(normalized::contains);
    }
}
