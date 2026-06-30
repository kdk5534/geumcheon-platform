package kr.go.geumcheon.dataplatform.admin;

import kr.go.geumcheon.dataplatform.api.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
public class GovernanceController {

    private final GovernanceStore store;
    private final StagedUploadApprovalService stagedUploadApprovalService;

    public GovernanceController(GovernanceStore store, StagedUploadApprovalService stagedUploadApprovalService) {
        this.store = store;
        this.stagedUploadApprovalService = stagedUploadApprovalService;
    }

    @GetMapping("/change-requests")
    public ApiResponse<List<ChangeRequestSummary>> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "50") int limit
    ) {
        return ApiResponse.ok(store.list(status, Math.max(1, Math.min(100, limit))));
    }

    @PostMapping("/change-requests")
    public ResponseEntity<ApiResponse<ChangeRequestSummary>> create(
            @RequestBody GovernanceStore.CreateChangeRequest request,
            Authentication authentication
    ) {
        requireAnyRole(authentication, "ROLE_ADMIN", "ROLE_OPERATOR");
        if (request == null || blank(request.requestType()) || blank(request.targetType())
                || blank(request.targetKey()) || blank(request.title())) {
            return ResponseEntity.badRequest().body(ApiResponse.fail("변경 유형, 대상, 제목은 필수입니다."));
        }
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(store.create(authentication.getName(), request)));
    }

    @PostMapping("/change-requests/{requestId}/submit")
    public ApiResponse<ChangeRequestSummary> submit(
            @PathVariable String requestId,
            Authentication authentication
    ) {
        requireAnyRole(authentication, "ROLE_ADMIN", "ROLE_OPERATOR");
        return ApiResponse.ok(store.submit(requestId, authentication.getName()));
    }

    @PostMapping("/change-requests/{requestId}/approve")
    public ApiResponse<ChangeRequestSummary> approve(
            @PathVariable String requestId,
            @RequestBody(required = false) ReviewRequest review,
            Authentication authentication
    ) {
        requireAnyRole(authentication, "ROLE_ADMIN", "ROLE_REVIEWER");
        ChangeRequestSummary current = store.require(requestId);
        ensureReviewable(current, authentication.getName());
        if (isStagedUploadRequest(current)) {
            stagedUploadApprovalService.apply(current);
        }
        return ApiResponse.ok(store.review(requestId, authentication.getName(), true, comment(review)));
    }

    @PostMapping("/change-requests/{requestId}/reject")
    public ApiResponse<ChangeRequestSummary> reject(
            @PathVariable String requestId,
            @RequestBody(required = false) ReviewRequest review,
            Authentication authentication
    ) {
        requireAnyRole(authentication, "ROLE_ADMIN", "ROLE_REVIEWER");
        ChangeRequestSummary current = store.require(requestId);
        ensureReviewable(current, authentication.getName());
        ChangeRequestSummary rejected = store.review(requestId, authentication.getName(), false, comment(review));
        if (isStagedUploadRequest(current)) {
            stagedUploadApprovalService.reject(current);
        }
        return ApiResponse.ok(rejected);
    }

    @GetMapping("/audit-events")
    public ApiResponse<List<AuditEventSummary>> auditEvents(
            @RequestParam(defaultValue = "50") int limit,
            Authentication authentication
    ) {
        requireAnyRole(authentication, "ROLE_ADMIN", "ROLE_REVIEWER");
        return ApiResponse.ok(store.auditEvents(Math.max(1, Math.min(100, limit))));
    }

    private void requireAnyRole(Authentication authentication, String... roles) {
        boolean allowed = authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> java.util.Arrays.asList(roles).contains(authority.getAuthority()));
        if (!allowed) {
            throw new AccessDeniedException("이 작업에 필요한 관리자 역할이 없습니다.");
        }
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private String comment(ReviewRequest request) {
        return request == null ? null : request.comment();
    }

    private void ensureReviewable(ChangeRequestSummary request, String actor) {
        if (request == null) {
            throw new IllegalArgumentException("변경 요청을 찾을 수 없습니다.");
        }
        if (actor != null && actor.equals(request.requestedBy())) {
            throw new IllegalArgumentException("자신이 요청한 변경은 직접 승인하거나 반려할 수 없습니다.");
        }
        if (!"PENDING_REVIEW".equals(request.status())) {
            throw new IllegalArgumentException("검토 대기 상태의 변경 요청만 처리할 수 있습니다.");
        }
    }

    private boolean isStagedUploadRequest(ChangeRequestSummary request) {
        return "DATA_UPLOAD".equals(request.requestType()) && "STAGED_UPLOAD".equals(request.targetType());
    }

    public record ReviewRequest(String comment) {
    }
}
