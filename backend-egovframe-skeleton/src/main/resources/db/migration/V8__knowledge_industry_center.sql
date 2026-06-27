-- 지식산업센터 데이터셋을 카탈로그에 등록한다 (Phase 1 배치 1-A)
-- 수집원: 공공데이터포털 한국산업단지공단 전국지식산업센터현황 (odcloud 15117154)
-- 좌표: 응답에 좌표 없음 → VWorld Geocoder 2.0으로 보완

INSERT INTO dataset (
    dataset_key, dataset_name, domain, source_name, source_url,
    refresh_cycle, spatial_type, api_status, auth_key_required,
    env_var_name, is_public, is_active
)
VALUES (
    'knowledge-industry-center', '지식산업센터', '산업',
    '공공데이터포털 한국산업단지공단 전국지식산업센터현황',
    'https://www.data.go.kr/data/15117154/openapi.do',
    '연 1회(6/30 기준)', 'POINT', 'odcloud 전국집계 API + VWorld 지오코딩',
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
