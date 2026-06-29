// 최근 도시현황 페이지 — 대기질 오염물질 차트와 실시간 지표 표시
import { Link } from "react-router-dom";
import { usePublicData } from "../../data/PublicDataContext";
import { ChartFrame, PollutantChart } from "../../components/charts";

export function RealtimePage() {
  const { model } = usePublicData();
  const { airQuality, metrics, asOf } = model;

  const air = metrics.find((m) => m.key === "air");
  const stores = metrics.find((m) => m.key === "commercial");
  const facilities = metrics.find((m) => m.key === "facility");
  const population = metrics.find((m) => m.key === "population");

  const statusEvents = [
    { label: "주민등록 인구", value: population?.value ?? "확인 중", note: "행정동별 원값", tone: "cobalt" },
    { label: "대기질", value: air?.value ?? "—", note: airQuality.measuredAt !== "—" ? `측정 ${airQuality.measuredAt}` : "환경 관측값 기준", tone: "amber" },
    { label: "상가업소", value: stores?.value ?? "확인 중", note: "GEUMCHEON 범위", tone: "coral" },
    { label: "생활시설", value: facilities?.value ?? "확인 중", note: "시설 API 응답 행", tone: "mint" },
  ];

  return (
    <section className="gdp-operational-page" aria-labelledby="realtime-title">
      <header className="gdp-operational-hero">
        <div>
          <span>RECENT CITY STATUS</span>
          <h1 id="realtime-title">최근 도시현황</h1>
          <p>환경·생활·데이터 상태를 항목별 기준으로 확인합니다. 기준일이 다른 항목은 한 시점으로 병합하지 않습니다.</p>
        </div>
        <Link to="/datasets">데이터 상태 보기</Link>
      </header>

      <section className="gdp-operational-strip" aria-label="현재 상태 요약">
        {statusEvents.map((event) => (
          <article key={event.label} className={`is-${event.tone}`}>
            <span>{event.label}</span>
            <strong>{event.value}</strong>
            <small>{event.note}</small>
          </article>
        ))}
      </section>

      {airQuality.hasData && (
        <section className="gdp-operational-air" aria-label="대기질 오염물질 현황">
          <div className="gdp-operational-air__header">
            <div>
              <p className="gdp-operational-air__eyebrow">AIR QUALITY</p>
              <h2 className="gdp-operational-air__title">대기질 오염물질 현황</h2>
              {airQuality.measuredAt !== "—" && (
                <p className="gdp-operational-air__time">측정 기준 {airQuality.measuredAt}</p>
              )}
            </div>
            <div className="gdp-operational-air__kpi">
              <span className="gdp-operational-air__grade" data-grade={airQuality.grade}>
                {airQuality.grade}
              </span>
              {airQuality.maxIndex !== null && (
                <span className="gdp-operational-air__index">통합 지수 {airQuality.maxIndex.toFixed(2)}</span>
              )}
            </div>
          </div>
          <ChartFrame
            caption="색상은 환경부 기준 좋음(초록)·보통(파랑)·나쁨(노랑)·매우나쁨(빨강)을 나타냅니다. 수집 실패 항목은 표시하지 않습니다."
            height={airQuality.pollutants.filter((p) => p.value !== null).length * 36 + 40}
          >
            <PollutantChart
              detail={airQuality}
              height={airQuality.pollutants.filter((p) => p.value !== null).length * 36 + 40}
            />
          </ChartFrame>
        </section>
      )}

      <section className="gdp-operational-timeline" aria-label="기준일 및 데이터 정책">
        <article>
          <time>{asOf}</time>
          <strong>화면 기준일</strong>
          <p>항목별 기준일이 다릅니다. 한 시점으로 강제 병합하지 않으며, 기준일은 항목별로 표시합니다.</p>
        </article>
      </section>
    </section>
  );
}
