package kr.go.geumcheon.dataplatform.admin;

import java.util.List;

public interface AdminUploadStore {
    UploadLogSummary recordUpload(
            UploadCommitRequest request,
            AdminDatasetSummary dataset,
            int mappedColumnCount,
            CsvUploadDraft draft,
            List<List<String>> parsedRows
    );

    List<UploadLogSummary> recentLogs(int limit);
}
