-- 도서관 데이터셋을 카탈로그에 등록한다 (Phase 1 배치 1-C)
-- 수집원: 공공데이터포털 전국도서관표준데이터 (15013109, 자동승인)
-- 좌표: 응답에 LATITUDE/LONGITUDE 직접 포함 — VWorld 지오코딩 불필요
-- Flyway 정본: backend-egovframe-skeleton/src/main/resources/db/migration/V11__libraries.sql

INSERT INTO dataset (
    dataset_key, dataset_name, domain, source_name, source_url,
    refresh_cycle, spatial_type, api_status, auth_key_required,
    env_var_name, is_public, is_active
)
VALUES (
    'libraries', '도서관', '생활',
    '공공데이터포털 전국도서관표준데이터',
    'https://www.data.go.kr/data/15013109/standard.do',
    '연 1회', 'POINT', 'data.go.kr 표준데이터 API — 자동승인 (좌표 포함)',
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
