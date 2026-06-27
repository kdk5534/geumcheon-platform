package kr.go.geumcheon.dataplatform.admin;

import java.time.Instant;
import java.util.Map;

public record AuditEventSummary(
        String eventId,
        String actorLoginId,
        String actionCode,
        String targetType,
        String targetKey,
        String requestId,
        Map<String, Object> beforeValue,
        Map<String, Object> afterValue,
        String resultCode,
        Instant occurredAt
) {
}
