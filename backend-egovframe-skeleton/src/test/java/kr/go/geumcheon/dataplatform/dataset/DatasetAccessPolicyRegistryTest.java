package kr.go.geumcheon.dataplatform.dataset;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DatasetAccessPolicyRegistryTest {

    @Test
    void unconfirmedTermsRemainScreenOnly() {
        DatasetAccessPolicy policy = DatasetAccessPolicyRegistry.get("school-zones");

        assertThat(policy.accessMode()).isEqualTo(DatasetAccessPolicy.AccessMode.SCREEN_ONLY);
        assertThat(policy.fileDownloadAllowed()).isFalse();
        assertThat(policy.externalApiRedistributionAllowed()).isFalse();
    }

    @Test
    void confirmedAttributionTermsCanBeSwitchedPerDataset() {
        DatasetAccessPolicy heat = DatasetAccessPolicyRegistry.get("heat-shelters");
        DatasetAccessPolicy ev = DatasetAccessPolicyRegistry.get("ev-chargers");

        assertThat(heat.fileDownloadAllowed()).isTrue();
        assertThat(ev.externalApiRedistributionAllowed()).isTrue();
        assertThat(ev.attributionNotice()).contains("금천구");
    }

    @Test
    void firstWaveLivingFacilitiesDefaultToScreenOnly() {
        assertThat(java.util.Set.of(
                "welfare-facilities", "civil-defense-shelters", "hospitals",
                "pharmacies", "childcare-centers"
        )).allSatisfy(key -> {
            DatasetAccessPolicy policy = DatasetAccessPolicyRegistry.get(key);
            assertThat(policy.accessMode()).isEqualTo(DatasetAccessPolicy.AccessMode.SCREEN_ONLY);
            assertThat(policy.fileDownloadAllowed()).isFalse();
            assertThat(policy.externalApiRedistributionAllowed()).isFalse();
        });
    }
}
