package kr.go.geumcheon.dataplatform.publicdata;

public record ApiLogSummary(
        String id,
        String sourceName,
        String domain,
        String status,
        String collectedAt,
        String duration,
        int rows,
        String targetScreen,
        String nextRun,
        String note
) {
}
