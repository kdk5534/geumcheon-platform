package kr.go.geumcheon.dataplatform.admin;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@Repository
@Profile("!mock")
public class JdbcGovernanceStore implements GovernanceStore {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public JdbcGovernanceStore(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    @Transactional
    public ChangeRequestSummary create(String actor, CreateChangeRequest request) {
        String requestId = jdbcTemplate.queryForObject("""
                INSERT INTO change_request (
                    request_type, target_type, target_key, title, description,
                    change_payload, impact_summary, requested_by
                )
                VALUES (?, ?, ?, ?, ?, CAST(? AS jsonb), CAST(? AS jsonb),
                    (SELECT admin_id FROM admin_user WHERE login_id = ?))
                RETURNING request_id::text
                """, String.class,
                request.requestType(), request.targetType(), request.targetKey(), request.title(), request.description(),
                json(AuditValueMasker.mask(request.changePayload())), json(request.impactSummary()), actor);
        audit(actor, "CHANGE_REQUEST_CREATED", request.targetType(), request.targetKey(), requestId,
                Map.of(), Map.of("status", "DRAFT"));
        return require(requestId);
    }

    @Override
    @Transactional
    public ChangeRequestSummary submit(String requestId, String actor) {
        ChangeRequestSummary current = require(requestId);
        if (!actor.equals(current.requestedBy()) || !"DRAFT".equals(current.status())) {
            throw new IllegalArgumentException("본인의 초안 상태 변경 요청만 검토 요청할 수 있습니다.");
        }
        jdbcTemplate.update("""
                UPDATE change_request
                SET status = 'PENDING_REVIEW', requested_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE request_id = CAST(? AS uuid) AND status = 'DRAFT'
                """, requestId);
        audit(actor, "CHANGE_REQUEST_SUBMITTED", current.targetType(), current.targetKey(), requestId,
                Map.of("status", "DRAFT"), Map.of("status", "PENDING_REVIEW"));
        return require(requestId);
    }

    @Override
    @Transactional
    public ChangeRequestSummary review(String requestId, String actor, boolean approve, String comment) {
        ChangeRequestSummary current = require(requestId);
        if (actor.equals(current.requestedBy())) {
            throw new IllegalArgumentException("자신이 요청한 변경은 직접 승인하거나 반려할 수 없습니다.");
        }
        if (!"PENDING_REVIEW".equals(current.status())) {
            throw new IllegalArgumentException("검토 대기 상태의 변경 요청만 처리할 수 있습니다.");
        }
        String status = approve ? "APPROVED" : "REJECTED";
        jdbcTemplate.update("""
                UPDATE change_request
                SET status = ?, reviewed_by = (SELECT admin_id FROM admin_user WHERE login_id = ?),
                    reviewed_at = CURRENT_TIMESTAMP, review_comment = ?, updated_at = CURRENT_TIMESTAMP
                WHERE request_id = CAST(? AS uuid) AND status = 'PENDING_REVIEW'
                """, status, actor, comment, requestId);
        audit(actor, approve ? "CHANGE_REQUEST_APPROVED" : "CHANGE_REQUEST_REJECTED",
                current.targetType(), current.targetKey(), requestId,
                Map.of("status", "PENDING_REVIEW"), Map.of("status", status));
        return require(requestId);
    }

    @Override
    public List<ChangeRequestSummary> list(String status, int limit) {
        if (status == null || status.isBlank()) {
            return jdbcTemplate.query(baseSelect() + " ORDER BY cr.created_at DESC LIMIT ?", this::mapRequest, limit);
        }
        return jdbcTemplate.query(baseSelect() + " WHERE cr.status = ? ORDER BY cr.created_at DESC LIMIT ?",
                this::mapRequest, status.toUpperCase(java.util.Locale.ROOT), limit);
    }

    @Override
    public List<AuditEventSummary> auditEvents(int limit) {
        return jdbcTemplate.query("""
                SELECT event_id::text, actor_login_id, action_code, target_type, target_key,
                       request_id::text, before_value::text, after_value::text, result_code, occurred_at
                FROM audit_event
                ORDER BY occurred_at DESC
                LIMIT ?
                """, this::mapAudit, limit);
    }

    @Override
    public ChangeRequestSummary require(String requestId) {
        List<ChangeRequestSummary> found = jdbcTemplate.query(
                baseSelect() + " WHERE cr.request_id = CAST(? AS uuid)", this::mapRequest, requestId);
        if (found.isEmpty()) {
            throw new IllegalArgumentException("변경 요청을 찾을 수 없습니다.");
        }
        return found.get(0);
    }

    private String baseSelect() {
        return """
                SELECT cr.request_id::text, cr.request_type, cr.target_type, cr.target_key,
                       cr.title, cr.description, cr.impact_summary::text, cr.status,
                       requester.login_id AS requested_by, cr.requested_at,
                       reviewer.login_id AS reviewed_by, cr.reviewed_at, cr.review_comment, cr.created_at
                FROM change_request cr
                JOIN admin_user requester ON requester.admin_id = cr.requested_by
                LEFT JOIN admin_user reviewer ON reviewer.admin_id = cr.reviewed_by
                """;
    }

    private ChangeRequestSummary mapRequest(ResultSet rs, int rowNum) throws SQLException {
        return new ChangeRequestSummary(
                rs.getString("request_id"), rs.getString("request_type"), rs.getString("target_type"),
                rs.getString("target_key"), rs.getString("title"), rs.getString("description"),
                map(rs.getString("impact_summary")), rs.getString("status"), rs.getString("requested_by"),
                instant(rs.getTimestamp("requested_at")), rs.getString("reviewed_by"),
                instant(rs.getTimestamp("reviewed_at")), rs.getString("review_comment"),
                instant(rs.getTimestamp("created_at"))
        );
    }

    private AuditEventSummary mapAudit(ResultSet rs, int rowNum) throws SQLException {
        return new AuditEventSummary(
                rs.getString("event_id"), rs.getString("actor_login_id"), rs.getString("action_code"),
                rs.getString("target_type"), rs.getString("target_key"), rs.getString("request_id"),
                map(rs.getString("before_value")), map(rs.getString("after_value")),
                rs.getString("result_code"), instant(rs.getTimestamp("occurred_at"))
        );
    }

    private void audit(String actor, String action, String targetType, String targetKey, String requestId,
            Map<String, Object> before, Map<String, Object> after) {
        jdbcTemplate.update("""
                INSERT INTO audit_event (
                    actor_admin_id, actor_login_id, action_code, target_type, target_key,
                    request_id, before_value, after_value, result_code
                )
                VALUES ((SELECT admin_id FROM admin_user WHERE login_id = ?), ?, ?, ?, ?,
                        CAST(? AS uuid), CAST(? AS jsonb), CAST(? AS jsonb), 'SUCCESS')
                """, actor, actor, action, targetType, targetKey, requestId,
                json(AuditValueMasker.mask(before)), json(AuditValueMasker.mask(after)));
    }

    private String json(Map<String, Object> value) {
        try {
            return objectMapper.writeValueAsString(value == null ? Map.of() : value);
        } catch (JsonProcessingException error) {
            throw new IllegalArgumentException("변경 내용을 JSON으로 변환할 수 없습니다.", error);
        }
    }

    private Map<String, Object> map(String value) {
        if (value == null || value.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(value, new TypeReference<>() { });
        } catch (JsonProcessingException error) {
            return Map.of();
        }
    }

    private Instant instant(Timestamp value) {
        return value == null ? null : value.toInstant();
    }
}
