package kr.go.geumcheon.dataplatform.admin;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Repository
@Profile("!mock")
public class JdbcAdminUploadStore implements AdminUploadStore {

    private static final List<DateTimeFormatter> POPULATION_DATE_FORMATS = List.of(
            DateTimeFormatter.ISO_LOCAL_DATE,
            DateTimeFormatter.ofPattern("yyyy/MM/dd"),
            DateTimeFormatter.ofPattern("yyyy.MM.dd"),
            DateTimeFormatter.BASIC_ISO_DATE
    );

    private static final List<DateTimeFormatter> POPULATION_MONTH_FORMATS = List.of(
            DateTimeFormatter.ofPattern("yyyy-MM"),
            DateTimeFormatter.ofPattern("yyyy/MM"),
            DateTimeFormatter.ofPattern("yyyy.MM"),
            DateTimeFormatter.ofPattern("yyyyMM")
    );

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final Path uploadBasePath;

    public JdbcAdminUploadStore(
            JdbcTemplate jdbcTemplate,
            ObjectMapper objectMapper,
            @Value("${geumcheon.upload.base-path:./uploads}") String uploadBasePath
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.uploadBasePath = Path.of(uploadBasePath);
    }

    @Override
    @Transactional
    public UploadLogSummary recordUpload(
            UploadCommitRequest request,
            AdminDatasetSummary dataset,
            int mappedColumnCount,
            CsvUploadDraft draft,
            List<List<String>> parsedRows
    ) {
        if (dataset == null) {
            throw new IllegalArgumentException("Upload commit dataset was not found.");
        }
        if (!dataset.supportsUploadCommit()) {
            throw new IllegalArgumentException("CSV upload commit is not supported for datasetKey: " + dataset.datasetKey());
        }

        UUID datasetId = ensureDataset(dataset);
        UUID fileId = UUID.randomUUID();
        UUID logId = UUID.randomUUID();
        Instant now = Instant.now();
        byte[] content = draft == null ? new byte[0] : draft.readContent();
        String storedFilePath = storeOriginalFile(fileId, request, content);
        int savedRecordCount = saveDatasetRows(datasetId, request, draft, parsedRows);
        int sourceRecordCount = draft == null ? request.rowCount() : draft.rowCount();
        // 원본 행이 있는데 저장이 0건이면 매핑이 잘못된 것이다. 트랜잭션 롤백으로 DELETE를 취소한다.
        if (sourceRecordCount > 0 && savedRecordCount == 0) {
            throw new IllegalStateException(
                    "컬럼 매핑이 실제 데이터와 일치하지 않아 저장된 행이 없습니다. 매핑 설정을 확인해 주세요.");
        }
        int sourceColumnCount = draft == null ? request.columnCount() : draft.columnCount();
        int skippedRecordCount = Math.max(0, sourceRecordCount - savedRecordCount);
        String message = "File upload committed with " + mappedColumnCount + " mapped columns; saved "
                + savedRecordCount + " of " + sourceRecordCount + " rows (" + skippedRecordCount + " skipped).";

        jdbcTemplate.update("""
                INSERT INTO uploaded_file (
                    file_id,
                    dataset_id,
                    original_file_name,
                    stored_file_path,
                    file_size,
                    file_hash,
                    upload_status,
                    row_count,
                    column_count,
                    processed_at
                )
                VALUES (?, ?, ?, ?, ?, ?, 'PROCESSED', ?, ?, CURRENT_TIMESTAMP)
                """,
                fileId,
                datasetId,
                request.fileName(),
                storedFilePath,
                content.length == 0 ? null : content.length,
                content.length == 0 ? null : sha256(content),
                sourceRecordCount,
                sourceColumnCount
        );

        jdbcTemplate.update("""
                INSERT INTO dataset_collection_log (
                    log_id,
                    dataset_id,
                    uploaded_file_id,
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
                VALUES (?, ?, ?, 'CSV_UPLOAD', 'SUCCESS', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?, ?, ?, 'admin')
                """,
                logId,
                datasetId,
                fileId,
                sourceRecordCount,
                savedRecordCount,
                message,
                request.fileName()
        );

        return new UploadLogSummary(
                logId.toString(),
                request.datasetKey(),
                dataset.datasetName(),
                request.fileName(),
                "SUCCESS",
                sourceRecordCount,
                sourceColumnCount,
                savedRecordCount,
                skippedRecordCount,
                now,
                message
        );
    }

