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
            CsvUploadDraft draft
    ) {
        if (dataset == null) {
            throw new IllegalArgumentException("Upload commit dataset was not found.");
        }
        if (!dataset.supportsUploadCommit()) {
            throw new IllegalArgumentException("CSV upload commit is not supported for datasetKey: " + dataset.datasetKey());
        }

        return new UploadLogSummary(
                UUID.randomUUID().toString(),
                request.datasetKey(),
                dataset.datasetName(),
                request.fileName(),
                "SUCCESS",
                request.rowCount(),
                request.columnCount(),
                request.rowCount(),
                0,
                Instant.now(),
                "Mock upload log created with " + mappedColumnCount + " mapped columns. DB persistence is disabled in mock mode."
        );
    }

    @Override
    public List<UploadLogSummary> recentLogs() {
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
        );
    }
}
