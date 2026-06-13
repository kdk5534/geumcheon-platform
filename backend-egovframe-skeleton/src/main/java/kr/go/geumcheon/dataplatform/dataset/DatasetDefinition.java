package kr.go.geumcheon.dataplatform.dataset;

import kr.go.geumcheon.dataplatform.admin.AdminDatasetSummary;

import java.util.List;

public record DatasetDefinition(
        String datasetKey,
        String datasetName,
        String domain,
        String sourceName,
        String refreshCycle,
        String apiStatus,
        boolean authKeyRequired,
        String uploadMode,
        boolean requiredMapping,
        boolean supportsUploadCommit,
        List<String> requiredFields,
        List<String> allowedFields
) {
    public DatasetSummary toPublicSummary() {
        return new DatasetSummary(
                datasetKey,
                datasetName,
                domain,
                sourceName,
                refreshCycle,
                apiStatus,
                authKeyRequired
        );
    }

    public AdminDatasetSummary toAdminSummary() {
        return new AdminDatasetSummary(
                datasetKey,
                datasetName,
                domain,
                sourceName,
                refreshCycle,
                uploadMode,
                requiredMapping,
                supportsUploadCommit
        );
    }
}
