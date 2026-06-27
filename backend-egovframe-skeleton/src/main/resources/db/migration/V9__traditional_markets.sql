-- 전통시장 데이터셋을 카탈로그에 등록한다 (Phase 1 배치 1-B)
-- 수집원: 공공데이터포털 소상공인시장진흥공단 전국전통시장표준데이터 (15012894)
-- 좌표: 응답에 latitude/longitude 직접 포함 — VWorld 지오코딩 불필요

INSERT INTO dataset (
    dataset_key, dataset_name, domain, source_name, source_url,
    refresh_cycle, spatial_type, api_status, auth_key_required,
    env_var_name, is_public, is_active
)
VALUES (
    'traditional-markets', '전통시장', '상권',
    '공공데이터포털 소상공인시장진흥공단 전국전통시장표준데이터',
    'https://www.data.go.kr/data/15012894/standard.do',
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
