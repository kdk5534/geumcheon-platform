package kr.go.geumcheon.dataplatform.publicdata;

import kr.go.geumcheon.dataplatform.dataset.DatasetOperationalPolicy;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CollectionQualityGateTest {

    @Test
    void acceptsRowsAtTheMinimumValidRatio() {
        assertThatCode(() -> CollectionQualityGate.requireValidRowRatio("stores", 10, 7))
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsRowsBelowTheMinimumBeforeSnapshotReplacement() {
        assertThatThrownBy(() -> CollectionQualityGate.requireValidRowRatio("stores", 10, 6))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("valid rows 6/10")
                .hasMessageContaining("required ratio 70%");
    }

    @Test
    void rejectsZeroSourceRows() {
        assertThatThrownBy(() -> CollectionQualityGate.requireValidRowRatio("stores", 0, 0))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("0 source rows");
    }

    @Test
    void acceptsFirstRunInsideTheProvisionalRange() {
        assertThatCode(() -> CollectionQualityGate.requireExpectedCount(policy(true), 80, null))
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsCountsOutsideRangeOrBeyondHistoricalChangeBudget() {
        assertThatThrownBy(() -> CollectionQualityGate.requireExpectedCount(policy(true), 101, null))
                .hasMessageContaining("outside 1..100");
        assertThatThrownBy(() -> CollectionQualityGate.requireExpectedCount(policy(true), 60, 100))
                .hasMessageContaining("changed 40%");
    }

    @Test
    void rejectsDisabledCandidateCollectors() {
        assertThatThrownBy(() -> CollectionQualityGate.requireExpectedCount(policy(false), 1, null))
                .hasMessageContaining("disabled by policy");
    }

    @Test
    void rejectsExpiredProvisionalApproval() {
        assertThatThrownBy(() -> CollectionQualityGate.requireExpectedCount(
                policy(true), 10, null, LocalDate.of(2026, 9, 19)
        )).hasMessageContaining("approval is not active").hasMessageContaining("2026-09-19");
    }

    private DatasetOperationalPolicy policy(boolean enabled) {
        return new DatasetOperationalPolicy(
                "sample", "id", 1, 100, 0.30,
                Duration.ofDays(1), Duration.ofDays(30), enabled,
                DatasetOperationalPolicy.TechnicalStatus.PROVISIONALLY_APPROVED,
                LocalDate.of(2026, 6, 19),
                LocalDate.of(2026, 9, 19),
                DatasetOperationalPolicy.TermsStatus.REVIEW_REQUIRED,
                DatasetOperationalPolicy.PrivacyRisk.LOW,
                DatasetOperationalPolicy.OwnerStatus.ASSIGNED,
                "데이터정책 담당부서",
                "플랫폼 운영 담당",
                "정보보안·개인정보 담당"
        );
    }
}
