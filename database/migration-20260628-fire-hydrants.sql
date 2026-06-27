-- 소방용수시설 데이터셋을 카탈로그에 등록한다 (Phase 1 배치 1-D)
-- 수집원: 공공데이터포털 전국소방용수시설표준데이터 (tn_pubr_public_ffus_wtrcns_api)
-- 전국 약 20만 건 — signguNm/rdnmadr 기준 금천구 필터 후 저장
-- Flyway 정본: backend-egovframe-skeleton/src/main/resources/db/migration/V13__fire_hydrants.sql

INSERT INTO dataset (
    dataset_key, dataset_name, domain, source_name, source_url,
    refresh_cycle, spatial_type, api_status, auth_key_required,
    env_var_name, is_public, is_active
)
VALUES (
    'fire-hydrants', '소방용수시설', '안전',
    '공공데이터포털 전국소방용수시설표준데이터',
    'https://api.data.go.kr/openapi/tn_pubr_public_ffus_wtrcns_api',
    '연 1회', 'POINT', 'data.go.kr 표준데이터 API (좌표 포함)',
    TRUE, 'DATA_GO_KR_API_KEY', TRUE, TRUE
)
ON CONFLICT (dataset_key) DO UPDATE SET
    dataset_name      = EXCLUDED.dataset_name,
    domain            = EXCLUDED.domain,
    source_name       = EXCLUDED.source_name,
    source_url        = EXCLUDED.source_url,
    refresh_cycle     = EXCLUDED.refresh_cycle,
    spatial_type      = EXCLUDED.spatial_type,
    api_status        = EXCLUDED.api_status,
    auth_key_required = EXCLUDED.auth_key_required,
    env_var_name      = EXCLUDED.env_var_name,
    is_public         = EXCLUDED.is_public,
    is_active         = EXCLUDED.is_active,
    updated_at        = CURRENT_TIMESTAMP;
