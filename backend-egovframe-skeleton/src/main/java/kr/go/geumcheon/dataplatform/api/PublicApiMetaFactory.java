package kr.go.geumcheon.dataplatform.api;

import kr.go.geumcheon.dataplatform.dataset.DatasetOperationalPolicy;
import kr.go.geumcheon.dataplatform.dataset.DatasetOperationalStatusSummary;
import kr.go.geumcheon.dataplatform.dataset.DatasetPolicyRegistry;
import kr.go.geumcheon.dataplatform.publicdata.PublicDataRepository;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

public final class PublicApiMetaFactory {

    private PublicApiMetaFactory() {
    }

    public static ApiMeta forDataset(
            PublicDataRepository repository,
            String datasetKey,
            String observedAt,
            PaginationMeta pagination
    ) {
        List<DatasetOperationalStatusSummary> statuses = repository.listDatasetOperationalStatuses();
        if (statuses == null) {
            statuses = List.of();
        }
        DatasetOperationalStatusSummary status = statuses.stream()
                .filter(item -> datasetKey.equals(item.datasetKey()))
                .findFirst()
                .orElse(null);
        if (status == null) {
            return new ApiMeta("UNKNOWN", observedAt, null, null, pagination);
        }
        return new ApiMeta(
                freshnessStatus(status, Instant.now()),
                observedAt,
                status.collectedAt(),
                status.sourceName(),
                pagination
        );
    }

    public static String freshnessStatus(DatasetOperationalStatusSummary status, Instant now) {
        if (status.collectedAt() == null || status.collectedAt().isBlank()
                || "NO_SUCCESS".equals(status.dataStatus())) {
            return "NO_SUCCESS";
        }
        try {
            Instant collectedAt = Instant.parse(status.collectedAt());
            DatasetOperationalPolicy policy = DatasetPolicyRegistry.getRequired(status.datasetKey());
            Duration age = Duration.between(collectedAt, now);
            if (age.compareTo(policy.lastGoodRetention()) > 0) return "EXPIRED";
            if (age.compareTo(policy.freshnessSla()) > 0) return "STALE";
            return "AVAILABLE";
        } catch (RuntimeException ignored) {
            return status.dataStatus();
        }
    }
}
