-- Durable two-person approval workflow for administrator uploads.
-- The staged file is stored outside public data tables; this row contains only
-- the verified metadata and the path managed by the application.

CREATE TABLE staged_upload (
    staged_upload_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_key VARCHAR(100) NOT NULL,
    original_file_name VARCHAR(500) NOT NULL,
    stored_file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_hash VARCHAR(128) NOT NULL,
    excel_file BOOLEAN NOT NULL DEFAULT FALSE,
    row_count INTEGER NOT NULL,
    column_count INTEGER NOT NULL,
    headers JSONB NOT NULL DEFAULT '[]'::jsonb,
    column_mappings JSONB NOT NULL DEFAULT '{}'::jsonb,
    warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    change_request_id UUID UNIQUE REFERENCES change_request(request_id),
    staged_by UUID NOT NULL REFERENCES admin_user(admin_id),
    staged_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP,
    applied_at TIMESTAMP,
    rejected_at TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    failure_message TEXT,
    CONSTRAINT ck_staged_upload_status
        CHECK (status IN ('DRAFT', 'PENDING_REVIEW', 'APPLYING', 'APPLIED', 'REJECTED', 'FAILED', 'EXPIRED')),
    CONSTRAINT ck_staged_upload_counts
        CHECK (file_size >= 0 AND row_count >= 0 AND column_count >= 0)
);

CREATE INDEX idx_staged_upload_status_created
    ON staged_upload(status, staged_at DESC);
CREATE INDEX idx_staged_upload_dataset
    ON staged_upload(dataset_key, staged_at DESC);
CREATE INDEX idx_staged_upload_expires
    ON staged_upload(expires_at)
    WHERE status IN ('DRAFT', 'PENDING_REVIEW');
