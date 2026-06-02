package kr.go.geumcheon.dataplatform.admin;

import java.time.Instant;

public record UploadLogSummary(
        String logId,
        String datasetKey,
        String datasetName,
        String fileName,
        String status,
        int rowCount,
        int columnCount,
        Instant createdAt,
        String message
) {
}
