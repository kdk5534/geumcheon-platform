package kr.go.geumcheon.dataplatform.admin;

import java.util.List;

public record CsvUploadPreview(
        String datasetKey,
        String uploadId,
        String fileName,
        long fileSize,
        int rowCount,
        int columnCount,
        List<String> headers,
        List<List<String>> sampleRows,
        List<String> warnings
) {
}
