-- Geumcheon Data Platform mock seed data
-- Apply after database/schema.sql

INSERT INTO dataset (
    dataset_key,
    dataset_name,
    domain,
    source_name,
    source_url,
    refresh_cycle,
    spatial_type,
    api_status,
    auth_key_required,
    env_var_name,
    is_public,
    is_active
) VALUES
    ('facilities', '생활시설 통합', '생활', '금천구 열린데이터광장', 'https://data.geumcheon.go.kr/', '수시', 'POINT', 'CSV/API', FALSE, NULL, TRUE, TRUE),
    ('stores', '상가업소 정보', '상권', '소상공인시장진흥공단', 'https://www.data.go.kr/data/15012005/openapi.do', '수시', 'POINT', 'API 가능', TRUE, 'DATA_GO_KR_API_KEY', TRUE, TRUE),
    ('air-quality', '미세먼지/초미세먼지', '실시간', '서울 열린데이터광장', 'https://data.seoul.go.kr/', '시간', 'AREA', 'API 가능', TRUE, 'SEOUL_OPEN_API_KEY', TRUE, TRUE),
    ('population', '인구 통계', '인구', '서울 열린데이터광장', 'https://data.seoul.go.kr/', '월', 'AREA', 'CSV/API', TRUE, 'SEOUL_OPEN_API_KEY', TRUE, TRUE)
ON CONFLICT (dataset_key) DO UPDATE SET
    dataset_name = EXCLUDED.dataset_name,
    domain = EXCLUDED.domain,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    refresh_cycle = EXCLUDED.refresh_cycle,
    spatial_type = EXCLUDED.spatial_type,
    api_status = EXCLUDED.api_status,
    auth_key_required = EXCLUDED.auth_key_required,
    env_var_name = EXCLUDED.env_var_name,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO facility (
    dataset_id,
    facility_category,
    facility_name,
    address_road,
    phone,
    source_original_id,
    spatial_scope,
    geom,
    data_base_time,
    properties
)
SELECT
    dataset.dataset_id,
    seed.facility_category,
    seed.facility_name,
    seed.address_road,
    seed.phone,
    seed.source_original_id,
    'GEUMCHEON',
    ST_SetSRID(ST_MakePoint(seed.longitude, seed.latitude), 4326),
    CURRENT_TIMESTAMP,
    jsonb_build_object('source', 'seed-mock')
FROM dataset
JOIN (
    VALUES
        ('병원', '금천구 보건소', '서울특별시 금천구 시흥대로73길 70', '02-2627-2422', 'FAC-101', 37.4568, 126.8954),
        ('약국', '가산디지털약국', '서울특별시 금천구 가산동', '02-0000-0000', 'FAC-102', 37.4784, 126.8839),
        ('주차장', '금천구청 공영주차장', '서울특별시 금천구 시흥대로73길 70', '02-0000-0000', 'FAC-103', 37.4556, 126.8941)
) AS seed(facility_category, facility_name, address_road, phone, source_original_id, latitude, longitude)
ON dataset.dataset_key = 'facilities'
WHERE NOT EXISTS (
    SELECT 1
    FROM facility
    WHERE facility.source_original_id = seed.source_original_id
);

INSERT INTO dataset_collection_log (
    dataset_id,
    collection_type,
    status,
    finished_at,
    source_record_count,
    saved_record_count,
    error_message,
    request_url,
    created_by
)
SELECT
    dataset_id,
    'MOCK',
    'SUCCESS',
    CURRENT_TIMESTAMP,
    3,
    3,
    NULL,
    'frontend-static/assets/data/sample-facilities.csv',
    'seed'
FROM dataset
WHERE dataset_key = 'facilities';
