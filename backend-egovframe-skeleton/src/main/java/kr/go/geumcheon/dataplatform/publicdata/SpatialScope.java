package kr.go.geumcheon.dataplatform.publicdata;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public enum SpatialScope {
    GEUMCHEON,
    BORDER_AREA,
    EXTERNAL_REFERENCE;

    public static List<String> parseQuery(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of(GEUMCHEON.name());
        }

        Set<String> values = new LinkedHashSet<>();
        for (String token : raw.split(",")) {
            String normalized = token.trim().toUpperCase(Locale.ROOT);
            if (normalized.isEmpty()) {
                continue;
            }
            values.add(SpatialScope.valueOf(normalized).name());
        }
        return values.isEmpty() ? List.of(GEUMCHEON.name()) : List.copyOf(values);
    }
}

