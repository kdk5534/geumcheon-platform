package kr.go.geumcheon.dataplatform.dataset;

public record DatasetSummary(
        String datasetKey,
        String datasetName,
        String domain,
        String sourceName,
        String refreshCycle,
        String apiStatus,
        boolean authKeyRequired
) {
}

