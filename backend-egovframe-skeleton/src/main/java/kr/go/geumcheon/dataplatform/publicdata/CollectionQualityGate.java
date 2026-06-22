package kr.go.geumcheon.dataplatform.publicdata;

import kr.go.geumcheon.dataplatform.dataset.DatasetOperationalPolicy;

import java.time.LocalDate;

public final class CollectionQualityGate {

    static final double DEFAULT_MIN_VALID_RATIO = 0.70d;

    private CollectionQualityGate() {
    }

    public static void requireValidRowRatio(String datasetKey, int sourceCount, int validCount) {
        requireValidRowRatio(datasetKey, sourceCount, validCount, DEFAULT_MIN_VALID_RATIO);
    }

    public static void requireExpectedCount(
            DatasetOperationalPolicy policy,
            int currentCount,
            Integer previousSuccessfulCount
    ) {
        requireExpectedCount(policy, currentCount, previousSuccessfulCount, LocalDate.now(), false);
    }

    static void requireExpectedCountWithLocalTransportOverride(
            DatasetOperationalPolicy policy,
            int currentCount,
            Integer previousSuccessfulCount
    ) {
        requireExpectedCount(policy, currentCount, previousSuccessfulCount, LocalDate.now(), true);
    }

    static void requireExpectedCount(
            DatasetOperationalPolicy policy,
            int currentCount,
            Integer previousSuccessfulCount,
            LocalDate evaluationDate
    ) {
        requireExpectedCount(policy, currentCount, previousSuccessfulCount, evaluationDate, false);
    }

    private static void requireExpectedCount(
            DatasetOperationalPolicy policy,
            int currentCount,
            Integer previousSuccessfulCount,
            LocalDate evaluationDate,
            boolean allowDisabledPolicy
    ) {
        if (!policy.collectionEnabled() && !allowDisabledPolicy) {
            throw new IllegalStateException("Collection is disabled by policy for " + policy.datasetKey() + ".");
        }
        if (!policy.isTechnicallyApprovedOn(evaluationDate)) {
            throw new IllegalStateException(
                    "Technical policy approval is not active for " + policy.datasetKey()
                            + "; review due " + policy.reviewDue() + "."
            );
        }
        if (currentCount < policy.minimumRows() || currentCount > policy.maximumRows()) {
            throw new IllegalStateException(
                    "Quality gate rejected " + policy.datasetKey()
                            + ": row count " + currentCount
                            + " is outside " + policy.minimumRows() + ".." + policy.maximumRows() + "."
            );
        }
        if (allowDisabledPolicy) return;
        if (previousSuccessfulCount == null || previousSuccessfulCount <= 0) return;

        double changeRatio = Math.abs((double) currentCount - previousSuccessfulCount) / previousSuccessfulCount;
        if (changeRatio > policy.maximumChangeRatio()) {
            throw new IllegalStateException(
                    "Quality gate rejected " + policy.datasetKey()
                            + ": row count changed " + Math.round(changeRatio * 100) + "%"
                            + " from previous successful count " + previousSuccessfulCount + "."
            );
        }
    }

    static void requireValidRowRatio(
            String datasetKey,
            int sourceCount,
            int validCount,
            double minimumRatio
    ) {
        if (sourceCount <= 0) {
            throw new IllegalStateException("Quality gate rejected 0 source rows for " + datasetKey + ".");
        }
        double validRatio = (double) validCount / sourceCount;
        if (validRatio < minimumRatio) {
            int invalidCount = Math.max(0, sourceCount - validCount);
            throw new IllegalStateException(
                    "Quality gate rejected " + datasetKey
                            + ": valid rows " + validCount + "/" + sourceCount
                            + ", invalid rows " + invalidCount
                            + ", required ratio " + Math.round(minimumRatio * 100) + "%."
            );
        }
    }
}
