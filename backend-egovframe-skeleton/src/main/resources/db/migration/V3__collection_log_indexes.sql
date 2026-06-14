CREATE INDEX IF NOT EXISTS idx_collection_log_type_started
    ON dataset_collection_log(collection_type, started_at DESC);
