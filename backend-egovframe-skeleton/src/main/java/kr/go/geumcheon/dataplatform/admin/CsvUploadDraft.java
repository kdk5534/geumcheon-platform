package kr.go.geumcheon.dataplatform.admin;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

public record CsvUploadDraft(
        String uploadId,
        String datasetKey,
        String fileName,
        byte[] content,
        List<String> headers,
        List<List<String>> rows,
        Instant createdAt
) {
    public boolean isExpired(Duration ttl, Instant now) {
        if (createdAt == null || ttl == null || ttl.isZero() || ttl.isNegative()) {
            return false;
        }
        return !createdAt.plus(ttl).isAfter(now);
    }
}
