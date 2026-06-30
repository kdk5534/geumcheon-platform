package kr.go.geumcheon.dataplatform.admin;

import java.time.Instant;
import java.util.Map;

public record ChangeRequestSummary(
        String requestId,
        String requestType,
        String targetType,
        String targetKey,
        String title,
        String description,
        Map<String, Object> impactSummary,
        String status,
        String requestedBy,
        Instant requestedAt,
        String reviewedBy,
        Instant reviewedAt,
        String reviewComment,
        Instant createdAt
) {
}
