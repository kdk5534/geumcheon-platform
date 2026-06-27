package kr.go.geumcheon.dataplatform.admin;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Repository
@Profile("!mock")
public class JdbcStagedUploadStore implements StagedUploadStore {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final Path stagingBasePath;
    private final long retentionDays;

    public JdbcStagedUploadStore(
            JdbcTemplate jdbcTemplate,
            ObjectMapper objectMapper,
            @Value("${geumcheon.upload.base-path:./uploads}") String uploadBasePath,
            @Value("${geumcheon.upload.staging-retention-days:30}") long retentionDays
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.stagingBasePath = Path.of(uploadBasePath).resolve("staging");
        this.retentionDays = Math.max(1, retentionDays);
    }

    @Override
    @Transactional
    public StagedUploadSummary stage(String actor, UploadCommitRequest request, CsvUploadDraft draft) {
        UUID id = UUID.randomUUID();
        byte[] content = draft.readContent();
        Path storedPath = store(id, request.fileName(), content);
        Instant expiresAt = Instant.now().plus(retentionDays, ChronoUnit.DAYS);
        try {
            jdbcTemplate.update("""
                    INSERT INTO staged_upload (
                        staged_upload_id, dataset_key, original_file_name, stored_file_path,
                        file_size, file_hash, excel_file, row_count, column_count, headers,
                        column_mappings, status, staged_by, expires_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), CAST(? AS jsonb), 'DRAFT',
                        (SELECT admin_id FROM admin_user WHERE login_id = ?), ?)
                    """, id, request.datasetKey(), request.fileName(), storedPath.toString(),
                    content.length, CsvUploadDraft.sha256(content), draft.excelFile(), draft.rowCount(), draft.columnCount(),
                    json(draft.headers()), json(request.columnMappings()), actor, Timestamp.from(expiresAt));
            return require(id.toString());
        } catch (RuntimeException error) {
            deleteQuietly(storedPath);
            throw error;
        }
    }

    @Override
    @Transactional
    public StagedUploadSummary linkChangeRequest(String stagedUploadId, String changeRequestId) {
        int changed = jdbcTemplate.update("""
                UPDATE staged_upload
                SET change_request_id = CAST(? AS uuid), status = 'PENDING_REVIEW', submitted_at = CURRENT_TIMESTAMP
                WHERE staged_upload_id = CAST(? AS uuid) AND status = 'DRAFT'
                """, changeRequestId, stagedUploadId);
        if (changed != 1) {
            throw new IllegalArgumentException("승인 대기 업로드 초안을 찾을 수 없습니다.");
        }
        return require(stagedUploadId);
    }

    @Override
    public StagedUploadMaterial requirePendingForRequest(String changeRequestId) {
        StagedUploadMaterial material = jdbcTemplate.query("""
                SELECT su.staged_upload_id::text, su.change_request_id::text, su.dataset_key,
                       su.original_file_name, su.excel_file, su.stored_file_path, su.file_size, su.file_hash,
                       su.row_count, su.column_count, su.headers::text, su.column_mappings::text,
                       su.status, au.login_id, su.staged_at, su.expires_at
                FROM staged_upload su
                JOIN admin_user au ON au.admin_id = su.staged_by
                WHERE su.change_request_id = CAST(? AS uuid)
                """, this::mapMaterial, changeRequestId).stream().findFirst()
                .orElseThrow(() -> new IllegalArgumentException("승인 대기 업로드 원본을 찾을 수 없습니다."));
        if (!"PENDING_REVIEW".equals(material.status())) {
            throw new IllegalArgumentException("검토 대기 상태의 업로드만 승인 반영할 수 있습니다.");
        }
        if (material.expiresAt() != null && material.expiresAt().isBefore(Instant.now())) {
            throw new IllegalArgumentException("승인 대기 업로드 원본의 보관 기간이 만료되었습니다.");
        }
        verifyStoredFile(material);
        return material;
    }

    @Override
    @Transactional
    public StagedUploadSummary markApplying(String stagedUploadId) {
        int changed = jdbcTemplate.update("""
                UPDATE staged_upload
                SET status = 'APPLYING'
                WHERE staged_upload_id = CAST(? AS uuid) AND status = 'PENDING_REVIEW'
                """, stagedUploadId);
        if (changed != 1) {
            throw new IllegalArgumentException("검토 대기 상태의 업로드만 적용할 수 있습니다.");
        }
        return require(stagedUploadId);
    }

    @Override
    @Transactional
    public StagedUploadSummary markApplied(String stagedUploadId) {
        int changed = jdbcTemplate.update("""
                UPDATE staged_upload
                SET status = 'APPLIED', applied_at = CURRENT_TIMESTAMP
                WHERE staged_upload_id = CAST(? AS uuid) AND status = 'APPLYING'
                """, stagedUploadId);
        if (changed != 1) {
            throw new IllegalArgumentException("적용 중 상태의 업로드만 완료 처리할 수 있습니다.");
        }
        return require(stagedUploadId);
    }

