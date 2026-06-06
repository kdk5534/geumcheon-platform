package kr.go.geumcheon.dataplatform.publicdata;

public record ApiSourceSummary(
        String datasetKey,
        String name,
        String domain,
        String status,
        String refreshCycle,
        String targetScreen,
        String envVar,
        String source,
        String lastSynced,
        String note
) {
}
