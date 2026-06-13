package kr.go.geumcheon.dataplatform.admin;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;

public record CsvUploadDraft(
        String uploadId,
        String datasetKey,
        String fileName,
        boolean excelFile,
        Path contentPath,
        long contentLength,
        String contentHash,
        List<String> headers,
        int rowCount,
        int columnCount,
        Instant createdAt
) {
    public boolean isExpired(Duration ttl, Instant now) {
        if (createdAt == null || ttl == null || ttl.isZero() || ttl.isNegative()) {
            return false;
        }
        return !createdAt.plus(ttl).isAfter(now);
    }

    public byte[] readContent() {
        if (contentPath == null) {
            return new byte[0];
        }
        try {
            byte[] content = Files.readAllBytes(contentPath);
            if (contentHash != null && !contentHash.isBlank()) {
                String actualHash = sha256(content);
                if (!contentHash.equals(actualHash)) {
                    throw new IllegalStateException("Upload preview content hash mismatch.");
                }
            }
            return content;
        } catch (IOException error) {
            throw new IllegalStateException("Upload preview content read failed: " + error.getMessage(), error);
        }
    }

    public void deleteContentQuietly() {
        if (contentPath == null) {
            return;
        }
        try {
            Files.deleteIfExists(contentPath);
        } catch (IOException ignored) {
        }
    }

    public static String sha256(byte[] content) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(content == null ? new byte[0] : content));
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 algorithm is not available.", error);
        }
    }
}
