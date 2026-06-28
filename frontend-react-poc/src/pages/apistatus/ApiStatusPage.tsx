// API 수집 현황 화면 — 공공데이터 API 연동 상태를 소스별로 필터링해 카드로 보여줍니다
import { useMemo, useState } from "react";
import { usePublicData } from "../../data/PublicDataContext";

const FILTER_OPTIONS = ["전체", "준비됨", "Mock", "키 필요", "확인 필요"] as const;
type FilterOption = (typeof FILTER_OPTIONS)[number];

interface ApiSource {
  datasetKey?: string;
  name: string;
  domain: string;
  status?: "ready" | "mock" | "key-needed" | "check-required";
  refreshCycle?: string;
  targetScreen?: string;
  envVar?: string;
  source?: string;
  lastSynced?: string;
  note?: string;
}

function apiStatusLabel(status?: string): string {
  return (
    ({ ready: "준비됨", mock: "Mock", "key-needed": "키 필요", "check-required": "확인 필요" } as Record<string, string>)[
      status ?? ""
    ] ?? "확인 필요"
  );
}

function apiStatusClass(status?: string): string {
  return (
    ({ ready: "is-ready", mock: "is-mock", "key-needed": "is-key", "check-required": "is-check" } as Record<
      string,
      string
    >)[status ?? ""] ?? "is-check"
  );
}

function defaultApiSources(): ApiSource[] {
  return [
    {
      datasetKey: "weather",
      name: "기상 현황",
      domain: "실시간",
      status: "mock",
      refreshCycle: "10분",
      targetScreen: "메인 대시보드",
      envVar: "DATA_GO_KR_API_KEY",
      source: "기상청",
      lastSynced: "2026.06.02 16:00",
      note: "금천구 대표 좌표 기준 Mock 응답",
    },
    {
      datasetKey: "dust",
      name: "미세먼지/초미세먼지",
      domain: "실시간",
      status: "key-needed",
      refreshCycle: "시간",
      targetScreen: "대기 현황",
      envVar: "SEOUL_OPEN_API_KEY",
      source: "서울 열린데이터광장",
      lastSynced: "대기중",
      note: "측정소 기준시각 표기 필요",
    },
    {
      datasetKey: "traffic",
      name: "교통 알림",
      domain: "실시간",
      status: "check-required",
      refreshCycle: "실시간",
      targetScreen: "상황판",
      envVar: "SEOUL_OPEN_API_KEY",
      source: "서울 TOPIS",
      lastSynced: "점검 필요",
      note: "공사·통제·사고 이벤트 우선",
    },
    {
      datasetKey: "stores",
      name: "상가업소 정보",
      domain: "상권",
      status: "ready",
      refreshCycle: "수시",
      targetScreen: "상권분석",
      envVar: "DATA_GO_KR_API_KEY",
      source: "소상공인시장진흥공단",
      lastSynced: "2026.06.02 15:40",
      note: "업종 분류와 좌표가 있어 핵심 데이터",
    },
    {
      datasetKey: "parking",
      name: "공영주차장",
      domain: "생활",
      status: "mock",
      refreshCycle: "수시",
      targetScreen: "생활지도",
      envVar: "SEOUL_OPEN_API_KEY",
      source: "서울/금천 열린데이터",
      lastSynced: "2026.06.02 14:50",
      note: "정적 주차장 목록으로 개발 중",
    },
    {
      datasetKey: "population",
      name: "주민등록 인구",
      domain: "인구",
      status: "key-needed",
      refreshCycle: "월",
      targetScreen: "인구 대시보드",
      envVar: "SEOUL_OPEN_API_KEY",
      source: "행안부/서울 열린데이터",
      lastSynced: "대기중",
      note: "행정동 기준 우선",
    },
  ];
}

function mergeApiSources(raw: unknown[]): ApiSource[] {
  const rawSources = raw as ApiSource[];
  const base = defaultApiSources();
  const map = new Map(rawSources.map((s) => [s.datasetKey ?? s.name, s]));
  const merged = base.map((s) => ({ ...s, ...(map.get(s.datasetKey ?? s.name) ?? {}) }));
  const baseKeys = new Set(base.map((s) => s.datasetKey ?? s.name));
  const extras = rawSources.filter((s) => !baseKeys.has(s.datasetKey ?? s.name));
  return [...merged, ...extras];
}