    @Override
    @Transactional
    public StagedUploadSummary markRejected(String stagedUploadId) {
        int changed = jdbcTemplate.update("""
                UPDATE staged_upload
                SET status = 'REJECTED', rejected_at = CURRENT_TIMESTAMP
                WHERE staged_upload_id = CAST(? AS uuid) AND status IN ('PENDING_REVIEW', 'DRAFT')
                """, stagedUploadId);
        if (changed != 1) {
            throw new IllegalArgumentException("반려할 승인 대기 업로드를 찾을 수 없습니다.");
        }
        return require(stagedUploadId);
    }

    @Override
    @Transactional
    public StagedUploadSummary markFailed(String stagedUploadId, String message) {
        jdbcTemplate.update("""
                UPDATE staged_upload
                SET status = 'FAILED', failure_message = ?
                WHERE staged_upload_id = CAST(? AS uuid) AND status = 'APPLYING'
                """, message, stagedUploadId);
        return require(stagedUploadId);
    }

    @Override
    public void discard(String stagedUploadId) {
        StagedUploadSummary summary = require(stagedUploadId);
        String path = jdbcTemplate.queryForObject(
                "SELECT stored_file_path FROM staged_upload WHERE staged_upload_id = CAST(? AS uuid)",
                String.class, stagedUploadId);
        jdbcTemplate.update("DELETE FROM staged_upload WHERE staged_upload_id = CAST(? AS uuid) AND status = 'DRAFT'",
                stagedUploadId);
        if ("DRAFT".equals(summary.status()) && path != null) {
            deleteQuietly(Path.of(path));
        }
    }

    private StagedUploadSummary require(String id) {
        return jdbcTemplate.query("""
                SELECT su.staged_upload_id::text, su.dataset_key, su.original_file_name, su.file_size,
                       su.row_count, su.column_count, su.status, su.change_request_id::text,
                       au.login_id, su.staged_at, su.expires_at
                FROM staged_upload su
                JOIN admin_user au ON au.admin_id = su.staged_by
                WHERE su.staged_upload_id = CAST(? AS uuid)
                """, this::map, id).stream().findFirst()
                .orElseThrow(() -> new IllegalArgumentException("승인 대기 업로드 초안을 찾을 수 없습니다."));
    }

    private StagedUploadSummary map(ResultSet rs, int rowNum) throws SQLException {
        return new StagedUploadSummary(
                rs.getString(1), rs.getString(2), rs.getString(3), rs.getLong(4), rs.getInt(5),
                rs.getInt(6), rs.getString(7), rs.getString(8), rs.getString(9),
                instant(rs.getTimestamp(10)), instant(rs.getTimestamp(11)));
    }

    private StagedUploadMaterial mapMaterial(ResultSet rs, int rowNum) throws SQLException {
        return new StagedUploadMaterial(
                rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4),
                rs.getBoolean(5), Path.of(rs.getString(6)), rs.getLong(7), rs.getString(8),
                rs.getInt(9), rs.getInt(10), readList(rs.getString(11)), readMap(rs.getString(12)),
                rs.getString(13), rs.getString(14), instant(rs.getTimestamp(15)), instant(rs.getTimestamp(16)));
    }

    private void verifyStoredFile(StagedUploadMaterial material) {
        try {
            byte[] content = Files.readAllBytes(material.contentPath());
            if (content.length != material.fileSize()) {
                throw new IllegalArgumentException("승인 대기 원본 파일 크기가 저장된 검증 정보와 다릅니다.");
            }
            String actualHash = CsvUploadDraft.sha256(content);
            if (!actualHash.equals(material.fileHash())) {
                throw new IllegalArgumentException("승인 대기 원본 파일 해시가 저장된 검증 정보와 다릅니다.");
            }
        } catch (IOException error) {
            throw new IllegalArgumentException("승인 대기 원본 파일을 읽을 수 없습니다.", error);
        }
    }

    private Path store(UUID id, String fileName, byte[] content) {
        try {
            Files.createDirectories(stagingBasePath);
            String safeName = fileName == null ? "upload.csv" : fileName.replaceAll("[\\\\/:*?\"<>|]+", "_");
            Path target = stagingBasePath.resolve(id + "-" + safeName).normalize();
            if (!target.startsWith(stagingBasePath.normalize())) {
                throw new IllegalArgumentException("안전하지 않은 업로드 파일명입니다.");
            }
            Files.write(target, content);
            return target;
        } catch (IOException error) {
            throw new IllegalStateException("승인 대기 원본 파일을 저장하지 못했습니다.", error);
        }
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value == null ? Map.of() : value);
        } catch (JsonProcessingException error) {
            throw new IllegalArgumentException("업로드 메타데이터를 저장할 수 없습니다.", error);
        }
    }

    private List<String> readList(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(value, new TypeReference<>() { });
        } catch (JsonProcessingException error) {
            throw new IllegalArgumentException("업로드 헤더 메타데이터를 읽을 수 없습니다.", error);
        }
    }

    private Map<String, String> readMap(String value) {
        if (value == null || value.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(value, new TypeReference<>() { });
        } catch (JsonProcessingException error) {
            throw new IllegalArgumentException("업로드 컬럼 매핑을 읽을 수 없습니다.", error);
        }
    }

    private Instant instant(Timestamp value) {
        return value == null ? null : value.toInstant();
    }

    private void deleteQuietly(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
        }
    }
}
