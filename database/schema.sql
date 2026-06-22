-- Geumcheon Data Platform DB schema draft v0.1
-- Target DB: PostgreSQL + PostGIS

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Common code groups
CREATE TABLE code_group (
    group_id VARCHAR(50) PRIMARY KEY,
    group_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE code_item (
    group_id VARCHAR(50) NOT NULL REFERENCES code_group(group_id),
    code VARCHAR(50) NOT NULL,
    code_name VARCHAR(100) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    extra JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, code)
);

-- 2. Dataset registry
CREATE TABLE dataset (
    dataset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_key VARCHAR(100) NOT NULL UNIQUE,
    dataset_name VARCHAR(200) NOT NULL,
    domain VARCHAR(50) NOT NULL,
    source_name VARCHAR(200),
    source_url TEXT,
    license_note TEXT,
    refresh_cycle VARCHAR(50),
    spatial_type VARCHAR(30),
    api_status VARCHAR(50),
    auth_key_required BOOLEAN NOT NULL DEFAULT FALSE,
    env_var_name VARCHAR(100),
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE dataset_collection_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID NOT NULL REFERENCES dataset(dataset_id),
    collection_type VARCHAR(30) NOT NULL, -- API, CSV_UPLOAD, MANUAL, MOCK
    status VARCHAR(30) NOT NULL, -- SUCCESS, FAILED, SKIPPED
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP,
    source_record_count INTEGER,
    saved_record_count INTEGER,
    error_message TEXT,
    request_url TEXT,
    created_by VARCHAR(100)
);

CREATE INDEX idx_dataset_collection_log_dataset_id ON dataset_collection_log(dataset_id);
CREATE INDEX idx_dataset_collection_log_started_at ON dataset_collection_log(started_at DESC);

