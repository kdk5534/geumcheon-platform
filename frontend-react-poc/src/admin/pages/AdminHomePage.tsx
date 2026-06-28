// 관리자 홈 대시보드 — 등록된 데이터셋 목록을 카드로 표시하며 인증 검증을 겸합니다
import { useEffect, useState } from "react";
import { fetchAdminJson } from "../adminApi";
import type { AdminApiPayload } from "../adminApi";
import { BACKEND_API_BASE } from "../../data/env";
import { useAdminAuth } from "../AdminAuthContext";

interface AdminDatasetSummary {
  datasetKey: string;
  datasetName: string;
  domain: string;
  sourceName: string;
  refreshCycle: string;
  uploadMode: string;
  supportsUploadCommit: boolean;
  publicVisible: boolean;
}

export function AdminHomePage() {
  const { logout } = useAdminAuth();
  const [datasets, setDatasets] = useState<AdminDatasetSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminJson<AdminApiPayload<AdminDatasetSummary[]>>(
      `${BACKEND_API_BASE}/api/admin/datasets`,
    )
      .then((payload) => setDatasets(payload.data))
      .catch((err: unknown) => {
        const status = (err as { status?: number }).status;
        if (status === 401) {
          // 세션 만료 — 로그인 화면으로 전환
          void logout();
        } else {
          setLoadError("데이터셋 목록을 불러올 수 없습니다.");
        }
      });
  }, [logout]);

  return (
    <section className="gdp-admin-home" aria-labelledby="admin-home-title">
      <h2 id="admin-home-title" className="gdp-admin-section-title">
        데이터셋 목록
      </h2>

      {loadError ? (
        <p className="gdp-admin-load-error" role="alert">
          {loadError}
        </p>
      ) : datasets === null ? (
        <p className="gdp-admin-loading-text" role="status">
          목록을 불러오는 중…
        </p>
      ) : datasets.length === 0 ? (
        <p className="gdp-admin-empty">등록된 데이터셋이 없습니다.</p>
      ) : (
        <ul className="gdp-admin-dataset-grid" aria-label="데이터셋 목록">
          {datasets.map((ds) => (
            <li key={ds.datasetKey} className="gdp-admin-dataset-card">
              <div className="gdp-admin-dataset-head">
                <span className="gdp-admin-dataset-domain">{ds.domain}</span>
                <span
                  className={`gdp-admin-dataset-vis ${
                    ds.publicVisible ? "is-public" : "is-hidden"
                  }`}
                >
                  {ds.publicVisible ? "공개" : "비공개"}
                </span>
              </div>
              <strong className="gdp-admin-dataset-name">{ds.datasetName}</strong>
              <dl className="gdp-admin-dataset-meta">
                <div>
                  <dt>출처</dt>
                  <dd>{ds.sourceName}</dd>
                </div>
                <div>
                  <dt>갱신주기</dt>
                  <dd>{ds.refreshCycle}</dd>
                </div>
                <div>
                  <dt>업로드</dt>
                  <dd>{ds.uploadMode}</dd>
                </div>
                <div>
                  <dt>직접 커밋</dt>
                  <dd>{ds.supportsUploadCommit ? "가능" : "불가"}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
