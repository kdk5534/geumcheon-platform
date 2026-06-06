package kr.go.geumcheon.dataplatform.publicdata;

import java.time.Duration;
import java.time.Instant;

public record CollectionRunResult(
        String datasetKey,
        String status,
        int fetchedCount,
        int savedCount,
        String message,
        String requestUrl,
        Instant startedAt,
        Instant finishedAt,
        Duration duration
) {
}
