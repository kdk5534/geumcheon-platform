package kr.go.geumcheon.dataplatform.admin;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Component
@Profile("mock")
public class MockAdminUploadStore implements AdminUploadStore {

    @Override
    public UploadLogSummary recordUpload(
            UploadCommitRequest request,
            AdminDatasetSummary dataset,
            int mappedColumnCount,
            CsvUploadDraft draft,
            List<List<String>> parsedRows
    ) {
        if (dataset == null) {
            throw new IllegalArgumentException("Upload commit dataset was not found.");
        }
        if (!dataset.supportsUploadCommit()) {
            throw new IllegalArgumentException("CSV upload commit is not supported for datasetKey: " + dataset.datasetKey());
        }

        int sourceRowCount = draft == null ? request.rowCount() : draft.rowCount();
        int sourceColumnCount = draft == null ? request.columnCount() : draft.columnCount();
        int savedRowCount = parsedRows == null ? sourceRowCount : parsedRows.size();

        return new UploadLogSummary(
                UUID.randomUUID().toString(),
                request.datasetKey(),
                dataset.datasetName(),
                request.fileName(),
                "SUCCESS",
                sourceRowCount,
                sourceColumnCount,
                savedRowCount,
                Math.max(0, sourceRowCount - savedRowCount),
                Instant.now(),
                "Mock upload log created with " + mappedColumnCount + " mapped columns. DB persistence is disabled in mock mode."
        );
    }

    @Override
    public List<UploadLogSummary> recentLogs(int limit) {
        return List.of(
                new UploadLogSummary(
                        "MOCK-LOG-001",
                        "facilities",
                        "생활시설 통합",
                        "sample-facilities.csv",
                        "SUCCESS",
                        3,
                        8,
                        3,
                        0,
                        Instant.now(),
                        "Frontend sample upload flow verified."
                )
        ).stream().limit(Math.max(1, limit)).toList();
    }
}
