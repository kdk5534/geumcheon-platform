package kr.go.geumcheon.dataplatform.publicdata;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import kr.go.geumcheon.dataplatform.dataset.DatasetRegistry;
import kr.go.geumcheon.dataplatform.dataset.DatasetSummary;
import kr.go.geumcheon.dataplatform.facility.FacilitySummary;
import kr.go.geumcheon.dataplatform.publicdata.PublicDataRepository.CollectorSpec;
import kr.go.geumcheon.dataplatform.publicdata.PublicDataRepository.DatasetRegistryEntry;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Repository
@Profile("!mock")
public class JdbcPublicDataRepository implements PublicDataRepository {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy.MM.dd HH:mm");

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final DatasetRegistry datasetRegistry;

    public JdbcPublicDataRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper, DatasetRegistry datasetRegistry) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.datasetRegistry = datasetRegistry;
    }

    @Override
    public List<DatasetSummary> listDatasets() {
        return datasetRegistry.listDatasetSummaries();
    }

    @Override
    public List<FacilitySummary> listFacilities(MapQuery query) {
        List<Object> params = new ArrayList<>();
        StringBuilder sql = new StringBuilder("""
                SELECT
                    COALESCE(f.source_original_id, f.facility_id::text) AS id,
                    COALESCE(NULLIF(f.facility_category, ''), 'UNKNOWN') AS category,
                    f.facility_name,
                    COALESCE(f.address_road, f.address_jibun, '-') AS address,
                    COALESCE(f.phone, '-') AS phone,
                    ST_Y(f.geom) AS latitude,
                    ST_X(f.geom) AS longitude,
                    COALESCE(d.source_name, COALESCE(f.properties ->> 'source', 'DB')) AS source
                FROM facility f
                LEFT JOIN dataset d ON d.dataset_id = f.dataset_id
                WHERE f.is_active = TRUE
                """);
        if (query.hasBbox()) {
            // && 연산자는 GIST 인덱스를 사용하는 bbox 겹침 검사 (ST_Within보다 빠름)
            sql.append(" AND f.geom && ST_MakeEnvelope(?, ?, ?, ?, 4326)\n");
            params.add(query.minLng()); params.add(query.minLat());
            params.add(query.maxLng()); params.add(query.maxLat());
        }
        if (query.category() != null && !query.category().isBlank() && !"전체".equals(query.category())) {
            sql.append(" AND f.facility_category = ?\n");
            params.add(query.category());
        }
        sql.append("""
                ORDER BY COALESCE(f.data_base_time, f.created_at) DESC, f.facility_name ASC
                LIMIT ? OFFSET ?
                """);
        params.add(query.size());
        params.add((long) query.page() * query.size());

        return jdbcTemplate.query(sql.toString(), (rs, rowNum) -> new FacilitySummary(
                rs.getString("id"),
                rs.getString("category"),
                rs.getString("facility_name"),
                rs.getString("address"),
                rs.getString("phone"),
                rs.getObject("latitude", Double.class),
                rs.getObject("longitude", Double.class),
                rs.getString("source")
        ), params.toArray());
    }

    @Override
    public List<StoreSummary> listStores(MapQuery query) {
        List<Object> params = new ArrayList<>();
        StringBuilder sql = new StringBuilder("""
                SELECT
                    COALESCE(s.source_store_id, s.store_id::text) AS id,
                    COALESCE(NULLIF(s.store_name, ''), 'STORE') AS store_name,
                    COALESCE(NULLIF(s.industry_large_name, ''), NULLIF(s.industry_middle_name, ''), NULLIF(s.industry_small_name, ''), 'STORE') AS category,
                    COALESCE(s.address_road, s.address_jibun, '-') AS address,
                    COALESCE(ST_Y(s.geom), 0.0) AS latitude,
                    COALESCE(ST_X(s.geom), 0.0) AS longitude,
                    COALESCE(d.source_name, COALESCE(s.properties ->> 'source', 'API')) AS source
                FROM store_business s
                LEFT JOIN dataset d ON d.dataset_id = s.dataset_id
                WHERE s.is_active = TRUE
                """);
        if (query.hasBbox()) {
            sql.append(" AND s.geom && ST_MakeEnvelope(?, ?, ?, ?, 4326)\n");
            params.add(query.minLng()); params.add(query.minLat());
            params.add(query.maxLng()); params.add(query.maxLat());
        }
        if (query.category() != null && !query.category().isBlank() && !"전체".equals(query.category())) {
            sql.append(" AND s.industry_large_name = ?\n");
            params.add(query.category());
        }
        sql.append("""
                ORDER BY COALESCE(s.data_base_time, s.created_at) DESC, s.store_name ASC
                LIMIT ? OFFSET ?
                """);
        params.add(query.size());
        params.add((long) query.page() * query.size());

        return jdbcTemplate.query(sql.toString(), (rs, rowNum) -> new StoreSummary(
                rs.getString("id"),
                rs.getString("store_name"),
                rs.getString("category"),
                rs.getString("address"),
                rs.getDouble("latitude"),
                rs.getDouble("longitude"),
                rs.getString("source")
        ), params.toArray());
    }

    @Override
    public List<AirQualitySummary> listAirQuality() {
        return jdbcTemplate.query("""
                WITH latest AS (
                    SELECT DISTINCT ON (v.area_code, v.area_name)
                        v.value_id,
                        i.indicator_key,
                        v.area_code,
                        v.area_name,
                        v.value_numeric,
                        v.value_text,
                        v.value_json,
                        v.observed_at,
                        v.base_period,
                        v.data_base_time,
                        v.created_at
                    FROM indicator_value v
                    JOIN indicator i ON i.indicator_id = v.indicator_id
                    WHERE i.indicator_key = 'seoul-air-quality'
                    ORDER BY v.area_code, v.observed_at DESC NULLS LAST, v.created_at DESC
                )
                SELECT
                    area_code,
                    area_name,
                    observed_at,
                    value_text,
                    base_period,
                    value_numeric,
                    value_json,
                    data_base_time
                FROM latest
                ORDER BY area_name ASC
                """, this::mapAirQuality);
    }

    @Override
    public List<ApiSourceSummary> listApiSources(List<CollectorSpec> specs) {
        Map<String, ApiLogSummary> latestLogs = latestApiLogsByDataset();
        return specs.stream()
                .map(spec -> {
                    ApiLogSummary latest = latestLogs.get(spec.datasetKey());
                    String status = statusFor(spec, latest);
                    String lastSynced = latest == null ? "-" : latest.collectedAt();
                    String note = noteFor(spec, latest, status);
                    return new ApiSourceSummary(
                            spec.datasetKey(),
                            spec.datasetName(),
                            spec.domain(),
                            status,
                            spec.refreshCycle(),
                            spec.targetScreen(),
                            spec.envVarName(),
                            spec.sourceName(),
                            lastSynced,
                            note
                    );
                })
                .toList();
    }

    @Override
    public List<ApiLogSummary> recentApiLogs(List<CollectorSpec> specs) {
        Map<String, CollectorSpec> specMap = specs.stream().collect(java.util.stream.Collectors.toMap(
                CollectorSpec::datasetKey,
                spec -> spec
        ));

        return jdbcTemplate.query("""
                SELECT
                    log.log_id,
                    dataset.dataset_key,
                    dataset.dataset_name,
                    dataset.domain,
                    dataset.source_name,
                    dataset.refresh_cycle,
                    log.collection_type,
                    log.status,
                    log.started_at,
                    log.finished_at,
                    COALESCE(log.source_record_count, 0) AS source_record_count,
                    COALESCE(log.saved_record_count, 0) AS saved_record_count,
                    COALESCE(log.error_message, '') AS error_message,
                    COALESCE(log.created_by, 'system') AS created_by
                FROM dataset_collection_log log
                JOIN dataset ON dataset.dataset_id = log.dataset_id
                WHERE log.collection_type = 'API'
                ORDER BY log.started_at DESC
                LIMIT 20
                """, (rs, rowNum) -> mapApiLog(rs, specMap));
    }

    @Override
    public Map<String, DatasetRegistryEntry> loadDatasetRegistryEntries(List<CollectorSpec> specs) {
        Map<String, ApiLogSummary> latestLogs = latestApiLogsByDataset();
        Map<String, DatasetRegistryEntry> entries = new LinkedHashMap<>();
        for (CollectorSpec spec : specs) {
            entries.put(spec.datasetKey(), new DatasetRegistryEntry(
                    spec.datasetKey(),
                    spec.datasetName(),
                    spec.domain(),
                    spec.sourceName(),
                    spec.sourceUrl(),
                    spec.refreshCycle(),
                    spec.apiStatus(),
                    spec.authKeyRequired(),
                    spec.envVarName(),
                    latestLogs.get(spec.datasetKey())
            ));
        }
        return entries;
    }

    @Override
    public UUID upsertDataset(CollectorSpec spec) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO dataset (
                    dataset_key,
                    dataset_name,
                    domain,
                    source_name,
                    source_url,
                    refresh_cycle,
                    spatial_type,
                    api_status,
                    auth_key_required,
                    env_var_name,
                    is_public,
                    is_active
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, TRUE)
                ON CONFLICT (dataset_key)
                DO UPDATE SET
                    dataset_name = EXCLUDED.dataset_name,
                    domain = EXCLUDED.domain,
                    source_name = EXCLUDED.source_name,
                    source_url = EXCLUDED.source_url,
                    refresh_cycle = EXCLUDED.refresh_cycle,
                    spatial_type = EXCLUDED.spatial_type,
                    api_status = EXCLUDED.api_status,
                    auth_key_required = EXCLUDED.auth_key_required,
                    env_var_name = EXCLUDED.env_var_name,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING dataset_id
                """,
                UUID.class,
                spec.datasetKey(),
                spec.datasetName(),
                spec.domain(),
                spec.sourceName(),
                spec.sourceUrl(),
                spec.refreshCycle(),
                spec.spatialType(),
                spec.apiStatus(),
                spec.authKeyRequired(),
                spec.envVarName()
        );
    }

    @Override
    public UUID ensureIndicator(String indicatorKey, String indicatorName, String domain, String unit, String description, UUID datasetId) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO indicator (
                    indicator_key,
                    indicator_name,
                    domain,
                    unit,
                    description,
                    source_dataset_id,
                    is_public,
                    sort_order
                )
                VALUES (?, ?, ?, ?, ?, ?, TRUE, 0)
                ON CONFLICT (indicator_key)
                DO UPDATE SET
                    indicator_name = EXCLUDED.indicator_name,
                    domain = EXCLUDED.domain,
                    unit = EXCLUDED.unit,
                    description = EXCLUDED.description,
                    source_dataset_id = EXCLUDED.source_dataset_id,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING indicator_id
                """,
                UUID.class,
                indicatorKey,
                indicatorName,
                domain,
                unit,
                description,
                datasetId
        );
    }

    @Transactional
    @Override
    public int replaceStoreBusinesses(UUID datasetId, List<Map<String, String>> rows) {
        jdbcTemplate.update("DELETE FROM store_business WHERE dataset_id = ?", datasetId);
        List<Object[]> batchRows = new ArrayList<>();
        for (Map<String, String> row : rows) {
            Object[] params = buildStoreBusinessRowParams(datasetId, row);
            if (params != null) {
                batchRows.add(params);
            }
        }
        if (!batchRows.isEmpty()) {
            jdbcTemplate.batchUpdate("""
                    INSERT INTO store_business (
                        dataset_id,
                        source_store_id,
                        store_name,
                        industry_large_code,
                        industry_large_name,
                        industry_middle_code,
                        industry_middle_name,
                        industry_small_code,
                        industry_small_name,
                        standard_industry_code,
                        standard_industry_name,
                        address_road,
                        address_jibun,
                        dong_code,
                        geom,
                        properties,
                        data_base_time,
                        is_active
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN CAST(? AS double precision) IS NULL OR CAST(? AS double precision) IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(CAST(? AS double precision), CAST(? AS double precision)), 4326) END, CAST(? AS jsonb), CURRENT_TIMESTAMP, TRUE)
                    """, batchRows);
        }
        return batchRows.size();
    }

    @Transactional
    @Override
    public int replaceAirQualitySnapshot(UUID datasetId, List<Map<String, String>> rows) {
        UUID indicatorId = ensureIndicator(
                "seoul-air-quality",
                "Seoul district air quality",
                "real-time",
                "index",
                "Latest Seoul district air quality snapshot",
                datasetId
        );

        jdbcTemplate.update("DELETE FROM indicator_value WHERE indicator_id = ?", indicatorId);
        List<Object[]> batchRows = new ArrayList<>();
        for (Map<String, String> row : rows) {
            Object[] params = buildAirQualityRowParams(indicatorId, row);
            if (params != null) {
                batchRows.add(params);
            }
        }
        if (!batchRows.isEmpty()) {
            jdbcTemplate.batchUpdate("""
                    INSERT INTO indicator_value (
                        indicator_id,
                        area_type,
                        area_code,
                        area_name,
                        value_numeric,
                        value_text,
                        value_json,
                        observed_at,
                        base_period,
                        data_base_time
                    )
                    VALUES (?, 'DISTRICT', ?, ?, ?, ?, CAST(? AS jsonb), ?, ?, CURRENT_TIMESTAMP)
                    """, batchRows);
        }
        return batchRows.size();
    }

    @Override
    public UUID recordCollectionLog(
            UUID datasetId,
            String collectionType,
            String status,
            Instant startedAt,
            Instant finishedAt,
            int sourceRecordCount,
            int savedRecordCount,
            String errorMessage,
            String requestUrl,
            String createdBy
    ) {
        String safeRequestUrl = maskRequestUrlForLog(requestUrl);
        return jdbcTemplate.queryForObject("""
                INSERT INTO dataset_collection_log (
                    log_id,
                    dataset_id,
                    collection_type,
                    status,
                    started_at,
                    finished_at,
                    source_record_count,
                    saved_record_count,
                    error_message,
                    request_url,
                    created_by
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING log_id
                """,
                UUID.class,
                UUID.randomUUID(),
                datasetId,
                collectionType,
                status,
                Timestamp.from(startedAt),
                Timestamp.from(finishedAt),
                sourceRecordCount,
                savedRecordCount,
                errorMessage,
                safeRequestUrl,
                createdBy
        );
    }

    private String maskRequestUrlForLog(String requestUrl) {
        if (requestUrl == null || requestUrl.isBlank()) {
            return requestUrl;
        }
        return RequestUrlMasker.mask(requestUrl);
    }

    private Map<String, ApiLogSummary> latestApiLogsByDataset() {
        return jdbcTemplate.query("""
                WITH ranked AS (
                    SELECT
                        dataset.dataset_key,
                        dataset.dataset_name,
                        dataset.domain,
                        dataset.source_name,
                        dataset.refresh_cycle,
                        dataset.env_var_name,
                        log.status,
                        log.started_at,
                        log.finished_at,
                        COALESCE(log.source_record_count, 0) AS source_record_count,
                        COALESCE(log.saved_record_count, 0) AS saved_record_count,
                        COALESCE(log.error_message, '') AS error_message,
                        COALESCE(log.created_by, 'system') AS created_by,
                        ROW_NUMBER() OVER (PARTITION BY dataset.dataset_key ORDER BY log.started_at DESC) AS rn
                    FROM dataset_collection_log log
                    JOIN dataset ON dataset.dataset_id = log.dataset_id
                    WHERE log.collection_type = 'API'
                )
                SELECT * FROM ranked WHERE rn = 1
                """, rs -> {
            Map<String, ApiLogSummary> map = new LinkedHashMap<>();
            while (rs.next()) {
                ApiLogSummary log = mapApiLog(rs, Map.<String, CollectorSpec>of());
                map.put(rs.getString("dataset_key"), log);
            }
            return map;
        });
    }

    private ApiLogSummary mapApiLog(ResultSet rs, Map<String, CollectorSpec> specMap) throws SQLException {
        String datasetKey = rs.getString("dataset_key");
        CollectorSpec spec = specMap.get(datasetKey);
        String collectionStatus = rs.getString("status");
        String createdBy = safeLower(rs.getString("created_by"));
        String mappedStatus = mapLogStatus(collectionStatus, createdBy);
        Instant startedAt = timestampToInstant(rs.getTimestamp("started_at"));
        Instant finishedAt = timestampToInstant(rs.getTimestamp("finished_at"));
        long seconds = 1L;
        if (startedAt != null && finishedAt != null) {
            seconds = Math.max(1L, Duration.between(startedAt, finishedAt).toSeconds());
        }
        String duration = formatDuration(seconds);
        int rows = rs.getInt("saved_record_count");
        String note = rs.getString("error_message");
        if (note == null || note.isBlank()) {
            note = "Saved " + rows + " record(s).";
        }
        return new ApiLogSummary(
                rs.getString("log_id"),
                rs.getString("source_name"),
                rs.getString("domain"),
                mappedStatus,
                formatInstant(finishedAt),
                duration,
                rows,
                spec == null ? defaultTargetScreen(datasetKey) : spec.targetScreen(),
                spec == null ? "-" : spec.refreshCycle(),
                note
        );
    }

    private String statusFor(CollectorSpec spec, ApiLogSummary latest) {
        if (!spec.apiKeyPresent()) {
            return spec.authKeyRequired() ? "key-needed" : "mock";
        }
        if (latest == null) {
            return "check-required";
        }
        if ("success".equals(latest.status()) || "manual".equals(latest.status())) {
            return "ready";
        }
        if ("queued".equals(latest.status())) {
            return "key-needed";
        }
        return "check-required";
    }

    private String noteFor(CollectorSpec spec, ApiLogSummary latest, String status) {
        if (spec.authKeyRequired() && !spec.apiKeyPresent()) {
            return "API key is missing.";
        }
        if ("key-needed".equals(status)) {
            return "API key is missing.";
        }
        if (latest == null) {
            return "Ready to collect live data.";
        }
        if ("ready".equals(status)) {
            return "Last sync saved " + latest.rows() + " record(s).";
        }
        if ("check-required".equals(status)) {
            return latest.note();
        }
        return latest.note();
    }

    private String mapLogStatus(String collectionStatus, String createdBy) {
        if (collectionStatus == null) {
            return "queued";
        }
        String normalized = collectionStatus.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "SUCCESS" -> "manual".equals(createdBy) ? "manual" : "success";
            case "FAILED" -> "fail";
            case "SKIPPED" -> "queued";
            default -> "queued";
        };
    }

    private Object[] buildStoreBusinessRowParams(UUID datasetId, Map<String, String> row) {
        Map<String, String> normalized = normalizeRow(row);
        String name = firstValue(normalized, "bizesnm", "상호명", "store_name", "name");
        if (name == null || name.isBlank()) {
            return null;
        }

        String sourceStoreId = firstValue(normalized, "bizesno", "상가업소번호", "store_id", "id");
        String industryLargeCode = firstValue(normalized, "indslclscd", "상권업종대분류코드", "industry_large_code");
        String industryLargeName = firstValue(normalized, "indslclsnm", "상권업종대분류명", "industry_large_name");
        String industryMiddleCode = firstValue(normalized, "indsmclscd", "상권업종중분류코드", "industry_middle_code");
        String industryMiddleName = firstValue(normalized, "indsmclsnm", "상권업종중분류명", "industry_middle_name");
        String industrySmallCode = firstValue(normalized, "indssclscd", "상권업종소분류코드", "industry_small_code");
        String industrySmallName = firstValue(normalized, "indssclsnm", "상권업종소분류명", "industry_small_name");
        String standardIndustryCode = firstValue(normalized, "ksiccd", "표준산업분류코드", "standard_industry_code");
        String standardIndustryName = firstValue(normalized, "ksicnm", "표준산업분류명", "standard_industry_name");
        String addressRoad = firstValue(normalized, "rdnmadr", "도로명주소", "address_road");
        String addressJibun = firstValue(normalized, "lnoadr", "지번주소", "address_jibun");
        String dongCode = firstValue(normalized, "adongcd", "법정동코드", "dong_code");
        Double latitude = parseDouble(firstValue(normalized, "lat", "latitude", "위도", "y"));
        Double longitude = parseDouble(firstValue(normalized, "lon", "longitude", "경도", "x"));
        String properties = toJson(row);
        return new Object[] {
                datasetId,
                sourceStoreId,
                name,
                industryLargeCode,
                industryLargeName,
                industryMiddleCode,
                industryMiddleName,
                industrySmallCode,
                industrySmallName,
                standardIndustryCode,
                standardIndustryName,
                addressRoad,
                addressJibun,
                dongCode,
                longitude,
                latitude,
                longitude,
                latitude,
                properties
        };
    }

    private Object[] buildAirQualityRowParams(UUID indicatorId, Map<String, String> row) {
        Map<String, String> normalized = normalizeRow(row);
        String districtName = firstValue(normalized, "msrstename", "측정소명", "district_name");
        if (districtName == null || districtName.isBlank()) {
            return null;
        }

        String districtCode = firstValue(normalized, "msradmcode", "측정소 행정코드", "district_code");
        String measuredAtText = firstValue(normalized, "msrdate", "측정날짜", "measured_at");
        Instant observedAt = parseObservedAt(measuredAtText);
        Double maxIndex = parseDouble(firstValue(normalized, "maxindex", "통합대기환경지수", "index"));
        String grade = firstValue(normalized, "grade", "등급");
        String pollutant = firstValue(normalized, "pollutant", "지수결정물질");
        Double nitrogen = parseDouble(firstValue(normalized, "nitrogen", "이산화질소"));
        Double ozone = parseDouble(firstValue(normalized, "ozone", "오존"));
        Double carbon = parseDouble(firstValue(normalized, "carbon", "일산화탄소"));
        Double sulfurous = parseDouble(firstValue(normalized, "sulfurous", "아황산가스"));
        Double pm10 = parseDouble(firstValue(normalized, "pm10", "미세먼지"));
        Double pm25 = parseDouble(firstValue(normalized, "pm25", "초미세먼지"));
        String properties = toJson(row);
        String basePeriod = measuredAtText == null ? null : measuredAtText.replaceAll("[^0-9]", "");
        return new Object[] {
                indicatorId,
                districtCode,
                districtName,
                maxIndex,
                grade != null && !grade.isBlank() ? grade : pollutant,
                properties,
                observedAt == null ? null : Timestamp.from(observedAt),
                basePeriod
        };
    }

    private AirQualitySummary mapAirQuality(ResultSet rs, int rowNum) throws SQLException {
        Instant observedAt = timestampToInstant(rs.getTimestamp("observed_at"));
        Map<String, String> normalized = normalizeJsonRow(rs.getString("value_json"));
        String grade = firstValue(normalized, "grade", "등급");
        String pollutant = firstValue(normalized, "pollutant", "지수결정물질");
        if (grade == null || grade.isBlank()) {
            grade = rs.getString("value_text");
        }
        if (pollutant == null || pollutant.isBlank()) {
            pollutant = grade;
        }
        return new AirQualitySummary(
                rs.getString("area_code"),
                rs.getString("area_name"),
                formatInstant(observedAt),
                grade,
                pollutant,
                rs.getObject("value_numeric") == null ? null : rs.getDouble("value_numeric"),
                parseDouble(firstValue(normalized, "nitrogen", "이산화질소")),
                parseDouble(firstValue(normalized, "ozone", "오존")),
                parseDouble(firstValue(normalized, "carbon", "일산화탄소")),
                parseDouble(firstValue(normalized, "sulfurous", "아황산가스")),
                parseDouble(firstValue(normalized, "pm10", "미세먼지")),
                parseDouble(firstValue(normalized, "pm25", "초미세먼지")),
                "서울 열린데이터광장"
        );
    }

    private Map<String, String> normalizeRow(Map<String, String> row) {
        Map<String, String> normalized = new LinkedHashMap<>();
        for (Map.Entry<String, String> entry : row.entrySet()) {
            normalized.put(normalizeKey(entry.getKey()), entry.getValue());
        }
        return normalized;
    }

    private String firstValue(Map<String, String> row, String... aliases) {
        for (String alias : aliases) {
            String value = row.get(normalizeKey(alias));
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private String normalizeKey(String value) {
        return String.valueOf(value)
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9가-힣]+", "");
    }

    private Map<String, String> normalizeJsonRow(String value) {
        if (value == null || value.isBlank()) {
            return Map.of();
        }
        try {
            JsonNode node = objectMapper.readTree(value);
            if (node == null || !node.isObject()) {
                return Map.of();
            }
            Map<String, String> normalized = new LinkedHashMap<>();
            node.fields().forEachRemaining(entry -> {
                JsonNode fieldValue = entry.getValue();
                normalized.put(
                        normalizeKey(entry.getKey()),
                        fieldValue == null || fieldValue.isNull() ? null : fieldValue.asText("")
                );
            });
            return normalized;
        } catch (JsonProcessingException error) {
            return Map.of();
        }
    }

    private String toJson(Map<String, String> row) {
        try {
            return objectMapper.writeValueAsString(row);
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("Row serialization failed", error);
        }
    }

    private Double parseDouble(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Double.parseDouble(value.trim().replace(",", ""));
        } catch (NumberFormatException error) {
            return null;
        }
    }

    private Instant parseObservedAt(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        String trimmed = value.trim();
        List<PatternCandidate> formatters = List.of(
                new PatternCandidate(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"), true),
                new PatternCandidate(DateTimeFormatter.ofPattern("yyyyMMddHHmm"), true),
                new PatternCandidate(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"), true),
                new PatternCandidate(DateTimeFormatter.ofPattern("yyyyMMdd"), false)
        );

        for (PatternCandidate candidate : formatters) {
            try {
                if (candidate.withTime()) {
                    LocalDateTime parsed = LocalDateTime.parse(trimmed, candidate.formatter());
                    return parsed.atZone(ZoneId.systemDefault()).toInstant();
                }
                return java.time.LocalDate.parse(trimmed, candidate.formatter())
                        .atStartOfDay(ZoneId.systemDefault())
                        .toInstant();
            } catch (RuntimeException ignore) {
                // Try next formatter.
            }
        }
        return null;
    }

    private String formatInstant(Instant instant) {
        if (instant == null) {
            return "-";
        }
        return DATE_TIME.format(LocalDateTime.ofInstant(instant, ZoneId.systemDefault()));
    }

    private String formatDuration(long seconds) {
        if (seconds < 60) {
            return seconds + "초";
        }
        long minutes = seconds / 60;
        long remain = seconds % 60;
        if (remain == 0) {
            return minutes + "분";
        }
        return minutes + "분 " + remain + "초";
    }

    private String safeLower(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private Instant timestampToInstant(Timestamp timestamp) {
        if (timestamp == null) {
            return null;
        }
        return timestamp.toInstant();
    }

    private String defaultTargetScreen(String datasetKey) {
        return switch (datasetKey == null ? "" : datasetKey) {
            case "stores" -> "상권분석";
            case "air-quality" -> "대기환경";
            default -> "메인 대시보드";
        };
    }

    private record PatternCandidate(DateTimeFormatter formatter, boolean withTime) {
    }
}
