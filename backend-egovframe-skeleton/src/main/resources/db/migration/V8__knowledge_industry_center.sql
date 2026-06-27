-- 지식산업센터 데이터셋을 카탈로그에 등록한다 (Phase 1 배치 1-A)

INSERT INTO dataset (
    dataset_key, dataset_name, domain, source_name, source_url,
    refresh_cycle, spatial_type, api_status, auth_key_required,
    env_var_name, is_public, is_active
)
VALUES (
    'knowledge-industry-center', '지식산업센터', '산업',
    '공공데이터포털 금천구 지식산업센터 정보',
    'https://www.data.go.kr/data/15034153/fileData.do',
    '비정기(자료변경시)', 'POINT', '번들 CSV 자동적재', FALSE, NULL, TRUE, TRUE
)
ON CONFLICT (dataset_key) DO UPDATE SET
    dataset_name     = EXCLUDED.dataset_name,
    domain           = EXCLUDED.domain,
    source_name      = EXCLUDED.source_name,
    source_url       = EXCLUDED.source_url,
    refresh_cycle    = EXCLUDED.refresh_cycle,
    spatial_type     = EXCLUDED.spatial_type,
    api_status       = EXCLUDED.api_status,
    auth_key_required = EXCLUDED.auth_key_required,
    env_var_name     = EXCLUDED.env_var_name,
    is_public        = EXCLUDED.is_public,
    is_active        = EXCLUDED.is_active,
    updated_at       = CURRENT_TIMESTAMP;
