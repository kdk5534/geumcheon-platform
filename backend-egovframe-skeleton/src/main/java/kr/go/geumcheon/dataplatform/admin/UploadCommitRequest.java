package kr.go.geumcheon.dataplatform.admin;

import java.util.Map;

public record UploadCommitRequest(
        String datasetKey,
        String uploadId,
        String fileName,
        int rowCount,
        int columnCount,
        Map<String, String> columnMappings
) {
}
