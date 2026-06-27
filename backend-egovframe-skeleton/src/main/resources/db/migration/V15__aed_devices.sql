-- AED(자동제세동기) 데이터셋을 카탈로그에 등록한다 (Phase 1 배치 1-D)
-- 수집원: 국립중앙의료원 AEDInfoInqireService/getAedLcinfoInqire
-- 금천구 중심 좌표 기준 반경 조회 후 buildAddress 금천구 필터 적용

INSERT INTO dataset (
    dataset_key, dataset_name, domain, source_name, source_url,
    refresh_cycle, spatial_type, api_status, auth_key_required,
    env_var_name, is_public, is_active
)
VALUES (
    'aed-devices', '자동제세동기(AED)', '안전',
    '국립중앙의료원 전국AED정보조회서비스',
    'https://apis.data.go.kr/B552657/AEDInfoInqireService/getAedLcinfoInqire',
    '연 1회', 'POINT', 'data.go.kr AED 좌표 조회 API (좌표 포함)',
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
