package kr.go.geumcheon.dataplatform.admin;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
@Profile("mock")
public class MockStagedUploadStore implements StagedUploadStore {

    private final Map<String, StagedUploadSummary> staged = new LinkedHashMap<>();
    private final Map<String, StagedUploadMaterial> materials = new LinkedHashMap<>();

    @Override
    public synchronized StagedUploadSummary stage(String actor, UploadCommitRequest request, CsvUploadDraft draft) {
        String id = UUID.randomUUID().toString();
        Instant now = Instant.now();
        Path copy = copyContent(id, request.fileName(), draft.readContent());
        StagedUploadSummary summary = new StagedUploadSummary(
                id, request.datasetKey(), request.fileName(), draft.contentLength(), draft.rowCount(),
                draft.columnCount(), "DRAFT", null, actor, now, now.plus(30, ChronoUnit.DAYS));
        staged.put(id, summary);
        materials.put(id, new StagedUploadMaterial(
                id, null, request.datasetKey(), request.fileName(), draft.excelFile(), copy,
                draft.contentLength(), draft.contentHash(), draft.rowCount(), draft.columnCount(),
                List.copyOf(draft.headers()), Map.copyOf(request.columnMappings() == null ? Map.of() : request.columnMappings()),
                "DRAFT", actor, now, now.plus(30, ChronoUnit.DAYS)));
        return summary;
    }

    @Override
    public synchronized StagedUploadSummary linkChangeRequest(String stagedUploadId, String changeRequestId) {
        StagedUploadSummary current = require(stagedUploadId);
        StagedUploadSummary linked = new StagedUploadSummary(
                current.stagedUploadId(), current.datasetKey(), current.fileName(), current.fileSize(),
                current.rowCount(), current.columnCount(), "PENDING_REVIEW", changeRequestId,
                current.stagedBy(), current.stagedAt(), current.expiresAt());
        staged.put(stagedUploadId, linked);
        StagedUploadMaterial material = material(stagedUploadId);
        materials.put(stagedUploadId, copy(material, "PENDING_REVIEW", changeRequestId));
        return linked;
    }

    @Override
    public synchronized StagedUploadMaterial requirePendingForRequest(String changeRequestId) {
        StagedUploadMaterial found = materials.values().stream()
                .filter(item -> changeRequestId.equals(item.changeRequestId()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("승인 대기 업로드 원본을 찾을 수 없습니다."));
        if (!"PENDING_REVIEW".equals(found.status())) {
            throw new IllegalArgumentException("검토 대기 상태의 업로드만 승인 반영할 수 있습니다.");
        }
        try {
            byte[] content = Files.readAllBytes(found.contentPath());
            if (!CsvUploadDraft.sha256(content).equals(found.fileHash())) {
                throw new IllegalArgumentException("승인 대기 원본 파일 해시가 저장된 검증 정보와 다릅니다.");
            }
        } catch (IOException error) {
            throw new IllegalArgumentException("승인 대기 원본 파일을 읽을 수 없습니다.", error);
        }
        return found;
    }

    @Override
    public synchronized StagedUploadSummary markApplying(String stagedUploadId) {
        return transition(stagedUploadId, "PENDING_REVIEW", "APPLYING");
    }

    @Override
    public synchronized StagedUploadSummary markApplied(String stagedUploadId) {
        return transition(stagedUploadId, "APPLYING", "APPLIED");
    }

    @Override
    public synchronized StagedUploadSummary markRejected(String stagedUploadId) {
        StagedUploadSummary current = require(stagedUploadId);
        if (!"PENDING_REVIEW".equals(current.status()) && !"DRAFT".equals(current.status())) {
            throw new IllegalArgumentException("반려할 승인 대기 업로드를 찾을 수 없습니다.");
        }
        return putStatus(stagedUploadId, "REJECTED");
    }

    @Override
    public synchronized StagedUploadSummary markFailed(String stagedUploadId, String message) {
        return putStatus(stagedUploadId, "FAILED");
    }

    @Override
    public synchronized void discard(String stagedUploadId) {
        staged.remove(stagedUploadId);
        StagedUploadMaterial material = materials.remove(stagedUploadId);
        if (material != null) {
            try {
                Files.deleteIfExists(material.contentPath());
            } catch (IOException ignored) {
            }
        }
    }

    private StagedUploadSummary require(String id) {
        StagedUploadSummary found = staged.get(id);
        if (found == null) throw new IllegalArgumentException("승인 대기 업로드 초안을 찾을 수 없습니다.");
        return found;
    }

    private StagedUploadMaterial material(String id) {
        StagedUploadMaterial found = materials.get(id);
        if (found == null) throw new IllegalArgumentException("승인 대기 업로드 원본을 찾을 수 없습니다.");
        return found;
    }

    private StagedUploadSummary transition(String stagedUploadId, String before, String after) {
        StagedUploadSummary current = require(stagedUploadId);
        if (!before.equals(current.status())) {
            throw new IllegalArgumentException("승인 대기 업로드 상태가 올바르지 않습니다.");
        }
        return putStatus(stagedUploadId, after);
    }

    private StagedUploadSummary putStatus(String stagedUploadId, String status) {
        StagedUploadSummary current = require(stagedUploadId);
        StagedUploadSummary updated = new StagedUploadSummary(
                current.stagedUploadId(), current.datasetKey(), current.fileName(), current.fileSize(),
                current.rowCount(), current.columnCount(), status, current.changeRequestId(),
                current.stagedBy(), current.stagedAt(), current.expiresAt());
        staged.put(stagedUploadId, updated);
        materials.put(stagedUploadId, copy(material(stagedUploadId), status, current.changeRequestId()));
        return updated;
    }

    private StagedUploadMaterial copy(StagedUploadMaterial material, String status, String changeRequestId) {
        return new StagedUploadMaterial(
                material.stagedUploadId(), changeRequestId, material.datasetKey(), material.fileName(),
                material.excelFile(), material.contentPath(), material.fileSize(), material.fileHash(),
                material.rowCount(), material.columnCount(), material.headers(), material.columnMappings(),
                status, material.stagedBy(), material.stagedAt(), material.expiresAt());
    }

    private Path copyContent(String id, String fileName, byte[] content) {
        try {
            String safeName = (fileName == null ? "upload.csv" : fileName).replaceAll("[\\\\/:*?\"<>|]+", "_");
            Path target = Files.createTempFile("geumcheon-staged-" + id + "-", "-" + safeName);
            Files.write(target, content);
            return target;
        } catch (IOException error) {
            throw new IllegalStateException("승인 대기 원본 파일을 저장하지 못했습니다.", error);
        }
    }
}