export function ApiStatusPage() {
  const { bundle } = usePublicData();
  const [activeFilter, setActiveFilter] = useState<FilterOption>("전체");

  const sources = useMemo(() => mergeApiSources(bundle.apiSources), [bundle.apiSources]);

  const readyCount = sources.filter((s) => s.status === "ready").length;
  const mockCount = sources.filter((s) => s.status === "mock").length;
  const keyCount = sources.filter((s) => s.status === "key-needed").length;
  const checkCount = sources.filter((s) => s.status === "check-required").length;

  const filtered =
    activeFilter === "전체" ? sources : sources.filter((s) => apiStatusLabel(s.status) === activeFilter);

  return (
    <section className="gdp-api-page" aria-labelledby="api-status-title">
      <div className="gdp-api-banner">
        <div className="gdp-api-banner-copy">
          <p className="gdp-api-banner-eyebrow">API 수집 현황</p>
          <h1 id="api-status-title" className="gdp-api-banner-title">
            공공데이터 연동 상태
          </h1>
          <p className="gdp-api-banner-desc">
            공공데이터 API 연결 상태와 수집 주기를 소스별로 모니터링합니다.
          </p>
        </div>
        <div className="gdp-api-banner-stats">
          <div className="gdp-api-banner-stat">
            <span className="gdp-api-banner-stat-val">{sources.length || "—"}</span>
            <span className="gdp-api-banner-stat-label">전체 소스</span>
          </div>
          <div className="gdp-api-banner-stat">
            <span className="gdp-api-banner-stat-val">{readyCount}</span>
            <span className="gdp-api-banner-stat-label">정상 연결</span>
          </div>
          <div className="gdp-api-banner-stat">
            <span className="gdp-api-banner-stat-val">{mockCount}</span>
            <span className="gdp-api-banner-stat-label">Mock 데이터</span>
          </div>
        </div>
      </div>

      <div className="gdp-api-kpi-row" aria-live="polite">
        <article className="gdp-api-kpi gdp-api-kpi--green">
          <span>준비됨</span>
          <strong>{readyCount}</strong>
        </article>
        <article className="gdp-api-kpi gdp-api-kpi--blue">
          <span>Mock</span>
          <strong>{mockCount}</strong>
        </article>
        <article className="gdp-api-kpi gdp-api-kpi--amber">
          <span>키 필요</span>
          <strong>{keyCount}</strong>
        </article>
        <article className="gdp-api-kpi gdp-api-kpi--muted">
          <span>확인 필요</span>
          <strong>{checkCount}</strong>
        </article>
      </div>

      <div className="gdp-api-filter-bar" role="group" aria-label="상태 필터">
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f}
            type="button"
            className={`gdp-api-filter-btn${activeFilter === f ? " is-active" : ""}`}
            aria-pressed={activeFilter === f}
            onClick={() => setActiveFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="gdp-api-card-grid" aria-live="polite" aria-label="API 소스 목록">
        {filtered.length === 0 ? (
          <div className="gdp-api-grid-empty">해당 조건의 API 소스가 없습니다.</div>
        ) : (
          filtered.map((source, i) => (
            <article
              key={source.datasetKey ?? source.name ?? i}
              className={`gdp-api-source-card ${apiStatusClass(source.status)}`}
            >
              <div className="gdp-api-source-head">
                <div>
                  <p>{source.domain}</p>
                  <strong>{source.name}</strong>
                </div>
                <span className="gdp-api-source-status">{apiStatusLabel(source.status)}</span>
              </div>
              <dl>
                <div>
                  <dt>연동 화면</dt>
                  <dd>{source.targetScreen ?? "-"}</dd>
                </div>
                <div>
                  <dt>갱신 주기</dt>
                  <dd>{source.refreshCycle ?? "-"}</dd>
                </div>
                <div>
                  <dt>마지막 상태</dt>
                  <dd>{source.lastSynced ?? "-"}</dd>
                </div>
                <div>
                  <dt>환경변수</dt>
                  <dd>{source.envVar ?? "-"}</dd>
                </div>
              </dl>
              {source.note ? <p className="gdp-api-source-note">{source.note}</p> : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
