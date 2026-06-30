package kr.go.geumcheon.dataplatform.dataset;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DatasetContractSummaryTest {

    private final DatasetRegistry registry = new DatasetRegistry();

    @Test
    void exposesApprovedPublicContractWithoutSecretConfiguration() {
        DatasetDefinition definition = registry.getRequired("stores");
        DatasetContractSummary summary = DatasetContractSummary.from(
                definition,
                DatasetPolicyRegistry.getRequired("stores"),
                LocalDate.of(2026, 6, 19)
        );

        assertThat(summary.datasetKey()).isEqualTo("stores");
        assertThat(summary.technicallyApproved()).isTrue();
        assertThat(summary.reviewRequired()).isFalse();
        assertThat(summary.freshnessHours()).isEqualTo(24);
        assertThat(summary.lastGoodRetentionDays()).isEqualTo(30);
        assertThat(summary.requiredFields()).containsExactly("name", "address");
        assertThat(summary.toString()).doesNotContain("DATA_GO_KR_API_KEY");
    }

    @Test
    void rejectsMismatchedDefinitionAndPolicy() {
        assertThatThrownBy(() -> DatasetContractSummary.from(
                registry.getRequired("stores"),
                DatasetPolicyRegistry.getRequired("air-quality"),
                LocalDate.of(2026, 6, 19)
        )).isInstanceOf(IllegalArgumentException.class);
    }
}
