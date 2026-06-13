package kr.go.geumcheon.dataplatform.admin;

import jakarta.annotation.PreDestroy;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

public class UploadDraftManager {

    private final Duration previewDraftTtl;
    private final int maxPreviewDrafts;
    private final Path tempDirectory;
    private final ConcurrentMap<String, CsvUploadDraft> uploadDrafts = new ConcurrentHashMap<>();

    public UploadDraftManager(Duration previewDraftTtl, int maxPreviewDrafts) {
        this(previewDraftTtl, maxPreviewDrafts, Path.of(System.getProperty("java.io.tmpdir")));
    }

    UploadDraftManager(Duration previewDraftTtl, int maxPreviewDrafts, Path tempDirectory) {
        this.previewDraftTtl = previewDraftTtl;
        this.maxPreviewDrafts = maxPreviewDrafts;
        this.tempDirectory = tempDirectory;
    }

    public CsvUploadDraft store(String datasetKey, String fileName, boolean excelFile, byte[] content, List<String> headers, int rowCount, int columnCount) {
        synchronized (uploadDrafts) {
            cleanupExpiredDraftsLocked();
            String uploadId = UUID.randomUUID().toString();
            CsvUploadDraft draft = new CsvUploadDraft(
                    uploadId,
                    datasetKey,
                    fileName,
                    excelFile,
                    writeTempContent(uploadId, fileName, content),
                    content == null ? 0 : content.length,
                    CsvUploadDraft.sha256(content),
                    List.copyOf(headers),
                    rowCount,
                    columnCount,
                    Instant.now()
            );
            uploadDrafts.put(uploadId, draft);
            trimDraftsLocked();
            return draft;
        }
    }

    public CsvUploadDraft find(String uploadId) {
        if (uploadId == null || uploadId.isBlank()) {
            return null;
        }
        return uploadDrafts.get(uploadId);
    }

    public boolean isExpired(CsvUploadDraft draft) {
        return draft != null && draft.isExpired(previewDraftTtl, Instant.now());
    }

    public void discard(String uploadId) {
        if (uploadId == null || uploadId.isBlank()) {
            return;
        }
        synchronized (uploadDrafts) {
            deleteDraftLocked(uploadId);
        }
    }

    public void cleanup() {
        synchronized (uploadDrafts) {
            cleanupExpiredDraftsLocked();
            trimDraftsLocked();
        }
    }

    @PreDestroy
    public void clear() {
        synchronized (uploadDrafts) {
            uploadDrafts.keySet().forEach(this::deleteDraftLocked);
            uploadDrafts.clear();
        }
    }

    private Path writeTempContent(String uploadId, String fileName, byte[] content) {
        try {
            Files.createDirectories(tempDirectory);
            String safeName = safeFileName(fileName);
            Path target = Files.createTempFile(tempDirectory, "geumcheon-upload-" + uploadId + "-", "-" + safeName);
            Files.write(target, content == null ? new byte[0] : content);
            return target;
        } catch (IOException error) {
            throw new IllegalStateException("Upload preview temp file save failed: " + error.getMessage(), error);
        }
    }

    private String safeFileName(String fileName) {
        if (fileName == null || fileName.isBlank()) {
            return "upload.csv";
        }
        String safe = fileName.replaceAll("[^A-Za-z0-9._-]+", "_");
        return safe.isBlank() ? "upload.csv" : safe;
    }

    private void cleanupExpiredDraftsLocked() {
        Instant now = Instant.now();
        uploadDrafts.entrySet().removeIf(entry -> {
            if (!entry.getValue().isExpired(previewDraftTtl, now)) {
                return false;
            }
            entry.getValue().deleteContentQuietly();
            return true;
        });
    }

    private void trimDraftsLocked() {
        int overflow = uploadDrafts.size() - maxPreviewDrafts;
        if (overflow <= 0) {
            return;
        }

        List<CsvUploadDraft> oldestDrafts = uploadDrafts.values().stream()
                .sorted(Comparator.comparing(CsvUploadDraft::createdAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .limit(overflow)
                .toList();
        for (CsvUploadDraft draft : oldestDrafts) {
            deleteDraftLocked(draft.uploadId());
        }
    }

    private void deleteDraftLocked(String uploadId) {
        CsvUploadDraft removed = uploadDrafts.remove(uploadId);
        if (removed != null) {
            removed.deleteContentQuietly();
        }
    }
}