-- 3. Administrative boundaries
CREATE TABLE administrative_boundary (
    boundary_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    boundary_type VARCHAR(30) NOT NULL, -- DISTRICT, DONG, CENSUS_BLOCK, COMMERCIAL_AREA
    boundary_code VARCHAR(50) NOT NULL,
    boundary_name VARCHAR(200) NOT NULL,
    base_year VARCHAR(4),
    parent_code VARCHAR(50),
    geom GEOMETRY(MultiPolygon, 4326) NOT NULL,
    properties JSONB,
    source_dataset_id UUID REFERENCES dataset(dataset_id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (boundary_type, boundary_code, base_year)
);

CREATE INDEX idx_administrative_boundary_geom ON administrative_boundary USING GIST (geom);
CREATE INDEX idx_administrative_boundary_type_code ON administrative_boundary(boundary_type, boundary_code);

-- 4. Point facilities
CREATE TABLE facility (
    facility_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID REFERENCES dataset(dataset_id),
    facility_category VARCHAR(50) NOT NULL, -- HOSPITAL, PHARMACY, DAYCARE, PARKING, AED, etc.
    facility_subcategory VARCHAR(100),
    facility_name VARCHAR(300) NOT NULL,
    address_road VARCHAR(500),
    address_jibun VARCHAR(500),
    dong_code VARCHAR(50),
    phone VARCHAR(100),
    homepage_url TEXT,
    operating_hours TEXT,
    description TEXT,
    source_original_id VARCHAR(200),
    properties JSONB,
    geom GEOMETRY(Point, 4326),
    spatial_scope VARCHAR(30) NOT NULL DEFAULT 'EXTERNAL_REFERENCE'
        CHECK (spatial_scope IN ('GEUMCHEON', 'BORDER_AREA', 'EXTERNAL_REFERENCE')),
    data_base_time TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_facility_category ON facility(facility_category);
CREATE INDEX idx_facility_dong_code ON facility(dong_code);
CREATE INDEX idx_facility_geom ON facility USING GIST (geom);
CREATE INDEX idx_facility_source_original_id ON facility(source_original_id);
CREATE INDEX idx_facility_spatial_scope ON facility(spatial_scope);

-- 5. Realtime and periodic indicators
CREATE TABLE indicator (
    indicator_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    indicator_key VARCHAR(100) NOT NULL UNIQUE,
    indicator_name VARCHAR(200) NOT NULL,
    domain VARCHAR(50) NOT NULL,
    unit VARCHAR(50),
    description TEXT,
    source_dataset_id UUID REFERENCES dataset(dataset_id),
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE indicator_value (
    value_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    indicator_id UUID NOT NULL REFERENCES indicator(indicator_id),
    area_type VARCHAR(30), -- DISTRICT, DONG, CENSUS_BLOCK, STATION, NONE
    area_code VARCHAR(50),
    area_name VARCHAR(200),
    value_numeric NUMERIC(20, 4),
    value_text TEXT,
    value_json JSONB,
    observed_at TIMESTAMP,
    base_period VARCHAR(20), -- YYYY, YYYYMM, YYYYMMDD, YYYYMMDDHH
    data_base_time TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_indicator_value_indicator_id ON indicator_value(indicator_id);
CREATE INDEX idx_indicator_value_area ON indicator_value(area_type, area_code);
CREATE INDEX idx_indicator_value_period ON indicator_value(base_period);

-- 6. Store and commercial analysis
CREATE TABLE store_business (
    store_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID REFERENCES dataset(dataset_id),
    source_store_id VARCHAR(100),
    store_name VARCHAR(300) NOT NULL,
    branch_name VARCHAR(200),
    industry_large_code VARCHAR(50),
    industry_large_name VARCHAR(200),
    industry_middle_code VARCHAR(50),
    industry_middle_name VARCHAR(200),
    industry_small_code VARCHAR(50),
    industry_small_name VARCHAR(200),
    standard_industry_code VARCHAR(50),
    standard_industry_name VARCHAR(200),
    address_road VARCHAR(500),
    address_jibun VARCHAR(500),
    dong_code VARCHAR(50),
    geom GEOMETRY(Point, 4326),
    opened_date DATE,
    closed_date DATE,
    properties JSONB,
    data_base_time TIMESTAMP,
    spatial_scope VARCHAR(30) NOT NULL DEFAULT 'EXTERNAL_REFERENCE'
        CHECK (spatial_scope IN ('GEUMCHEON', 'BORDER_AREA', 'EXTERNAL_REFERENCE')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_store_business_industry_large ON store_business(industry_large_code);
CREATE INDEX idx_store_business_industry_middle ON store_business(industry_middle_code);
CREATE INDEX idx_store_business_industry_small ON store_business(industry_small_code);
CREATE INDEX idx_store_business_dong_code ON store_business(dong_code);
CREATE INDEX idx_store_business_geom ON store_business USING GIST (geom);
CREATE INDEX idx_store_business_spatial_scope ON store_business(spatial_scope);
CREATE INDEX idx_store_business_source_store_id ON store_business(source_store_id);

CREATE TABLE commercial_analysis_snapshot (
    snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_type VARCHAR(50) NOT NULL, -- RADIUS, DONG, CENSUS_BLOCK, COMMERCIAL_AREA
    target_area_code VARCHAR(50),
    target_area_name VARCHAR(200),
    center_geom GEOMETRY(Point, 4326),
    radius_meter INTEGER,
    industry_code VARCHAR(50),
    industry_name VARCHAR(200),
    store_count INTEGER NOT NULL DEFAULT 0,
    competitor_count INTEGER NOT NULL DEFAULT 0,
    transit_score NUMERIC(10, 2),
    population_score NUMERIC(10, 2),
    density_score NUMERIC(10, 2),
    result_json JSONB,
    base_period VARCHAR(20),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_commercial_analysis_type ON commercial_analysis_snapshot(analysis_type);
CREATE INDEX idx_commercial_analysis_center ON commercial_analysis_snapshot USING GIST (center_geom);
CREATE INDEX idx_commercial_analysis_period ON commercial_analysis_snapshot(base_period);

-- 7. Admin users
CREATE TABLE admin_user (
    admin_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    login_id VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    admin_name VARCHAR(100) NOT NULL,
    email VARCHAR(200),
    role_code VARCHAR(50) NOT NULL DEFAULT 'ADMIN',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE uploaded_file (
    file_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID REFERENCES dataset(dataset_id),
    original_file_name VARCHAR(500) NOT NULL,
    stored_file_path TEXT NOT NULL,
    file_size BIGINT,
    file_hash VARCHAR(128),
    upload_status VARCHAR(30) NOT NULL DEFAULT 'UPLOADED',
    row_count INTEGER,
    uploaded_by UUID REFERENCES admin_user(admin_id),
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    error_message TEXT
);

CREATE INDEX idx_uploaded_file_dataset_id ON uploaded_file(dataset_id);
CREATE INDEX idx_uploaded_file_uploaded_at ON uploaded_file(uploaded_at DESC);

-- 8. Display management
CREATE TABLE display_card (
    card_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_key VARCHAR(100) NOT NULL UNIQUE,
    card_title VARCHAR(200) NOT NULL,
    card_type VARCHAR(50) NOT NULL, -- INDICATOR, LINK, NOTICE, CHART
    target_indicator_key VARCHAR(100),
    link_url TEXT,
    display_json JSONB,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notice (
    notice_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(300) NOT NULL,
    content TEXT,
    source_name VARCHAR(200),
    source_url TEXT,
    published_at TIMESTAMP,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notice_published_at ON notice(published_at DESC);
