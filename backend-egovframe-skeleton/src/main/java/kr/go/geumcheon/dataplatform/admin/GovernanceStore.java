package kr.go.geumcheon.dataplatform.admin;

import java.util.List;
import java.util.Map;

public interface GovernanceStore {

    ChangeRequestSummary create(String actor, CreateChangeRequest request);

    ChangeRequestSummary submit(String requestId, String actor);

    ChangeRequestSummary review(String requestId, String actor, boolean approve, String comment);

    ChangeRequestSummary require(String requestId);

    List<ChangeRequestSummary> list(String status, int limit);

    List<AuditEventSummary> auditEvents(int limit);

    record CreateChangeRequest(
            String requestType,
            String targetType,
            String targetKey,
            String title,
            String description,
            Map<String, Object> changePayload,
            Map<String, Object> impactSummary
    ) {
    }
}
