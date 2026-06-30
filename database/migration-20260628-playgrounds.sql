-- 어린이놀이시설 데이터셋을 카탈로그에 등록한다 (Phase 1 배치 1-D)
-- 수집원: 행정안전부 전국어린이놀이시설정보서비스 (getPfctInfo3)
-- 전국 약 85,000건 — 1000건씩 전 페이지 순회 후 ronaAddr/rgnCdNm 금천구 필터
-- Flyway 정본: backend-egovframe-skeleton/src/main/resources/db/migration/V16__playgrounds.sql

INSERT INTO dataset (
    dataset_key, dataset_name, domain, source_name, source_url,
    refresh_cycle, spatial_type, api_status, auth_key_required,
    env_var_name, is_public, is_active
)
VALUES (
    'playgrounds', '어린이놀이시설', '안전',
    '행정안전부 전국어린이놀이시설정보서비스',
    'https://apis.data.go.kr/1741000/pfc3/getPfctInfo3',
    '연 1회', 'POINT', 'data.go.kr 어린이놀이시설 API (좌표 포함)',
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
