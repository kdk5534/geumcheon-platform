// API 수집 로그 화면 — 수집 실행 내역을 상태·소스별로 필터링하고 수동 재수집을 지원합니다
import { useState } from "react";
import { Button, Card, Grid, KPICard } from "../../components/ui";

const FILTER_OPTIONS = ["전체", "성공", "실패", "대기", "수동"] as const;
type FilterOption = (typeof FILTER_OPTIONS)[number];

interface ApiLog {
  id: string;
  sourceName: string;
  domain: string;
  status: "success" | "fail" | "queued" | "manual";
  collectedAt?: string;
  duration?: string;
  rows?: number;
  targetScreen?: string;
  nextRun?: string;
  note?: string;
}

function apiLogStatusLabel(status?: string): string {
  return (
    ({ success: "성공", fail: "실패", queued: "대기", manual: "수동" } as Record<string, string>)[status ?? ""] ??
    "대기"
  );
}

function apiLogStatusClass(status?: string): string {
  return (
    ({
      success: "is-success",
      fail: "is-failed",
      queued: "is-queued",
      manual: "is-manual",
    } as Record<string, string>)[status ?? ""] ?? "is-queued"
  );
}

function defaultApiLogs(): ApiLog[] {
  return [
    {
      id: "weather-20260602-1600",
      sourceName: "기상 현황",
      domain: "도시환경",
      status: "success",
      collectedAt: "2026.06.02 16:00",
      duration: "18초",
      rows: 1280,
      targetScreen: "메인 대시보드",
      nextRun: "16:10",
      note: "정상 수집 완료. 최신 기상 지표를 갱신했습니다.",
    },
    {
      id: "stores-20260602-1540",
      sourceName: "상권/업소 정보",
      domain: "상권",
      status: "success",
      collectedAt: "2026.06.02 15:40",
      duration: "31초",
      rows: 842,
      targetScreen: "상권 분석",
      nextRun: "16:40",
      note: "업소명 중복 정제 규칙 적용 후 반영했습니다.",
    },
    {
      id: "dust-20260602-1500",
      sourceName: "미세먼지",
      domain: "도시환경",
      status: "queued",
      collectedAt: "2026.06.02 15:00",
      duration: "-",
      rows: 0,
      targetScreen: "대기 현황",
      nextRun: "15:10",
      note: "다음 예약 수집 대기 중입니다.",
    },
    {
      id: "parking-20260602-1450",
      sourceName: "공영주차장",
      domain: "생활",
      status: "manual",
      collectedAt: "2026.06.02 14:50",
      duration: "수동",
      rows: 214,
      targetScreen: "생활지도",
      nextRun: "수동",
      note: "지도 좌표 보정 확인이 필요합니다.",
    },
    {
      id: "traffic-20260602-1405",
      sourceName: "교통 혼잡",
      domain: "교통",
      status: "fail",
      collectedAt: "2026.06.02 14:05",
      duration: "9초",
      rows: 0,
      targetScreen: "교통 현황",
      nextRun: "14:15",
      note: "API 응답 코드 403. 키 또는 호출 제한을 다시 확인해야 합니다.",
    },
    {
      id: "population-20260602-1320",
      sourceName: "인구 통계",
      domain: "행정",
      status: "success",
      collectedAt: "2026.06.02 13:20",
      duration: "22초",
      rows: 156,
      targetScreen: "인구 분석",
      nextRun: "다음 날 08:00",
      note: "행정동 단위 집계가 정상 반영되었습니다.",
    },
  ];
}

