package kr.go.geumcheon.dataplatform.admin;

import java.time.Instant;

public record StagedUploadSummary(
        String stagedUploadId,
        String datasetKey,
        String fileName,
        long fileSize,
        int rowCount,
        int columnCount,
        String status,
        String changeRequestId,
        String stagedBy,
        Instant stagedAt,
        Instant expiresAt
) {
}