    private String storeOriginalFile(UUID fileId, UploadCommitRequest request, byte[] content) {
        if (content == null || content.length == 0) {
            return "admin-upload://" + fileId;
        }

        String datePath = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        String safeDatasetKey = safePathPart(request.datasetKey(), "dataset");
        String safeFileName = safeFileName(request.fileName());
        Path target = uploadBasePath
                .resolve("admin-csv")
                .resolve(safeDatasetKey)
                .resolve(datePath)
                .resolve(fileId + "-" + safeFileName)
                .normalize();

        try {
            Files.createDirectories(target.getParent());
            Files.write(target, content);
            return target.toString();
        } catch (IOException error) {
            throw new IllegalStateException("Original file save failed: " + error.getMessage(), error);
        }
    }

    private String safeFileName(String fileName) {
        return safePathPart(fileName, "upload.csv");
    }

    private String safePathPart(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        String safe = value.replaceAll("[\\\\/:*?\"<>|]+", "_").trim();
        return safe.isBlank() ? fallback : safe;
    }

    private String sha256(byte[] content) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(content));
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 algorithm is not available.", error);
        }
    }

    private int saveDatasetRows(UUID datasetId, UploadCommitRequest request, CsvUploadDraft draft, List<List<String>> parsedRows) {
        if (draft == null) {
            throw new IllegalArgumentException("Upload preview data was not found. Please select the file again.");
        }

        return switch (request.datasetKey()) {
            case "facilities" -> saveFacilityRows(datasetId, request, draft, parsedRows);
            case "cctv-stations" -> saveCctvRows(datasetId, request, draft, parsedRows);
            case "stores" -> saveStoreRows(datasetId, request, draft, parsedRows);
            case "population" -> savePopulationRows(datasetId, request, draft, parsedRows);
            default -> throw new IllegalArgumentException("CSV upload commit is not supported for datasetKey: " + request.datasetKey());
        };
    }

    private int saveFacilityRows(UUID datasetId, UploadCommitRequest request, CsvUploadDraft draft, List<List<String>> parsedRows) {
        jdbcTemplate.update("DELETE FROM facility WHERE dataset_id = ?", datasetId);
        List<Object[]> batchRows = new ArrayList<>();
        for (Map<String, String> row : mappedRows(draft.headers(), parsedRows, request.columnMappings())) {
            Object[] params = buildFacilityRowParams(datasetId, row);
            if (params != null) {
                batchRows.add(params);
            }
        }
        if (!batchRows.isEmpty()) {
            jdbcTemplate.batchUpdate("""
                    INSERT INTO facility (
                        dataset_id,
                        facility_category,
                        facility_name,
                        address_road,
                        phone,
                        source_original_id,
                        geom,
                        data_base_time
                    )
                    VALUES (?, ?, ?, ?, ?, ?, CASE WHEN CAST(? AS double precision) IS NULL OR CAST(? AS double precision) IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(CAST(? AS double precision), CAST(? AS double precision)), 4326) END, CURRENT_TIMESTAMP)
                    """, batchRows);
            classifyFacilityRows(datasetId);
        }
        return batchRows.size();
    }

    private int saveCctvRows(UUID datasetId, UploadCommitRequest request, CsvUploadDraft draft, List<List<String>> parsedRows) {
        jdbcTemplate.update("DELETE FROM facility WHERE dataset_id = ?", datasetId);
        List<Object[]> batchRows = new ArrayList<>();
        for (Map<String, String> row : mappedRows(draft.headers(), parsedRows, request.columnMappings())) {
            Object[] params = buildCctvRowParams(datasetId, row);
            if (params != null) {
                batchRows.add(params);
            }
        }
        if (!batchRows.isEmpty()) {
            jdbcTemplate.batchUpdate("""
                    INSERT INTO facility (
                        dataset_id,
                        facility_category,
                        facility_name,
                        address_road,
                        phone,
                        source_original_id,
                        geom,
                        properties,
                        data_base_time
                    )
                    VALUES (?, 'CCTV', ?, ?, ?, ?, CASE WHEN CAST(? AS double precision) IS NULL OR CAST(? AS double precision) IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(CAST(? AS double precision), CAST(? AS double precision)), 4326) END, CAST(? AS jsonb), CURRENT_TIMESTAMP)
                    """, batchRows);
            classifyFacilityRows(datasetId);
        }
        return batchRows.size();
    }

    private int saveStoreRows(UUID datasetId, UploadCommitRequest request, CsvUploadDraft draft, List<List<String>> parsedRows) {
        jdbcTemplate.update("DELETE FROM store_business WHERE dataset_id = ?", datasetId);
        List<Object[]> batchRows = new ArrayList<>();
        for (Map<String, String> row : mappedRows(draft.headers(), parsedRows, request.columnMappings())) {
            Object[] params = buildStoreRowParams(datasetId, row);
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
                        industry_large_name,
                        address_road,
                        geom,
                        properties,
                        data_base_time,
                        is_active
                    )
                    VALUES (?, ?, ?, ?, ?, CASE WHEN CAST(? AS double precision) IS NULL OR CAST(? AS double precision) IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(CAST(? AS double precision), CAST(? AS double precision)), 4326) END, CAST(? AS jsonb), CURRENT_TIMESTAMP, TRUE)
                    """, batchRows);
            jdbcTemplate.update("""
                    UPDATE store_business
                    SET spatial_scope = classify_geumcheon_spatial_scope(
                        COALESCE(address_road, address_jibun),
                        geom
                    )
                    WHERE dataset_id = ?
                    """, datasetId);
        }
        return batchRows.size();
    }

    private int savePopulationRows(UUID datasetId, UploadCommitRequest request, CsvUploadDraft draft, List<List<String>> parsedRows) {
        UUID indicatorId = ensurePopulationIndicator(datasetId);
        jdbcTemplate.update("DELETE FROM indicator_value WHERE indicator_id = ?", indicatorId);
        List<Object[]> batchRows = new ArrayList<>();
        for (Map<String, String> row : mappedRows(draft.headers(), parsedRows, request.columnMappings())) {
            Object[] params = buildPopulationRowParams(indicatorId, row);
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
                    VALUES (?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, ?, CURRENT_TIMESTAMP)
                    """, batchRows);
        }
        return batchRows.size();
    }

    private List<Map<String, String>> mappedRows(List<String> headers, List<List<String>> rows, Map<String, String> mappings) {
        List<Map<String, String>> mappedRows = new ArrayList<>();
        if (headers == null || rows == null || mappings == null || mappings.isEmpty()) {
            return mappedRows;
        }

        for (List<String> row : rows) {
            Map<String, String> mapped = new LinkedHashMap<>();
            for (int index = 0; index < headers.size(); index += 1) {
                String targetField = mappings.get(headers.get(index));
                if (targetField == null || targetField.isBlank()) {
                    continue;
                }
                mapped.put(targetField, cell(row, index));
            }
            mappedRows.add(mapped);
        }
        return mappedRows;
    }

    private void classifyFacilityRows(UUID datasetId) {
        jdbcTemplate.update("""
                UPDATE facility
                SET spatial_scope = classify_geumcheon_spatial_scope(
                    COALESCE(address_road, address_jibun),
                    geom
                )
                WHERE dataset_id = ?
                """, datasetId);
    }

    private Object[] buildFacilityRowParams(UUID datasetId, Map<String, String> row) {
        String category = row.get("category");
        String name = row.get("name");
        if (isBlank(category) || isBlank(name)) {
            return null;
        }

        String address = row.get("address");
        String phone = row.get("phone");
        String sourceOriginalId = row.get("id");
        Double latitude = parseDouble(row.get("latitude"));
        Double longitude = parseDouble(row.get("longitude"));
        return new Object[] {
                datasetId,
                category,
                name,
                address,
                phone,
                sourceOriginalId,
                longitude,
                latitude,
                longitude,
                latitude
        };
    }

    private Object[] buildCctvRowParams(UUID datasetId, Map<String, String> row) {
        String id = row.get("id");
        Double latitude = parseDouble(row.get("latitude"));
        Double longitude = parseDouble(row.get("longitude"));
        if (isBlank(id) || latitude == null || longitude == null) {
            return null;
        }

        String purpose = row.get("purpose");
        String name = isBlank(purpose) ? "CCTV " + id : purpose + " CCTV " + id;
        String address = !isBlank(row.get("roadAddress")) ? row.get("roadAddress") : row.get("lotAddress");
        return new Object[] {
                datasetId,
                name,
                address,
                row.get("phone"),
                id,
                longitude,
                latitude,
                longitude,
                latitude,
                toJson(row)
        };
    }

    private Object[] buildStoreRowParams(UUID datasetId, Map<String, String> row) {
        String name = row.get("name");
        String address = row.get("address");
        if (isBlank(name) || isBlank(address)) {
            return null;
        }

        Double latitude = parseDouble(row.get("latitude"));
        Double longitude = parseDouble(row.get("longitude"));
        return new Object[] {
                datasetId,
                row.get("id"),
                name,
                row.get("category"),
                address,
                longitude,
                latitude,
                longitude,
                latitude,
                toJson(row)
        };
    }

    private Object[] buildPopulationRowParams(UUID indicatorId, Map<String, String> row) {
        String areaName = row.get("areaName");
        String baseDate = row.get("baseDate");
        BigDecimal populationTotal = parseBigDecimal(row.get("populationTotal"));
        if (isBlank(areaName) || isBlank(baseDate) || populationTotal == null) {
            return null;
        }

        Instant observedAt = parsePopulationObservedAt(baseDate);
        String areaType = areaName.endsWith("동") ? "DONG" : areaName.endsWith("구") ? "DISTRICT" : "NONE";
        return new Object[] {
                indicatorId,
                areaType,
                null,
                areaName,
                populationTotal,
                row.get("source"),
                toJson(row),
                observedAt == null ? null : Timestamp.from(observedAt),
                normalizeBasePeriod(baseDate)
        };
    }

    private String cell(List<String> row, int index) {
        if (index < 0 || index >= row.size()) {
            return null;
        }
        String value = row.get(index);
        return value == null || value.isBlank() ? null : value.trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
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

    private BigDecimal parseBigDecimal(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(value.trim().replace(",", ""));
        } catch (NumberFormatException error) {
            return null;
        }
    }

    private String toJson(Map<String, String> row) {
        try {
            return objectMapper.writeValueAsString(row);
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("Row serialization failed", error);
        }
    }

    private Instant parsePopulationObservedAt(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        for (DateTimeFormatter formatter : POPULATION_DATE_FORMATS) {
            try {
                return LocalDate.parse(trimmed, formatter).atStartOfDay().toInstant(ZoneOffset.UTC);
            } catch (DateTimeParseException ignored) {
            }
        }
        for (DateTimeFormatter formatter : POPULATION_MONTH_FORMATS) {
            try {
                return YearMonth.parse(trimmed, formatter).atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);
            } catch (DateTimeParseException ignored) {
            }
        }
        try {
            return LocalDateTime.parse(trimmed, DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")).toInstant(ZoneOffset.UTC);
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    private String normalizeBasePeriod(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String digits = value.replaceAll("[^0-9]", "");
        return digits.isBlank() ? null : digits;
    }

    @Override
    public List<UploadLogSummary> recentLogs(int limit) {
        return jdbcTemplate.query("""
                SELECT
                    log.log_id,
                    dataset.dataset_key,
                    dataset.dataset_name,
                    COALESCE(file.original_file_name, log.request_url, '-') AS file_name,
                    log.status,
                    COALESCE(log.source_record_count, 0) AS row_count,
                    COALESCE(file.column_count, 0) AS column_count,
                    COALESCE(log.saved_record_count, 0) AS saved_record_count,
                    COALESCE(log.finished_at, log.started_at) AS created_at,
                    log.error_message
                FROM dataset_collection_log log
                JOIN dataset ON dataset.dataset_id = log.dataset_id
                LEFT JOIN uploaded_file file ON file.file_id = log.uploaded_file_id
                ORDER BY log.started_at DESC
                LIMIT ?
                """, this::mapLog, Math.max(1, limit));
    }

    private UUID ensureDataset(AdminDatasetSummary dataset) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO dataset (
                    dataset_key,
                    dataset_name,
                    domain,
                    source_name,
                    refresh_cycle,
                    api_status,
                    is_public,
                    is_active
                )
                VALUES (?, ?, ?, ?, ?, ?, TRUE, TRUE)
                ON CONFLICT (dataset_key)
                DO UPDATE SET
                    dataset_name = EXCLUDED.dataset_name,
                    domain = EXCLUDED.domain,
                    source_name = EXCLUDED.source_name,
                    refresh_cycle = EXCLUDED.refresh_cycle,
                    api_status = EXCLUDED.api_status,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING dataset_id
                """,
                UUID.class,
                dataset.datasetKey(),
                dataset.datasetName(),
                dataset.domain(),
                dataset.sourceName(),
                dataset.refreshCycle(),
                dataset.uploadMode()
        );
    }

    private UUID ensurePopulationIndicator(UUID datasetId) {
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
                "resident-population",
                "Resident population",
                "population",
                "persons",
                "Resident population uploaded by admin CSV",
                datasetId
        );
    }

    private UploadLogSummary mapLog(ResultSet rs, int rowNum) throws SQLException {
        Timestamp createdAt = rs.getTimestamp("created_at");
        return new UploadLogSummary(
                rs.getString("log_id"),
                rs.getString("dataset_key"),
                rs.getString("dataset_name"),
                rs.getString("file_name"),
                rs.getString("status"),
                rs.getInt("row_count"),
                rs.getInt("column_count"),
                Math.max(0, rs.getInt("saved_record_count")),
                Math.max(0, rs.getInt("row_count") - rs.getInt("saved_record_count")),
                createdAt == null ? Instant.now() : createdAt.toInstant(),
                rs.getString("error_message")
        );
    }
}
