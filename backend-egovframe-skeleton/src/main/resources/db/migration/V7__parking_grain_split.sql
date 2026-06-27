-- 레거시 주차 공간 포인트 데이터를 공식 주차장 시설 데이터와 분리한다

INSERT INTO dataset (
    dataset_key, dataset_name, domain, source_name, source_url,
    refresh_cycle, spatial_type, api_status, auth_key_required,
    env_var_name, is_public, is_active
)
VALUES (
    'parking-spaces', '서울 주차 공간 참고자료', '교통',
    '서울 열린데이터광장 구 주차 원천', 'https://data.seoul.go.kr/',
    '갱신 중단', 'POINT', 'REFERENCE_ONLY', FALSE, NULL, TRUE, TRUE
)
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
    is_public = EXCLUDED.is_public,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

UPDATE dataset
SET dataset_name = '전국주차장정보표준데이터(금천구)',
    source_name = '공공데이터포털 전국주차장정보표준데이터',
    source_url = 'https://www.data.go.kr/data/15012896/standard.do',
    refresh_cycle = '매일',
    spatial_type = 'POINT',
    api_status = 'FACILITY_BASELINE',
    updated_at = CURRENT_TIMESTAMP
WHERE dataset_key = 'parking-lots';

WITH legacy_dataset AS (
    SELECT dataset_id FROM dataset WHERE dataset_key = 'parking-spaces'
), official_dataset AS (
    SELECT dataset_id FROM dataset WHERE dataset_key = 'parking-lots'
)
UPDATE facility facility_row
SET dataset_id = legacy_dataset.dataset_id,
    facility_category = 'PARKING_SPACE_REFERENCE',
    properties = COALESCE(facility_row.properties, '{}'::jsonb)
        || jsonb_build_object(
            'dataGrain', 'PARKING_SPACE_POINT',
            'officialStatistic', false,
            'supersededBy', 'parking-lots'
        ),
    updated_at = CURRENT_TIMESTAMP
FROM legacy_dataset, official_dataset
WHERE facility_row.dataset_id = official_dataset.dataset_id
  AND COALESCE(facility_row.properties, '{}'::jsonb) ? 'PKLT_CD';

-- Keep the failed official 25-row transition attempt on parking-lots, but move
-- the old successful 131-row baseline so different grains are never compared.
WITH legacy_dataset AS (
    SELECT dataset_id FROM dataset WHERE dataset_key = 'parking-spaces'
), official_dataset AS (
    SELECT dataset_id FROM dataset WHERE dataset_key = 'parking-lots'
)
UPDATE dataset_collection_log collection_log
SET dataset_id = legacy_dataset.dataset_id
FROM legacy_dataset, official_dataset
WHERE collection_log.dataset_id = official_dataset.dataset_id
  AND collection_log.status = 'SUCCESS'
  AND (
      collection_log.source_record_count = 131
      OR COALESCE(collection_log.request_url, '') ILIKE '%openapi.seoul.go.kr%'
  );

CREATE INDEX IF NOT EXISTS idx_facility_parking_reference
    ON facility(dataset_id, facility_category)
    WHERE facility_category = 'PARKING_SPACE_REFERENCE';
