-- 공동주택 단지 데이터셋 카탈로그 등록 (Phase 1 배치 1-E)
-- Flyway 대응: V17__apt_complexes.sql
-- 수집원: 국토교통부 아파트 매매 실거래가 API → 단지 중복 제거 → VWorld 지오코딩

INSERT INTO dataset (
    dataset_key, dataset_name, domain, source_name, source_url,
    refresh_cycle, spatial_type, api_status, auth_key_required,
    env_var_name, is_public, is_active
)
VALUES (
    'apt-complexes', '공동주택 단지', '주거',
    '국토교통부 아파트 매매 실거래가 자료 (단지 목록 추출)',
    'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade',
    '연 1회', 'POINT', 'data.go.kr 실거래 API + VWorld 지오코딩',
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
