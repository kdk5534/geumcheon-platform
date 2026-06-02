package kr.go.geumcheon.dataplatform.admin;

public record AdminDatasetSummary(
        String datasetKey,
        String datasetName,
        String domain,
        String sourceName,
        String refreshCycle,
        String uploadMode,
        boolean requiredMapping
) {
}
