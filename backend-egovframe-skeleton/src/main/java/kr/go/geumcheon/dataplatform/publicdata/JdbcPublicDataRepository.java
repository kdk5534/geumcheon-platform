package kr.go.geumcheon.dataplatform.publicdata;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import kr.go.geumcheon.dataplatform.dataset.DatasetRegistry;
import kr.go.geumcheon.dataplatform.dataset.DatasetSummary;
import kr.go.geumcheon.dataplatform.dataset.DatasetOperationalStatusSummary;
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
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
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
                    COALESCE(d.source_name, COALESCE(f.properties ->> 'source', 'DB')) AS source,
                    f.spatial_scope,
                    COALESCE(
                        f.properties ->> 'REFERENCE_DATE',
                        f.properties ->> 'referenceDate',
                        f.properties ->> '데이터기준일자',
                        TO_CHAR(f.data_base_time, 'YYYY-MM-DD')
                    ) AS data_reference_date
                FROM facility f
                LEFT JOIN dataset d ON d.dataset_id = f.dataset_id
                WHERE f.is_active = TRUE
                """);
        if (query.category() == null || query.category().isBlank() || "전체".equals(query.category())) {
            sql.append(" AND f.facility_category <> 'PARKING_SPACE_REFERENCE'\n");
        }
        // && 연산자는 GIST 인덱스를 사용하는 bbox 겹침 검사 (ST_Within보다 빠름)
        appendBboxAndCategory(sql, params, query, "f.geom", "f.facility_category");
        appendSpatialScope(sql, params, query, "f.spatial_scope");
        sql.append("ORDER BY COALESCE(f.data_base_time, f.created_at) DESC, f.facility_name ASC\n");
        appendPaging(sql, params, query);

        return jdbcTemplate.query(sql.toString(), (rs, rowNum) -> new FacilitySummary(
                rs.getString("id"),
                rs.getString("category"),
                rs.getString("facility_name"),
                rs.getString("address"),
                rs.getString("phone"),
                rs.getObject("latitude", Double.class),
                rs.getObject("longitude", Double.class),
                rs.getString("source"),
                rs.getString("spatial_scope"),
                rs.getString("data_reference_date")
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
                    COALESCE(d.source_name, COALESCE(s.properties ->> 'source', 'API')) AS source,
                    s.spatial_scope
                FROM store_business s
                LEFT JOIN dataset d ON d.dataset_id = s.dataset_id
                WHERE s.is_active = TRUE
                """);
        appendBboxAndCategory(sql, params, query, "s.geom", "s.industry_large_name");
        appendSpatialScope(sql, params, query, "s.spatial_scope");
        sql.append("ORDER BY COALESCE(s.data_base_time, s.created_at) DESC, s.store_name ASC\n");
        appendPaging(sql, params, query);

        return jdbcTemplate.query(sql.toString(), (rs, rowNum) -> new StoreSummary(
                rs.getString("id"),
                rs.getString("store_name"),
                rs.getString("category"),
                rs.getString("address"),
                rs.getDouble("latitude"),
                rs.getDouble("longitude"),
                rs.getString("source"),
                rs.getString("spatial_scope")
        ), params.toArray());
    }

    @Override
    public long countFacilities(MapQuery query) {
        List<Object> params = new ArrayList<>();
        StringBuilder sql = new StringBuilder("""
                SELECT COUNT(*)
                FROM facility f
                WHERE f.is_active = TRUE
                """);
        if (query.category() == null || query.category().isBlank() || "전체".equals(query.category())) {
            sql.append(" AND f.facility_category <> 'PARKING_SPACE_REFERENCE'\n");
        }
        appendBboxAndCategory(sql, params, query, "f.geom", "f.facility_category");
        appendSpatialScope(sql, params, query, "f.spatial_scope");
        Long count = jdbcTemplate.queryForObject(sql.toString(), Long.class, params.toArray());
        return count == null ? 0L : count;
    }

    @Override
    public List<DatasetOperationalStatusSummary> listDatasetOperationalStatuses() {
        return jdbcTemplate.query("""
                SELECT
                    dataset.dataset_key,
                    dataset.dataset_name,
                    dataset.domain,
                    dataset.source_name,
                    latest.status AS attempt_status,
                    latest.finished_at AS attempted_at,
                    COALESCE(latest.source_record_count, 0) AS attempt_source_count,
                    COALESCE(latest.saved_record_count, 0) AS attempt_saved_count,
                    COALESCE(latest.error_message, '') AS attempt_error,
                    successful.finished_at AS collected_at,
                    COALESCE(successful.source_record_count, 0) AS success_source_count,
                    COALESCE(successful.saved_record_count, 0) AS success_saved_count
                FROM dataset
                LEFT JOIN LATERAL (
                    SELECT log.*
                    FROM dataset_collection_log log
                    WHERE log.dataset_id = dataset.dataset_id
                    ORDER BY log.started_at DESC
                    LIMIT 1
                ) latest ON TRUE
                LEFT JOIN LATERAL (
                    SELECT log.*
                    FROM dataset_collection_log log
                    WHERE log.dataset_id = dataset.dataset_id
                      AND log.status = 'SUCCESS'
                    ORDER BY log.finished_at DESC NULLS LAST, log.started_at DESC
                    LIMIT 1
                ) successful ON TRUE
                WHERE dataset.is_public = TRUE
                  AND dataset.is_active = TRUE
                ORDER BY dataset.domain, dataset.dataset_name
                """, (rs, rowNum) -> {
            String attemptStatus = normalizeOperationalStatus(rs.getString("attempt_status"));
            Instant attemptedAt = timestampToInstant(rs.getTimestamp("attempted_at"));
            Instant collectedAt = timestampToInstant(rs.getTimestamp("collected_at"));
            return new DatasetOperationalStatusSummary(
                    rs.getString("dataset_key"),
                    rs.getString("dataset_name"),
                    rs.getString("domain"),
                    rs.getString("source_name"),
                    attemptStatus,
                    isoInstant(attemptedAt),
                    rs.getInt("attempt_source_count"),
                    rs.getInt("attempt_saved_count"),
                    failureType(attemptStatus, rs.getString("attempt_error")),
                    collectedAt == null ? "NO_SUCCESS" : "AVAILABLE",
                    isoInstant(collectedAt),
                    rs.getInt("success_source_count"),
                    rs.getInt("success_saved_count")
            );
        });
    }

    @Override
    public long countStores(MapQuery query) {
        List<Object> params = new ArrayList<>();
        StringBuilder sql = new StringBuilder("""
                SELECT COUNT(*)
                FROM store_business s
                WHERE s.is_active = TRUE
                """);
        appendBboxAndCategory(sql, params, query, "s.geom", "s.industry_large_name");
        appendSpatialScope(sql, params, query, "s.spatial_scope");
        Long count = jdbcTemplate.queryForObject(sql.toString(), Long.class, params.toArray());
        return count == null ? 0L : count;
    }

    /**
     * bbox와 카테고리 필터 절을 sql에 추가하고 대응하는 파라미터를 params에 넣는다.
     * geomCol: 공간 컬럼 표현식(예: "f.geom"), categoryCol: 카테고리 컬럼(예: "f.facility_category").
     */
    private void appendBboxAndCategory(StringBuilder sql, List<Object> params,
                                        MapQuery query, String geomCol, String categoryCol) {
        if (query.hasBbox()) {
            sql.append(" AND ").append(geomCol)
               .append(" && ST_MakeEnvelope(?, ?, ?, ?, 4326)\n");
            params.add(query.minLng()); params.add(query.minLat());
            params.add(query.maxLng()); params.add(query.maxLat());
        }
        if (query.category() != null && !query.category().isBlank() && !"전체".equals(query.category())) {
            // 초기 시드의 소문자 코드(hospital/pharmacy)와 수집 데이터의 대문자 코드가
            // 함께 존재하므로 공개 필터는 대소문자를 구분하지 않는다.
            sql.append(" AND UPPER(").append(categoryCol).append(") = UPPER(?)\n");
            params.add(query.category());
        }
    }

    /** LIMIT/OFFSET 절을 sql에 추가하고 대응하는 파라미터를 params에 넣는다. */
    private void appendPaging(StringBuilder sql, List<Object> params, MapQuery query) {
        sql.append("LIMIT ? OFFSET ?\n");
        params.add(query.size());
        params.add((long) query.page() * query.size());
    }

    private void appendSpatialScope(StringBuilder sql, List<Object> params, MapQuery query, String scopeCol) {
        List<String> scopes = query.spatialScopes();
        sql.append(" AND ").append(scopeCol).append(" IN (");
        for (int index = 0; index < scopes.size(); index += 1) {
            if (index > 0) {
                sql.append(", ");
            }
            sql.append("?");
            params.add(scopes.get(index));
        }
        sql.append(")\n");
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
                    ORDER BY v.area_code, v.area_name, v.observed_at DESC NULLS LAST, v.created_at DESC
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
        List<Object[]> batchRows = new ArrayList<>();
        for (Map<String, String> row : rows) {
            Object[] params = buildStoreBusinessRowParams(datasetId, row);
            if (params != null) {
                batchRows.add(params);
            }
        }
        CollectionQualityGate.requireValidRowRatio("stores", rows.size(), batchRows.size());
        // 유효 행이 없으면 DELETE를 실행하지 않아 기존 스냅샷을 보존한다.
        if (batchRows.isEmpty()) {
            return 0;
        }
        jdbcTemplate.update("DELETE FROM store_business WHERE dataset_id = ?", datasetId);
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
        jdbcTemplate.update("""
                UPDATE store_business
                SET spatial_scope = classify_geumcheon_spatial_scope(
                    COALESCE(address_road, address_jibun),
                    geom
                )
                WHERE dataset_id = ?
                """, datasetId);
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

        List<Object[]> batchRows = new ArrayList<>();
        for (Map<String, String> row : rows) {
            Object[] params = buildAirQualityRowParams(indicatorId, row);
            if (params != null) {
                batchRows.add(params);
            }
        }
        CollectionQualityGate.requireValidRowRatio("air-quality", rows.size(), batchRows.size());
        // 유효 행이 없으면 DELETE를 실행하지 않아 기존 스냅샷을 보존한다.
        if (batchRows.isEmpty()) {
            return 0;
        }
        jdbcTemplate.update("DELETE FROM indicator_value WHERE indicator_id = ?", indicatorId);
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
        return batchRows.size();
    }

    @Transactional
    @Override
    public int replaceFacilitySnapshot(UUID datasetId, String category, List<Map<String, String>> rows) {
        List<Object[]> batchRows = new ArrayList<>();
        for (Map<String, String> row : rows) {
            Object[] params = buildFacilityRowParams(datasetId, category, row);
            if (params != null) {
                batchRows.add(params);
            }
        }
        CollectionQualityGate.requireValidRowRatio("facility:" + category, rows.size(), batchRows.size());
        // 유효 행이 없으면 DELETE를 실행하지 않아 기존 스냅샷을 보존한다.
        if (batchRows.isEmpty()) {
            return 0;
        }
        jdbcTemplate.update("DELETE FROM facility WHERE dataset_id = ? AND facility_category = ?", datasetId, category);
        jdbcTemplate.batchUpdate("""
                INSERT INTO facility (
                    dataset_id,
                    facility_category,
                    facility_name,
                    source_original_id,
                    description,
                    address_road,
                    geom,
                    properties,
                    data_base_time
                )
                VALUES (?, ?, ?, ?, ?, ?,
                    CASE WHEN CAST(? AS double precision) IS NULL OR CAST(? AS double precision) IS NULL
                         THEN NULL
                         ELSE ST_SetSRID(ST_MakePoint(CAST(? AS double precision), CAST(? AS double precision)), 4326)
                    END,
                    CAST(? AS jsonb),
                    CURRENT_TIMESTAMP)
                """, batchRows);
        jdbcTemplate.update("""
                UPDATE facility
                SET spatial_scope = CASE
                    WHEN properties ->> 'district' = '금천구' THEN 'GEUMCHEON'
                    ELSE classify_geumcheon_spatial_scope(
                        COALESCE(address_road, address_jibun),
                        geom
                    )
                END
                WHERE dataset_id = ? AND facility_category = ?
                """, datasetId, category);
        return batchRows.size();
    }

    // 금천구 행정동별 주민등록인구를 indicator_value에 적재한다.
    // 행정안전부 API 응답 형식이 불확실하므로 복수의 필드명 패턴을 시도한다.
    @Transactional
    @Override
    public int replacePopulationSnapshot(UUID datasetId, List<Map<String, String>> rows) {
        UUID indicatorId = ensureIndicator(
                "resident-population",
                "행정동별 주민등록인구",
                "population",
                "명",
                "행정안전부 행정동별 성/연령별 주민등록인구 (금천구)",
                datasetId
        );

        // API 필드명 디버깅을 위해 첫 번째 행의 키를 로깅한다
        if (!rows.isEmpty()) {
            org.slf4j.LoggerFactory.getLogger(JdbcPublicDataRepository.class)
                    .info("Population API row keys: {}", rows.get(0).keySet());
        }

        // 행정동별로 그룹핑 (wide 형식이면 한 행이 한 행정동, long 형식이면 여러 행이 한 행정동)
        Map<String, List<Map<String, String>>> byDong = new java.util.LinkedHashMap<>();
        for (Map<String, String> row : rows) {
            Map<String, String> n = normalizeRow(row);
            String dongName = firstValue(n,
                    "dongNm", "admmNm", "admmcdnm", "행정동명", "읍면동명", "법정동명", "hdongNm");
            if (dongName == null || dongName.isBlank()) {
                continue;
            }
            byDong.computeIfAbsent(dongName, k -> new ArrayList<>()).add(row);
        }

        List<Object[]> batchRows = new ArrayList<>();
        String basePeriod = buildCurrentBasePeriod();

        for (Map.Entry<String, List<Map<String, String>>> entry : byDong.entrySet()) {
            String dongName = entry.getKey();
            List<Map<String, String>> dongRows = entry.getValue();

            long total = 0, male = 0, female = 0;
            long[] mBands = new long[8];
            long[] fBands = new long[8];

            if (dongRows.size() == 1) {
                // wide 형식: 한 행에 모든 인구 정보
                Map<String, String> n = normalizeRow(dongRows.get(0));
                total = toLong(firstValue(n, "totNmprCnt", "totPopltn", "총인구수", "인구합계", "계", "popltn"));
                male = toLong(firstValue(n, "maleNmprCnt", "mPopltn", "남자인구수", "남자합계", "남자"));
                female = toLong(firstValue(n, "femlNmprCnt", "fPopltn", "여자인구수", "여자합계", "여자"));
                mBands = extractWideMaleBands(n);
                fBands = extractWideFemaleBands(n);
            } else {
                // long 형식: 성별×연령대 조합으로 여러 행
                for (Map<String, String> row : dongRows) {
                    Map<String, String> n = normalizeRow(row);
                    String gender = firstValue(n, "popltnSe", "성별", "sexdstn");
                    String ageBand = firstValue(n, "agrde", "연령대", "age", "ageGroup");
                    long cnt = toLong(firstValue(n, "popltn", "인구수", "count"));
                    if ("남".equals(gender) || "male".equalsIgnoreCase(gender)) {
                        male += cnt;
                        int idx = ageBandIndex(ageBand);
                        if (idx >= 0) mBands[idx] += cnt;
                    } else if ("여".equals(gender) || "female".equalsIgnoreCase(gender)) {
                        female += cnt;
                        int idx = ageBandIndex(ageBand);
                        if (idx >= 0) fBands[idx] += cnt;
                    } else {
                        total += cnt;
                    }
                }
                if (total == 0) total = male + female;
            }

            String valueJson = buildPopulationJson(total, male, female, mBands, fBands);
            batchRows.add(new Object[]{indicatorId, dongName, total, valueJson, basePeriod});
        }

        // 유효 행이 없으면 DELETE를 실행하지 않아 기존 스냅샷을 보존한다.
        if (batchRows.isEmpty()) {
            return 0;
        }
        jdbcTemplate.update("DELETE FROM indicator_value WHERE indicator_id = ?", indicatorId);
        jdbcTemplate.batchUpdate("""
                INSERT INTO indicator_value (
                    indicator_id,
                    area_type,
                    area_name,
                    value_numeric,
                    value_json,
                    base_period,
                    data_base_time
                )
                VALUES (?, 'DONG', ?, ?, CAST(? AS jsonb), ?, CURRENT_TIMESTAMP)
                """, batchRows);
        return batchRows.size();
    }

    @Override
    public Integer latestSuccessfulSourceCount(UUID datasetId) {
        List<Integer> counts = jdbcTemplate.query(
                """
                SELECT source_record_count
                FROM dataset_collection_log
                WHERE dataset_id = ?
                  AND collection_type = 'API'
                  AND status = 'SUCCESS'
                ORDER BY finished_at DESC NULLS LAST, started_at DESC
                LIMIT 1
                """,
                (rs, rowNum) -> rs.getInt("source_record_count"),
                datasetId
        );
        return counts.isEmpty() ? null : counts.get(0);
    }

    @Override
    public List<PopulationSummary> listPopulation() {
        return jdbcTemplate.query("""
                WITH latest AS (
                    SELECT DISTINCT ON (v.area_name)
                        v.area_name,
                        v.value_numeric,
                        v.value_json,
                        v.observed_at,
                        v.data_base_time
                    FROM indicator_value v
                    JOIN indicator i ON i.indicator_id = v.indicator_id
                    WHERE i.indicator_key = 'resident-population'
                    ORDER BY v.area_name, v.data_base_time DESC NULLS LAST
                )
                SELECT area_name, value_numeric, value_json, observed_at, data_base_time
                FROM latest
                ORDER BY area_name ASC
                """, (rs, rowNum) -> mapPopulation(rs));
    }

    private PopulationSummary mapPopulation(ResultSet rs) throws SQLException {
        String areaName = rs.getString("area_name");
        long total = rs.getLong("value_numeric");
        Instant observedAt = timestampToInstant(rs.getTimestamp("observed_at"));
        if (observedAt == null) {
            observedAt = timestampToInstant(rs.getTimestamp("data_base_time"));
        }
        String observedAtText = formatInstant(observedAt);
        try {
            JsonNode json = objectMapper.readTree(rs.getString("value_json"));
            long male = json.path("male").asLong(0);
            long female = json.path("female").asLong(0);
            List<PopulationSummary.AgeBand> byAge = new ArrayList<>();
            JsonNode byAgeNode = json.path("byAge");
            if (byAgeNode.isArray()) {
                for (JsonNode band : byAgeNode) {
                    byAge.add(new PopulationSummary.AgeBand(
                            band.path("ageBand").asText(""),
                            band.path("male").asLong(0),
                            band.path("female").asLong(0)
                    ));
                }
            }
            return new PopulationSummary(areaName, total, male, female, byAge, observedAtText);
        } catch (JsonProcessingException e) {
            return new PopulationSummary(areaName, total, 0, 0, List.of(), observedAtText);
        }
    }

    private long[] extractWideMaleBands(Map<String, String> n) {
        long[] b = new long[8];
        b[0] = toLong(firstValue(n, "male0AgeNmprCnt", "만09세남자", "m0to9ppltn", "m0to9", "mage0to9"));
        b[1] = toLong(firstValue(n, "male10AgeNmprCnt", "만1019세남자", "m10to19ppltn", "m10to19", "mage10to19"));
        b[2] = toLong(firstValue(n, "male20AgeNmprCnt", "만2029세남자", "m20to29ppltn", "m20to29", "mage20to29"));
        b[3] = toLong(firstValue(n, "male30AgeNmprCnt", "만3039세남자", "m30to39ppltn", "m30to39", "mage30to39"));
        b[4] = toLong(firstValue(n, "male40AgeNmprCnt", "만4049세남자", "m40to49ppltn", "m40to49", "mage40to49"));
        b[5] = toLong(firstValue(n, "male50AgeNmprCnt", "만5059세남자", "m50to59ppltn", "m50to59", "mage50to59"));
        b[6] = toLong(firstValue(n, "male60AgeNmprCnt", "만6069세남자", "m60to69ppltn", "m60to69", "mage60to69"));
        // 70세 이상: 70~79, 80~89, 90~99, 100+ 합산
        b[7] = toLong(firstValue(n, "male70AgeNmprCnt", "만7079세남자", "m70to79ppltn", "m70to79"))
             + toLong(firstValue(n, "male80AgeNmprCnt", "만8089세남자", "m80to89ppltn", "m80to89"))
             + toLong(firstValue(n, "male90AgeNmprCnt", "만9099세남자", "m90to99ppltn", "m90to99"))
             + toLong(firstValue(n, "male100AgeNmprCnt", "만100세이상남자", "m100plusppltn", "m100plus"));
        return b;
    }

    private long[] extractWideFemaleBands(Map<String, String> n) {
        long[] b = new long[8];
        b[0] = toLong(firstValue(n, "feml0AgeNmprCnt", "만09세여자", "f0to9ppltn", "f0to9", "fage0to9"));
        b[1] = toLong(firstValue(n, "feml10AgeNmprCnt", "만1019세여자", "f10to19ppltn", "f10to19", "fage10to19"));
        b[2] = toLong(firstValue(n, "feml20AgeNmprCnt", "만2029세여자", "f20to29ppltn", "f20to29", "fage20to29"));
        b[3] = toLong(firstValue(n, "feml30AgeNmprCnt", "만3039세여자", "f30to39ppltn", "f30to39", "fage30to39"));
        b[4] = toLong(firstValue(n, "feml40AgeNmprCnt", "만4049세여자", "f40to49ppltn", "f40to49", "fage40to49"));
        b[5] = toLong(firstValue(n, "feml50AgeNmprCnt", "만5059세여자", "f50to59ppltn", "f50to59", "fage50to59"));
        b[6] = toLong(firstValue(n, "feml60AgeNmprCnt", "만6069세여자", "f60to69ppltn", "f60to69", "fage60to69"));
        b[7] = toLong(firstValue(n, "feml70AgeNmprCnt", "만7079세여자", "f70to79ppltn", "f70to79"))
             + toLong(firstValue(n, "feml80AgeNmprCnt", "만8089세여자", "f80to89ppltn", "f80to89"))
             + toLong(firstValue(n, "feml90AgeNmprCnt", "만9099세여자", "f90to99ppltn", "f90to99"))
             + toLong(firstValue(n, "feml100AgeNmprCnt", "만100세이상여자", "f100plusppltn", "f100plus"));
        return b;
    }

    private int ageBandIndex(String ageBand) {
        if (ageBand == null) return -1;
        String n = ageBand.replaceAll("[^0-9]", "");
        if (n.isEmpty()) return -1;
        int start;
        try { start = Integer.parseInt(n.length() > 3 ? n.substring(0, n.length() / 2) : n); }
        catch (NumberFormatException e) { return -1; }
        if (start < 10) return 0;
        if (start < 20) return 1;
        if (start < 30) return 2;
        if (start < 40) return 3;
        if (start < 50) return 4;
        if (start < 60) return 5;
        if (start < 70) return 6;
        return 7;
    }

    private String buildPopulationJson(long total, long male, long female, long[] mBands, long[] fBands) {
        String[] BANDS = {"0~9세", "10~19세", "20~29세", "30~39세", "40~49세", "50~59세", "60~69세", "70세 이상"};
        StringBuilder sb = new StringBuilder();
        sb.append("{\"total\":").append(total)
          .append(",\"male\":").append(male)
          .append(",\"female\":").append(female)
          .append(",\"byAge\":[");
        for (int i = 0; i < 8; i++) {
            if (i > 0) sb.append(",");
            sb.append("{\"ageBand\":\"").append(BANDS[i]).append("\"")
              .append(",\"male\":").append(mBands[i])
              .append(",\"female\":").append(fBands[i]).append("}");
        }
        sb.append("]}");
        return sb.toString();
    }

    private String buildCurrentBasePeriod() {
        LocalDate prev = LocalDate.now().minusMonths(1);
        return String.format("%d%02d", prev.getYear(), prev.getMonthValue());
    }

    private long toLong(String value) {
        if (value == null || value.isBlank()) return 0L;
        try { return Long.parseLong(value.trim().replace(",", "")); }
        catch (NumberFormatException e) { return 0L; }
    }

    private Object[] buildFacilityRowParams(UUID datasetId, String category, Map<String, String> row) {
        Map<String, String> n = normalizeRow(row);
        String name = firstValue(n,
                "stationName", "cctv_nm", "pklt_nm", "prkplceNm", "시설명", "name",
                // P4 신규: 공공와이파이(X_SWIFI_MAIN_NM), 무더위쉼터(SHTER_NM), 어린이보호구역(ZONE_NM), 전기차충전소(STAT_NM)
                // Phase 1 신규: 전통시장(mrktNm), 도시공원(PARK_NM), 도서관(LBRRY_NM), 박물관미술관(fcltyNm), 소방용수시설(fcltyNo)
                "X_SWIFI_MAIN_NM", "SHTER_NM", "ZONE_NM", "STAT_NM", "TRGET_FCLTY_NM", "mrktNm", "PARK_NM", "LBRRY_NM", "fcltyNm", "fcltyNo");
        if (name == null || name.isBlank()) {
            return null;
        }
        String originalId = firstValue(n,
                "stationId", "cctv_manage_no", "pklt_cd", "prkplceNo", "id",
                "X_SWIFI_WRDNFC_NO", "SHTER_MANAGE_NO", "STAT_ID", "sourceOriginalId");
        String description = firstValue(n,
                "rackTotCnt", "cctv_resol", "pklt_knd_nm", "pklt_se_nm", "prkplceType", "prkplceSe", "description",
                "INSTL_FLOR_INFO", "SHTER_SE_NM", "CHARGER_TYPE_NM", "PRTCAREA_RW");
        String address = firstValue(n,
                "addr", "daddr", "crd_addr", "도로명주소", "지번주소", "rdnmadr", "lnmadr", "address",
                "REFINE_ROADNM_ADDR", "ADDR");
        String lat = firstValue(n,
                "stationLatitude", "la", "lat", "위도", "latitude", "y_dnts",
                "REFINE_WGS84_LAT");
        String lon = firstValue(n,
                "stationLongitude", "lo", "lot", "lon", "경도", "longitude", "x_dnts",
                // P4 신규: LNT(공공와이파이 경도), LNG(전기차충전소 경도)
                "LNT", "LNG", "REFINE_WGS84_LOGT");
        String properties = toJson(row);
        // lon, lat 순서: ST_MakePoint(경도, 위도)
        return new Object[]{
                datasetId,
                category,
                name,
                originalId,
                description,
                address,
                lat, lon, lon, lat,
                properties
        };
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
                        log.log_id,
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

    private String normalizeOperationalStatus(String status) {
        if (status == null || status.isBlank()) {
            return "NO_ATTEMPT";
        }
        return status.trim().toUpperCase(Locale.ROOT);
    }

    private String failureType(String status, String errorMessage) {
        if ("SUCCESS".equals(status) || "NO_ATTEMPT".equals(status)) {
            return "NONE";
        }
        if ("SKIPPED".equals(status)) {
            return "POLICY_SKIPPED";
        }
        String error = safeLower(errorMessage);
        if (error.contains("quality gate") || error.contains("outside allowed") || error.contains("count change")) {
            return "QUALITY_GATE";
        }
        if (error.contains("timeout") || error.contains("timed out")) {
            return "TIMEOUT";
        }
        if (error.contains("service key") || error.contains("unauthorized") || error.contains("forbidden")
                || error.contains(" 401") || error.contains(" 403")) {
            return "AUTHORIZATION";
        }
        if (error.contains("ssl") || error.contains("connection") || error.contains("http")) {
            return "TRANSPORT";
        }
        return "COLLECTION_FAILED";
    }

    private String isoInstant(Instant instant) {
        return instant == null ? null : instant.toString();
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

        String sourceStoreId = firstValue(normalized, "bizesid", "bizesno", "상가업소번호", "store_id", "id");
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
        String districtName = firstValue(normalized, "msrstn_nm", "msrstename", "stationname", "측정소명", "district_name");
        if (districtName == null || districtName.isBlank()) {
            return null;
        }

        String districtCode = firstValue(normalized, "msrstn_pbadms_cd", "msradmcode", "측정소 행정코드", "district_code");
        String measuredAtText = firstValue(normalized, "msrmt_ymd", "msrdate", "datatime", "측정날짜", "measured_at");
        Instant observedAt = parseObservedAt(measuredAtText);
        Double maxIndex = parseDouble(firstValue(normalized, "cai", "maxindex", "khaivalue", "통합대기환경지수", "index"));
        String grade = firstValue(normalized, "cai_grd", "khaigrade", "grade", "등급");
        String pollutant = firstValue(normalized, "crst_sbstn", "pollutant", "지수결정물질");
        Double nitrogen = parseDouble(firstValue(normalized, "ntdx", "no2value", "nitrogen", "이산화질소"));
        Double ozone = parseDouble(firstValue(normalized, "ozon", "o3value", "ozone", "오존"));
        Double carbon = parseDouble(firstValue(normalized, "cbmx", "covalue", "carbon", "일산화탄소"));
        Double sulfurous = parseDouble(firstValue(normalized, "spdx", "so2value", "slfrdxd", "sulfurous", "아황산가스"));
        Double pm10 = parseDouble(firstValue(normalized, "pm", "pm10", "pm10value", "미세먼지"));
        Double pm25 = parseDouble(firstValue(normalized, "fpm", "pm25", "pm25value", "초미세먼지"));
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
        String grade = firstValue(normalized, "cai_grd", "khaigrade", "grade", "등급");
        String pollutant = firstValue(normalized, "crst_sbstn", "pollutant", "지수결정물질");
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
              parseDouble(firstValue(normalized, "ntdx", "no2value", "nitrogen", "이산화질소")),
              parseDouble(firstValue(normalized, "ozon", "o3value", "ozone", "오존")),
              parseDouble(firstValue(normalized, "cbmx", "covalue", "carbon", "일산화탄소")),
              parseDouble(firstValue(normalized, "spdx", "so2value", "slfrdxd", "sulfurous", "아황산가스")),
              parseDouble(firstValue(normalized, "pm", "pm10", "pm10value", "미세먼지")),
              parseDouble(firstValue(normalized, "fpm", "pm25", "pm25value", "초미세먼지")),
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
