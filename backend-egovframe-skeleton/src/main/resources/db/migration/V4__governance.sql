-- Admin approval, audit, and multilingual content governance

CREATE TABLE change_request (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_type VARCHAR(50) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_key VARCHAR(200) NOT NULL,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    change_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    impact_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    requested_by UUID NOT NULL REFERENCES admin_user(admin_id),
    requested_at TIMESTAMP,
    reviewed_by UUID REFERENCES admin_user(admin_id),
    reviewed_at TIMESTAMP,
    review_comment TEXT,
    applied_at TIMESTAMP,
    rollback_payload JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_change_request_status
        CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'APPLIED', 'ROLLED_BACK'))
);

CREATE INDEX idx_change_request_status_created
    ON change_request(status, created_at DESC);
CREATE INDEX idx_change_request_target
    ON change_request(target_type, target_key);

CREATE TABLE audit_event (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_admin_id UUID REFERENCES admin_user(admin_id),
    actor_login_id VARCHAR(100),
    action_code VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_key VARCHAR(200),
    request_id UUID REFERENCES change_request(request_id),
    before_value JSONB,
    after_value JSONB,
    result_code VARCHAR(30) NOT NULL,
    client_ip VARCHAR(64),
    user_agent VARCHAR(500),
    occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_event_occurred_at ON audit_event(occurred_at DESC);
CREATE INDEX idx_audit_event_target ON audit_event(target_type, target_key);
CREATE INDEX idx_audit_event_actor ON audit_event(actor_admin_id, occurred_at DESC);

CREATE TABLE content_translation (
    translation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type VARCHAR(50) NOT NULL,
    target_key VARCHAR(200) NOT NULL,
    field_key VARCHAR(100) NOT NULL,
    language_code VARCHAR(10) NOT NULL,
    translated_text TEXT NOT NULL,
    translation_status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    reviewed_by UUID REFERENCES admin_user(admin_id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_content_translation
        UNIQUE (target_type, target_key, field_key, language_code),
    CONSTRAINT ck_content_translation_language
        CHECK (language_code IN ('ko', 'en', 'ja', 'zh-CN')),
    CONSTRAINT ck_content_translation_status
        CHECK (translation_status IN ('MISSING', 'DRAFT', 'APPROVED'))
);

CREATE INDEX idx_content_translation_review
    ON content_translation(language_code, translation_status, updated_at DESC);
