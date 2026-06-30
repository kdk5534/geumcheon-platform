package kr.go.geumcheon.dataplatform.admin;

import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public record StagedUploadMaterial(
        String stagedUploadId,
        String changeRequestId,
        String datasetKey,
        String fileName,
        boolean excelFile,
        Path contentPath,
        long fileSize,
        String fileHash,
        int rowCount,
        int columnCount,
        List<String> headers,
        Map<String, String> columnMappings,
        String status,
        String stagedBy,
        Instant stagedAt,
        Instant expiresAt
) {
}
