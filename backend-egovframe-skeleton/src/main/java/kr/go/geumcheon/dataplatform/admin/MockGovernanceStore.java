package kr.go.geumcheon.dataplatform.admin;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
@Profile("mock")
public class MockGovernanceStore implements GovernanceStore {

    private final Map<String, ChangeRequestSummary> requests = new LinkedHashMap<>();
    private final List<AuditEventSummary> events = new ArrayList<>();

    @Override
    public synchronized ChangeRequestSummary create(String actor, CreateChangeRequest request) {
        String id = UUID.randomUUID().toString();
        Instant now = Instant.now();
        ChangeRequestSummary created = new ChangeRequestSummary(
                id, request.requestType(), request.targetType(), request.targetKey(), request.title(),
                request.description(), safe(request.impactSummary()), "DRAFT", actor, null,
                null, null, null, now
        );
        requests.put(id, created);
        audit(actor, "CHANGE_REQUEST_CREATED", created, Map.of("status", "DRAFT"));
        return created;
    }

    @Override
    public synchronized ChangeRequestSummary submit(String requestId, String actor) {
        ChangeRequestSummary current = require(requestId);
        if (!actor.equals(current.requestedBy()) || !"DRAFT".equals(current.status())) {
            throw new IllegalArgumentException("본인의 초안 상태 변경 요청만 검토 요청할 수 있습니다.");
        }
        Instant now = Instant.now();
        ChangeRequestSummary updated = copy(current, "PENDING_REVIEW", now, null, null, null);
        requests.put(requestId, updated);
        audit(actor, "CHANGE_REQUEST_SUBMITTED", updated, Map.of("status", "PENDING_REVIEW"));
        return updated;
    }

    @Override
    public synchronized ChangeRequestSummary review(String requestId, String actor, boolean approve, String comment) {
        ChangeRequestSummary current = require(requestId);
        if (actor.equals(current.requestedBy())) {
            throw new IllegalArgumentException("자신이 요청한 변경은 직접 승인하거나 반려할 수 없습니다.");
        }
        if (!"PENDING_REVIEW".equals(current.status())) {
            throw new IllegalArgumentException("검토 대기 상태의 변경 요청만 처리할 수 있습니다.");
        }
        Instant now = Instant.now();
        String status = approve ? "APPROVED" : "REJECTED";
        ChangeRequestSummary updated = copy(current, status, current.requestedAt(), actor, now, comment);
        requests.put(requestId, updated);
        audit(actor, approve ? "CHANGE_REQUEST_APPROVED" : "CHANGE_REQUEST_REJECTED", updated, Map.of("status", status));
        return updated;
    }

    @Override
    public synchronized List<ChangeRequestSummary> list(String status, int limit) {
        return requests.values().stream()
                .filter(item -> status == null || status.isBlank() || status.equalsIgnoreCase(item.status()))
                .sorted(Comparator.comparing(ChangeRequestSummary::createdAt).reversed())
                .limit(limit)
                .toList();
    }

    @Override
    public synchronized List<AuditEventSummary> auditEvents(int limit) {
        return events.stream().limit(limit).toList();
    }

    @Override
    public synchronized ChangeRequestSummary require(String id) {
        ChangeRequestSummary found = requests.get(id);
        if (found == null) {
            throw new IllegalArgumentException("변경 요청을 찾을 수 없습니다.");
        }
        return found;
    }

    private ChangeRequestSummary copy(ChangeRequestSummary item, String status, Instant requestedAt,
            String reviewedBy, Instant reviewedAt, String comment) {
        return new ChangeRequestSummary(
                item.requestId(), item.requestType(), item.targetType(), item.targetKey(), item.title(),
                item.description(), item.impactSummary(), status, item.requestedBy(), requestedAt,
                reviewedBy, reviewedAt, comment, item.createdAt()
        );
    }

    private void audit(String actor, String action, ChangeRequestSummary request, Map<String, Object> after) {
        events.add(0, new AuditEventSummary(
                UUID.randomUUID().toString(), actor, action, "CHANGE_REQUEST", request.requestId(),
                request.requestId(), Map.of(), AuditValueMasker.mask(after), "SUCCESS", Instant.now()
        ));
    }

    private Map<String, Object> safe(Map<String, Object> value) {
        return value == null ? Map.of() : Map.copyOf(value);
    }
}
