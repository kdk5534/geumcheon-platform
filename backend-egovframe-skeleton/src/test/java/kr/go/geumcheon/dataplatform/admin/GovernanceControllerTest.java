package kr.go.geumcheon.dataplatform.admin;

import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GovernanceControllerTest {

    @Test
    void approvingStagedUploadAppliesOriginalBeforeMarkingApproved() {
        GovernanceStore store = mock(GovernanceStore.class);
        StagedUploadApprovalService approvalService = mock(StagedUploadApprovalService.class);
        GovernanceController controller = new GovernanceController(store, approvalService);
        ChangeRequestSummary pending = pending("operator");
        ChangeRequestSummary approved = new ChangeRequestSummary(
                pending.requestId(), pending.requestType(), pending.targetType(), pending.targetKey(),
                pending.title(), pending.description(), pending.impactSummary(), "APPROVED",
                pending.requestedBy(), pending.requestedAt(), "reviewer", Instant.now(), "ok", pending.createdAt());

        when(store.require("change-1")).thenReturn(pending);
        when(store.review("change-1", "reviewer", true, "ok")).thenReturn(approved);

        var response = controller.approve("change-1", new GovernanceController.ReviewRequest("ok"),
                auth("reviewer", "ROLE_REVIEWER"));

        assertThat(response.data().status()).isEqualTo("APPROVED");
        verify(approvalService).apply(pending);
        verify(store).review("change-1", "reviewer", true, "ok");
    }

    @Test
    void selfApprovalDoesNotApplyStagedUpload() {
        GovernanceStore store = mock(GovernanceStore.class);
        StagedUploadApprovalService approvalService = mock(StagedUploadApprovalService.class);
        GovernanceController controller = new GovernanceController(store, approvalService);
        ChangeRequestSummary pending = pending("operator");
        when(store.require("change-1")).thenReturn(pending);

        assertThatThrownBy(() -> controller.approve("change-1", null, auth("operator", "ROLE_REVIEWER")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("직접 승인");

        verify(approvalService, never()).apply(pending);
        verify(store, never()).review("change-1", "operator", true, null);
    }

    private ChangeRequestSummary pending(String requestedBy) {
        return new ChangeRequestSummary(
                "change-1", "DATA_UPLOAD", "STAGED_UPLOAD", "stage-1",
                "시설 데이터 공개 반영", "description", Map.of(), "PENDING_REVIEW",
                requestedBy, Instant.now(), null, null, null, Instant.now());
    }

    private UsernamePasswordAuthenticationToken auth(String name, String role) {
        return new UsernamePasswordAuthenticationToken(
                name, "n/a", List.of(new SimpleGrantedAuthority(role)));
    }
}
