-- Admin CSV upload persistence migration
-- Apply this only when database/schema.sql was already applied before this change.

ALTER TABLE dataset_collection_log
    ADD COLUMN IF NOT EXISTS uploaded_file_id UUID;

ALTER TABLE uploaded_file
    ADD COLUMN IF NOT EXISTS column_count INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_dataset_collection_log_uploaded_file'
    ) THEN
        ALTER TABLE dataset_collection_log
            ADD CONSTRAINT fk_dataset_collection_log_uploaded_file
            FOREIGN KEY (uploaded_file_id) REFERENCES uploaded_file(file_id);
    END IF;
END $$;
