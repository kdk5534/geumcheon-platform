package kr.go.geumcheon.dataplatform.dataset;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

class DatasetPolicyRegistryTest {

    @Test
    void everyDatasetDefinitionHasExactlyOneOperationalPolicy() {
        Set<String> definitionKeys = new DatasetRegistry().listAll().stream()
                .map(DatasetDefinition::datasetKey)
                .collect(Collectors.toSet());
        Set<String> policyKeys = DatasetPolicyRegistry.listAll().stream()
                .map(DatasetOperationalPolicy::datasetKey)
                .collect(Collectors.toSet());

        assertThat(policyKeys).isEqualTo(definitionKeys);
    }

    @Test
    void newlyApprovedSourcesPreserveCredentialAndTermsBoundaries() {
        DatasetOperationalPolicy heat = DatasetPolicyRegistry.getRequired("heat-shelters");
        assertThat(heat.collectionEnabled()).isFalse();
        assertThat(heat.technicalStatus()).isEqualTo(DatasetOperationalPolicy.TechnicalStatus.DRAFT);
        assertThat(heat.termsStatus()).isEqualTo(DatasetOperationalPolicy.TermsStatus.CONFIRMED);

        assertThat(Set.of("school-zones", "ev-chargers"))
                .allSatisfy(key -> assertThat(DatasetPolicyRegistry.getRequired(key).collectionEnabled()).isTrue());
        assertThat(DatasetPolicyRegistry.getRequired("school-zones").termsStatus())
                .isEqualTo(DatasetOperationalPolicy.TermsStatus.REVIEW_REQUIRED);
        assertThat(DatasetPolicyRegistry.getRequired("ev-chargers").termsStatus())
                .isEqualTo(DatasetOperationalPolicy.TermsStatus.CONFIRMED);
    }

    @Test
    void confirmedCollectorCandidatesUseThirtyPercentHistoricalChangeBudget() {
        DatasetOperationalPolicy stores = DatasetPolicyRegistry.getRequired("stores");
        assertThat(stores.maximumChangeRatio()).isEqualTo(0.30);
        assertThat(stores.technicalStatus()).isEqualTo(DatasetOperationalPolicy.TechnicalStatus.PROVISIONALLY_APPROVED);
        assertThat(stores.effectiveFrom()).isEqualTo(LocalDate.of(2026, 6, 19));
        assertThat(stores.reviewDue()).isEqualTo(LocalDate.of(2026, 9, 19));
        assertThat(stores.dataOwnerRole()).isEqualTo("데이터정책 담당부서");
        assertThat(stores.systemOwnerRole()).isEqualTo("플랫폼 운영 담당");
        assertThat(stores.approvalOwnerRole()).isEqualTo("정보보안·개인정보 담당");
        assertThat(stores.isTechnicallyApprovedOn(LocalDate.of(2026, 9, 18))).isTrue();
        assertThat(stores.requiresReviewOn(LocalDate.of(2026, 9, 19))).isTrue();
        assertThat(DatasetPolicyRegistry.getRequired("air-quality").freshnessSla().toHours()).isEqualTo(3);
    }

    @Test
    void approvedSecureCollectionPathsAreEnabled() {
        assertThat(Set.of("air-quality", "bike-stations", "parking-lots", "public-wifi"))
                .allSatisfy(key -> assertThat(DatasetPolicyRegistry.getRequired(key).collectionEnabled()).isTrue());
        assertThat(DatasetPolicyRegistry.getRequired("bike-stations").freshnessSla().toDays()).isEqualTo(210);
        assertThat(DatasetPolicyRegistry.getRequired("public-wifi").freshnessSla().toDays()).isEqualTo(1);
        assertThat(DatasetPolicyRegistry.getRequired("cctv-stations").collectionEnabled()).isFalse();
        DatasetOperationalPolicy parkingSpaces = DatasetPolicyRegistry.getRequired("parking-spaces");
        assertThat(parkingSpaces.collectionEnabled()).isFalse();
        assertThat(parkingSpaces.naturalKey()).isEqualTo("sourceOriginalId+coordinate");
    }

    @Test
    void libraryPolicyIsEnabledWithAnnualFreshness() {
        DatasetOperationalPolicy policy = DatasetPolicyRegistry.getRequired("libraries");
        assertThat(policy.collectionEnabled()).isTrue();
        assertThat(policy.naturalKey()).isEqualTo("name+address");
        assertThat(policy.freshnessSla().toDays()).isEqualTo(365);
        assertThat(policy.lastGoodRetention().toDays()).isGreaterThanOrEqualTo(365);
    }

    @Test
    void parkPolicyIsEnabledWithAnnualFreshness() {
        DatasetOperationalPolicy policy = DatasetPolicyRegistry.getRequired("parks");
        assertThat(policy.collectionEnabled()).isTrue();
        assertThat(policy.naturalKey()).isEqualTo("name+address");
        assertThat(policy.freshnessSla().toDays()).isEqualTo(365);
        assertThat(policy.lastGoodRetention().toDays()).isGreaterThanOrEqualTo(365);
    }

    @Test
    void traditionalMarketPolicyIsEnabledWithAnnualFreshness() {
        DatasetOperationalPolicy policy = DatasetPolicyRegistry.getRequired("traditional-markets");
        assertThat(policy.collectionEnabled()).isTrue();
        assertThat(policy.naturalKey()).isEqualTo("name+address");
        assertThat(policy.minimumRows()).isEqualTo(1);
        assertThat(policy.maximumRows()).isEqualTo(500);
        assertThat(policy.freshnessSla().toDays()).isEqualTo(365);
        assertThat(policy.lastGoodRetention().toDays()).isGreaterThanOrEqualTo(365);
    }

    @Test
    void knowledgeIndustryCenterPolicyIsEnabledWithLongRetention() {
        DatasetOperationalPolicy policy = DatasetPolicyRegistry.getRequired("knowledge-industry-center");
        assertThat(policy.collectionEnabled()).isTrue();
        assertThat(policy.naturalKey()).isEqualTo("name+address");
        assertThat(policy.minimumRows()).isEqualTo(1);
        assertThat(policy.maximumRows()).isEqualTo(500);
        assertThat(policy.lastGoodRetention().toDays()).isGreaterThanOrEqualTo(365);
    }

    @Test
    void firstWaveLivingFacilitiesUseApprovedIsolatedRelayButKeepTermsReview() {
        assertThat(Set.of(
                "welfare-facilities", "civil-defense-shelters", "hospitals",
                "pharmacies", "childcare-centers"
        )).allSatisfy(key -> {
            DatasetOperationalPolicy policy = DatasetPolicyRegistry.getRequired(key);
            assertThat(policy.collectionEnabled()).isTrue();
            assertThat(policy.technicalStatus()).isEqualTo(DatasetOperationalPolicy.TechnicalStatus.DRAFT);
            assertThat(policy.termsStatus()).isEqualTo(DatasetOperationalPolicy.TermsStatus.REVIEW_REQUIRED);
        });
    }
}
