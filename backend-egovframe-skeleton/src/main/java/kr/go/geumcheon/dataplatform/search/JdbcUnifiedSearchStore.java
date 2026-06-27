package kr.go.geumcheon.dataplatform.search;

import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

@Repository
@Profile("!mock")
public class JdbcUnifiedSearchStore implements UnifiedSearchStore {

    private final JdbcTemplate jdbcTemplate;

    public JdbcUnifiedSearchStore(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public List<SearchResultItem> search(String query, int limit) {
        String pattern = "%" + query + "%";
        int perType = Math.max(3, Math.min(10, limit));
        List<SearchResultItem> results = new ArrayList<>();
        results.addAll(jdbcTemplate.query("""
                SELECT dataset_key, dataset_name, domain, source_name
                FROM dataset
                WHERE is_public = TRUE AND is_active = TRUE
                  AND (dataset_name ILIKE ? OR dataset_key ILIKE ? OR domain ILIKE ?)
                ORDER BY dataset_name
                LIMIT ?
                """, (rs, rowNum) -> new SearchResultItem(
                "DATASET", rs.getString("dataset_key"), rs.getString("dataset_name"),
                rs.getString("domain") + " · " + rs.getString("source_name"),
                "#/datasets?dataset=" + encode(rs.getString("dataset_key"))), pattern, pattern, pattern, perType));
        results.addAll(jdbcTemplate.query("""
                SELECT facility_id::text, facility_name, facility_category,
                       COALESCE(address_road, address_jibun, '주소 정보 없음') AS address
                FROM facility
                WHERE is_active = TRUE AND spatial_scope = 'GEUMCHEON'
                  AND (facility_name ILIKE ? OR COALESCE(address_road, address_jibun, '') ILIKE ?)
                ORDER BY facility_name
                LIMIT ?
                """, (rs, rowNum) -> new SearchResultItem(
                "FACILITY", rs.getString("facility_id"), rs.getString("facility_name"),
                rs.getString("facility_category") + " · " + rs.getString("address"),
                "#/nearby?facility=" + encode(rs.getString("facility_id"))), pattern, pattern, perType));
        results.addAll(jdbcTemplate.query("""
                SELECT boundary_code, boundary_name, boundary_type
                FROM administrative_boundary
                WHERE boundary_type IN ('DISTRICT', 'DONG') AND boundary_name ILIKE ?
                  AND (
                    (boundary_type = 'DISTRICT' AND boundary_name = '금천구')
                    OR
                    (boundary_type = 'DONG' AND EXISTS (
                      SELECT 1 FROM administrative_boundary district
                      WHERE district.boundary_type = 'DISTRICT'
                        AND district.boundary_name = '금천구'
                        AND district.base_year = administrative_boundary.base_year
                        AND ST_Intersects(district.geom, ST_PointOnSurface(administrative_boundary.geom))
                    ))
                  )
                ORDER BY boundary_type, boundary_name
                LIMIT ?
                """, (rs, rowNum) -> new SearchResultItem(
                "AREA", rs.getString("boundary_code"), rs.getString("boundary_name"),
                "DONG".equals(rs.getString("boundary_type")) ? "행정동" : "자치구",
                "#/population?district=" + encode(rs.getString("boundary_name"))), pattern, perType));
        return results.stream().limit(limit).toList();
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
