package kr.go.geumcheon.dataplatform.dataset;

import kr.go.geumcheon.dataplatform.admin.AdminDatasetSummary;
import kr.go.geumcheon.dataplatform.publicdata.PublicDataRepository;

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
        boolean publicVisible,
        List<String> requiredFields,
        List<DatasetFieldDefinition> fields,
        String sourceUrl,
        String spatialType,
        String envVarName,
        String targetScreen
) {

    public DatasetDefinition {
        requiredFields = requiredFields == null ? List.of() : List.copyOf(requiredFields);
        fields = fields == null ? List.of() : List.copyOf(fields);
    }

    public List<String> allowedFields() {
        return fields.stream().map(DatasetFieldDefinition::key).toList();
    }

    public DatasetSummary toDatasetSummary() {
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

    public AdminDatasetSummary toAdminDatasetSummary() {
        return new AdminDatasetSummary(
                datasetKey,
                datasetName,
                domain,
                sourceName,
                refreshCycle,
                uploadMode,
                requiredMapping,
                supportsUploadCommit,
                publicVisible,
                requiredFields,
                allowedFields(),
                fields
        );
    }

    public PublicDataRepository.CollectorSpec toCollectorSpec(boolean apiKeyPresent) {
        return new PublicDataRepository.CollectorSpec(
                datasetKey,
                datasetName,
                domain,
                sourceName,
                sourceUrl,
                refreshCycle,
                spatialType,
                apiStatus,
                authKeyRequired,
                envVarName,
                apiKeyPresent,
                targetScreen
        );
    }
}
