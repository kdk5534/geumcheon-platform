package kr.go.geumcheon.dataplatform.admin;

import java.util.List;

public record CsvUploadDraft(
        String uploadId,
        String datasetKey,
        String fileName,
        byte[] content,
        List<String> headers,
        List<List<String>> rows
) {
}
