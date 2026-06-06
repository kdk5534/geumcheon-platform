package kr.go.geumcheon.dataplatform.admin;

import org.springframework.context.annotation.Profile;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Repository
@Profile("!mock")
public class JdbcAdminUploadStore implements AdminUploadStore {

    private final JdbcTemplate jdbcTemplate;
    private final Path uploadBasePath;

    public JdbcAdminUploadStore(
            JdbcTemplate jdbcTemplate,
            @Value("${geumcheon.upload.base-path:./uploads}") String uploadBasePath
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.uploadBasePath = Path.of(uploadBasePath);
    }

    @Override
    @Transactional
    public UploadLogSummary recordUpload(
            UploadCommitRequest request,
            AdminDatasetSummary dataset,
            int mappedColumnCount,
            CsvUploadDraft draft
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
        String storedFilePath = storeOriginalFile(fileId, request, draft);
        int savedRecordCount = saveDatasetRows(datasetId, request, draft);
        int sourceRecordCount = draft == null || draft.rows() == null ? request.rowCount() : draft.rows().size();
        int sourceColumnCount = draft == null || draft.headers() == null ? request.columnCount() : draft.headers().size();
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
                draft == null || draft.content() == null ? null : draft.content().length,
                draft == null || draft.content() == null ? null : sha256(draft.content()),
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

    private String storeOriginalFile(UUID fileId, UploadCommitRequest request, CsvUploadDraft draft) {
        if (draft == null || draft.content() == null || draft.content().length == 0) {
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
            Files.write(target, draft.content());
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

    private int saveDatasetRows(UUID datasetId, UploadCommitRequest request, CsvUploadDraft draft) {
        if (!"facilities".equals(request.datasetKey())) {
            throw new IllegalArgumentException("CSV upload commit is not supported for datasetKey: " + request.datasetKey());
        }
        if (draft == null) {
            throw new IllegalArgumentException("Upload preview data was not found. Please select the file again.");
        }

        jdbcTemplate.update("DELETE FROM facility WHERE dataset_id = ?", datasetId);
        Map<String, Integer> fieldIndexes = fieldIndexes(draft.headers(), request.columnMappings());
        List<Object[]> batchRows = new ArrayList<>();
        for (List<String> row : draft.rows()) {
            Object[] params = buildFacilityRowParams(datasetId, fieldIndexes, row);
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
        }
        return batchRows.size();
    }

    private Map<String, Integer> fieldIndexes(List<String> headers, Map<String, String> mappings) {
        Map<String, Integer> indexes = new LinkedHashMap<>();
        for (int index = 0; index < headers.size(); index += 1) {
            String field = mappings.get(headers.get(index));
            if (field != null && !field.isBlank()) {
                indexes.put(field, index);
            }
        }
        return indexes;
    }

    private Object[] buildFacilityRowParams(UUID datasetId, Map<String, Integer> fieldIndexes, List<String> row) {
        String category = cell(row, fieldIndexes.get("category"));
        String name = cell(row, fieldIndexes.get("name"));
        if (category == null || name == null) {
            return null;
        }

        String address = cell(row, fieldIndexes.get("address"));
        String phone = cell(row, fieldIndexes.get("phone"));
        String sourceOriginalId = cell(row, fieldIndexes.get("id"));
        Double latitude = parseDouble(cell(row, fieldIndexes.get("latitude")));
        Double longitude = parseDouble(cell(row, fieldIndexes.get("longitude")));
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

    private String cell(List<String> row, Integer index) {
        if (index == null || index < 0 || index >= row.size()) {
            return null;
        }
        String value = row.get(index);
        return value == null || value.isBlank() ? null : value.trim();
    }

    private Double parseDouble(String value) {
        if (value == null) {
            return null;
        }
        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException error) {
            return null;
        }
    }

    @Override
    public List<UploadLogSummary> recentLogs() {
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
                LIMIT 5
                """, this::mapLog);
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
