package kr.go.geumcheon.dataplatform.dataset;

import java.time.Duration;
import java.time.LocalDate;

public record DatasetOperationalPolicy(
        String datasetKey,
        String naturalKey,
        int minimumRows,
        int maximumRows,
        double maximumChangeRatio,
        Duration freshnessSla,
        Duration lastGoodRetention,
        boolean collectionEnabled,
        TechnicalStatus technicalStatus,
        LocalDate effectiveFrom,
        LocalDate reviewDue,
        TermsStatus termsStatus,
        PrivacyRisk privacyRisk,
        OwnerStatus ownerStatus,
        String dataOwnerRole,
        String systemOwnerRole,
        String approvalOwnerRole
) {
    public DatasetOperationalPolicy {
        if (datasetKey == null || datasetKey.isBlank()) throw new IllegalArgumentException("datasetKey is required");
        if (naturalKey == null || naturalKey.isBlank()) throw new IllegalArgumentException("naturalKey is required");
        if (minimumRows < 0 || maximumRows < minimumRows) throw new IllegalArgumentException("invalid row range");
        if (maximumChangeRatio < 0 || maximumChangeRatio > 1) throw new IllegalArgumentException("invalid change ratio");
        if (freshnessSla == null || freshnessSla.isNegative() || freshnessSla.isZero()) throw new IllegalArgumentException("freshnessSla is required");
        if (lastGoodRetention == null || lastGoodRetention.isNegative() || lastGoodRetention.isZero()) throw new IllegalArgumentException("lastGoodRetention is required");
        if (technicalStatus == null) throw new IllegalArgumentException("technicalStatus is required");
        if (effectiveFrom == null || reviewDue == null || reviewDue.isBefore(effectiveFrom)) throw new IllegalArgumentException("invalid policy review period");
        if (termsStatus == null || privacyRisk == null || ownerStatus == null) throw new IllegalArgumentException("policy statuses are required");
        if (isBlank(dataOwnerRole) || isBlank(systemOwnerRole) || isBlank(approvalOwnerRole)) throw new IllegalArgumentException("owner roles are required");
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    public boolean isTechnicallyApprovedOn(LocalDate date) {
        if (date == null || date.isBefore(effectiveFrom)) return false;
        return technicalStatus == TechnicalStatus.APPROVED
                || (technicalStatus == TechnicalStatus.PROVISIONALLY_APPROVED && date.isBefore(reviewDue));
    }

    public boolean requiresReviewOn(LocalDate date) {
        return !isTechnicallyApprovedOn(date);
    }

    public enum TechnicalStatus {
        DRAFT,
        PROVISIONALLY_APPROVED,
        APPROVED
    }

    public enum TermsStatus {
        REVIEW_REQUIRED,
        CONFIRMED
    }

    public enum PrivacyRisk {
        LOW,
        REVIEW_REQUIRED
    }

    public enum OwnerStatus {
        UNASSIGNED,
        ASSIGNED
    }
}
