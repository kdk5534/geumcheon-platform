package kr.go.geumcheon.dataplatform.dataset;

/**
 * 공개 화면에서 최근 수집 시도와 마지막 정상 스냅샷을 혼동하지 않도록 분리한 상태 계약이다.
 */
public record DatasetOperationalStatusSummary(
        String datasetKey,
        String datasetName,
        String domain,
        String sourceName,
        String attemptStatus,
        String attemptedAt,
        int attemptSourceRecordCount,
        int attemptSavedRecordCount,
        String failureType,
        String dataStatus,
        String collectedAt,
        int lastSuccessSourceRecordCount,
        int lastSuccessSavedRecordCount
) {
}
