package kr.go.geumcheon.dataplatform.admin;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GovernanceStoreTest {

    @Test
    void changeRequestRequiresDifferentReviewer() {
        MockGovernanceStore store = new MockGovernanceStore();
        ChangeRequestSummary draft = store.create("operator", new GovernanceStore.CreateChangeRequest(
                "DATASET_PUBLICATION", "DATASET", "facilities", "시설 데이터 공개",
                "검증된 시설 데이터 반영", Map.of("rowCount", 20), Map.of("publicRows", 20)
        ));

        ChangeRequestSummary pending = store.submit(draft.requestId(), "operator");

        assertThat(pending.status()).isEqualTo("PENDING_REVIEW");
        assertThatThrownBy(() -> store.review(draft.requestId(), "operator", true, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("직접 승인");

        ChangeRequestSummary approved = store.review(draft.requestId(), "reviewer", true, "검증 완료");
        assertThat(approved.status()).isEqualTo("APPROVED");
        assertThat(approved.reviewedBy()).isEqualTo("reviewer");
        assertThat(store.auditEvents(10)).hasSize(3);
    }

    @Test
    void auditMaskerRemovesNestedSecrets() {
        Map<String, Object> masked = AuditValueMasker.mask(Map.of(
                "name", "dataset",
                "apiToken", "raw-token",
                "settings", Map.of("password", "raw-password", "visible", true)
        ));

        assertThat(masked.get("apiToken")).isEqualTo("***");
        @SuppressWarnings("unchecked")
        Map<String, Object> settings = (Map<String, Object>) masked.get("settings");
        assertThat(settings).containsEntry("password", "***").containsEntry("visible", true);
    }
}
