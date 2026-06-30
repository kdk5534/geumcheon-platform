package kr.go.geumcheon.dataplatform.map;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Repository
@Profile("!mock")
public class JdbcBoundaryStore implements BoundaryStore {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public JdbcBoundaryStore(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    public BoundaryFeatureCollection find(String boundaryType, String baseYear) {
        String normalizedType = normalizeType(boundaryType);
        String selectedYear = baseYear == null || baseYear.isBlank()
                ? jdbcTemplate.queryForObject("""
                    SELECT MAX(base_year) FROM administrative_boundary WHERE boundary_type = ?
                    """, String.class, normalizedType)
                : baseYear;
        if (selectedYear == null) {
            return new BoundaryFeatureCollection(normalizedType, null, List.of());
        }
        List<BoundaryFeatureCollection.Feature> features = jdbcTemplate.query("""
                SELECT b.boundary_code, b.boundary_name, b.parent_code, b.base_year,
                       COALESCE(b.properties, '{}'::jsonb)::text AS properties,
                       ST_AsGeoJSON(b.geom)::text AS geometry
                FROM administrative_boundary b
                WHERE b.boundary_type = ? AND b.base_year = ?
                  AND (
                    (b.boundary_type = 'DISTRICT' AND b.boundary_name = '금천구')
                    OR
                    (b.boundary_type = 'DONG' AND EXISTS (
                      SELECT 1 FROM administrative_boundary district
                      WHERE district.boundary_type = 'DISTRICT'
                        AND district.boundary_name = '금천구'
                        AND district.base_year = b.base_year
                        AND ST_Intersects(district.geom, ST_PointOnSurface(b.geom))
                    ))
                  )
                ORDER BY b.boundary_code
                """, (rs, rowNum) -> {
            Map<String, Object> properties = new LinkedHashMap<>(jsonMap(rs.getString("properties")));
            properties.put("code", rs.getString("boundary_code"));
            properties.put("name", rs.getString("boundary_name"));
            properties.put("parentCode", rs.getString("parent_code"));
            properties.put("baseYear", rs.getString("base_year"));
            return new BoundaryFeatureCollection.Feature(
                    rs.getString("boundary_code"), properties, jsonMap(rs.getString("geometry")));
        }, normalizedType, selectedYear);
        return new BoundaryFeatureCollection(normalizedType, selectedYear, features);
    }

    private String normalizeType(String value) {
        String normalized = value == null ? "DONG" : value.trim().toUpperCase(Locale.ROOT);
        if (!List.of("DISTRICT", "DONG").contains(normalized)) {
            throw new IllegalArgumentException("Boundary type must be DISTRICT or DONG.");
        }
        return normalized;
    }

    private Map<String, Object> jsonMap(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<>() { });
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("Boundary GeoJSON could not be parsed.", error);
        }
    }
}
