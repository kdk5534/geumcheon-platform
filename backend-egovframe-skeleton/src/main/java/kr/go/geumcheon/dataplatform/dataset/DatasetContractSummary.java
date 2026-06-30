package kr.go.geumcheon.dataplatform.dataset;

import java.time.LocalDate;
import java.util.List;

public record DatasetContractSummary(
        String datasetKey,
        String datasetName,
        String domain,
        String sourceName,
        String sourceUrl,
        String refreshCycle,
        String spatialType,
        String apiStatus,
        boolean authKeyRequired,
        String targetScreen,
        List<String> requiredFields,
        List<DatasetFieldDefinition> fields,
        String naturalKey,
        int minimumRows,
        int maximumRows,
        double maximumChangeRatio,
        long freshnessHours,
        long lastGoodRetentionDays,
        boolean collectionEnabled,
        DatasetOperationalPolicy.TechnicalStatus technicalStatus,
        LocalDate effectiveFrom,
        LocalDate reviewDue,
        boolean technicallyApproved,
        boolean reviewRequired,
        DatasetOperationalPolicy.TermsStatus termsStatus,
        DatasetOperationalPolicy.PrivacyRisk privacyRisk,
        DatasetOperationalPolicy.OwnerStatus ownerStatus,
        String dataOwnerRole,
        String systemOwnerRole,
        String approvalOwnerRole,
        DatasetAccessPolicy.AccessMode accessMode,
        boolean fileDownloadAllowed,
        boolean externalApiRedistributionAllowed,
        String licenseName,
        String licenseUrl,
        LocalDate sourceCheckedAt,
        String attributionNotice
) {
    public DatasetContractSummary {
        requiredFields = List.copyOf(requiredFields);
        fields = List.copyOf(fields);
    }

    public static DatasetContractSummary from(
            DatasetDefinition definition,
            DatasetOperationalPolicy policy,
            LocalDate asOfDate
    ) {
        if (!definition.datasetKey().equals(policy.datasetKey())) {
            throw new IllegalArgumentException("Dataset definition and policy keys do not match");
        }
        DatasetAccessPolicy accessPolicy = DatasetAccessPolicyRegistry.get(definition.datasetKey());
        return new DatasetContractSummary(
                definition.datasetKey(),
                definition.datasetName(),
                definition.domain(),
                definition.sourceName(),
                definition.sourceUrl(),
                definition.refreshCycle(),
                definition.spatialType(),
                definition.apiStatus(),
                definition.authKeyRequired(),
                definition.targetScreen(),
                definition.requiredFields(),
                definition.fields(),
                policy.naturalKey(),
                policy.minimumRows(),
                policy.maximumRows(),
                policy.maximumChangeRatio(),
                policy.freshnessSla().toHours(),
                policy.lastGoodRetention().toDays(),
                policy.collectionEnabled(),
                policy.technicalStatus(),
                policy.effectiveFrom(),
                policy.reviewDue(),
                policy.isTechnicallyApprovedOn(asOfDate),
                policy.requiresReviewOn(asOfDate),
                policy.termsStatus(),
                policy.privacyRisk(),
                policy.ownerStatus(),
                policy.dataOwnerRole(),
                policy.systemOwnerRole(),
                policy.approvalOwnerRole(),
                accessPolicy.accessMode(),
                accessPolicy.fileDownloadAllowed(),
                accessPolicy.externalApiRedistributionAllowed(),
                accessPolicy.licenseName(),
                accessPolicy.licenseUrl(),
                accessPolicy.sourceCheckedAt(),
                accessPolicy.attributionNotice()
        );
    }
}