export function ApiLogsPage() {
  const [logs, setLogs] = useState<ApiLog[]>(defaultApiLogs);
  const [activeFilter, setActiveFilter] = useState<FilterOption>("전체");
  const [searchQuery, setSearchQuery] = useState("");

  const counts = logs.reduce<Record<string, number>>((acc, log) => {
    acc[log.status] = (acc[log.status] ?? 0) + 1;
    return acc;
  }, {});

  const query = searchQuery.trim().toLowerCase();
  const filtered = logs.filter((log) => {
    const matchStatus = activeFilter === "전체" || apiLogStatusLabel(log.status) === activeFilter;
    const searchable = [log.sourceName, log.domain, log.targetScreen, log.note, log.collectedAt]
      .join(" ")
      .toLowerCase();
    return matchStatus && (!query || searchable.includes(query));
  });

  function handleRetry(id: string) {
    const now = new Date();
    const stamp = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setLogs((prev) =>
      prev.map((log) =>
        log.id === id
          ? { ...log, status: "success", collectedAt: stamp, duration: "수동 실행", note: "재수집 완료 (Mock)" }
          : log,
      ),
    );
  }

  return (
    <section className="gdp-api-page" aria-labelledby="api-logs-title">
      <div className="gdp-api-banner gdp-api-banner--logs">
        <div className="gdp-api-banner-copy">
          <p className="gdp-api-banner-eyebrow">수집 로그</p>
          <h1 id="api-logs-title" className="gdp-api-banner-title">
            API 수집 실행 내역
          </h1>
          <p className="gdp-api-banner-desc">
            API 수집 실행 내역을 상태·소스별로 필터링하고 수동 재수집을 실행합니다.
          </p>
        </div>
        <div className="gdp-api-banner-stats">
          <div className="gdp-api-banner-stat">
            <span className="gdp-api-banner-stat-val">{logs.length || "—"}</span>
            <span className="gdp-api-banner-stat-label">전체 로그</span>
          </div>
          <div className="gdp-api-banner-stat">
            <span className="gdp-api-banner-stat-val">{counts.success ?? 0}</span>
            <span className="gdp-api-banner-stat-label">성공</span>
          </div>
          <div className="gdp-api-banner-stat">
            <span className="gdp-api-banner-stat-val">{counts.fail ?? 0}</span>
            <span className="gdp-api-banner-stat-label">실패</span>
          </div>
        </div>
      </div>

      <div className="gdp-api-kpi-row" aria-live="polite">
        <Grid cols={4}>
          <KPICard className="gdp-api-kpi" label="성공" value={counts.success ?? 0} accent="mint" />
          <KPICard className="gdp-api-kpi" label="실패" value={counts.fail ?? 0} accent="coral" />
          <KPICard className="gdp-api-kpi" label="대기" value={counts.queued ?? 0} accent="cobalt" />
          <KPICard className="gdp-api-kpi" label="수동" value={counts.manual ?? 0} accent="amber" />
        </Grid>
      </div>

      <div className="gdp-api-filter-bar" role="group" aria-label="로그 필터">
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
        <input
          type="search"
          className="gdp-api-search-input"
          placeholder="소스명·도메인·메모 검색..."
          value={searchQuery}
          aria-label="로그 검색"
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="gdp-api-card-grid" aria-live="polite" aria-label="수집 로그 목록">
        {filtered.length === 0 ? (
          <div className="gdp-api-grid-empty">조건에 맞는 수집 로그가 없습니다.</div>
        ) : (
          filtered.map((log) => {
            const canRetry = log.status === "fail" || log.status === "queued" || log.status === "manual";
            return (
              <Card key={log.id} className={`gdp-api-log-card ${apiLogStatusClass(log.status)}`}>
                <div className="gdp-api-log-head">
                  <div>
                    <p>{log.domain}</p>
                    <strong>{log.sourceName}</strong>
                  </div>
                  <span className="gdp-api-log-status">{apiLogStatusLabel(log.status)}</span>
                </div>
                <dl className="gdp-api-log-kpis">
                  <div>
                    <dt>수집 시각</dt>
                    <dd>{log.collectedAt ?? "-"}</dd>
                  </div>
                  <div>
                    <dt>대상 화면</dt>
                    <dd>{log.targetScreen ?? "-"}</dd>
                  </div>
                  <div>
                    <dt>소요 시간</dt>
                    <dd>{log.duration ?? "-"}</dd>
                  </div>
                  <div>
                    <dt>건수</dt>
                    <dd>{Number(log.rows ?? 0).toLocaleString()}건</dd>
                  </div>
                  <div>
                    <dt>다음 실행</dt>
                    <dd>{log.nextRun ?? "-"}</dd>
                  </div>
                  <div>
                    <dt>로그 ID</dt>
                    <dd>{log.id}</dd>
                  </div>
                </dl>
                {log.note ? <p className="gdp-api-log-note">{log.note}</p> : null}
                {canRetry ? (
                  <div className="gdp-api-log-actions">
                    <Button className="gdp-api-retry-btn" variant="subtle" size="sm" onClick={() => handleRetry(log.id)}>
                      재수집
                    </Button>
                  </div>
                ) : null}
              </Card>
            );
          })
        )}
      </div>
    </section>
  );
}
