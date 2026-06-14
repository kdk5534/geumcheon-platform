package kr.go.geumcheon.dataplatform.admin;

import kr.go.geumcheon.dataplatform.dataset.DatasetFieldDefinition;

import java.util.List;

public record AdminDatasetSummary(
        String datasetKey,
        String datasetName,
        String domain,
        String sourceName,
        String refreshCycle,
        String uploadMode,
        boolean requiredMapping,
        boolean supportsUploadCommit,
        boolean publicVisible,
        List<String> requiredFields,
        List<String> allowedFields,
        List<DatasetFieldDefinition> fields
) {
}
