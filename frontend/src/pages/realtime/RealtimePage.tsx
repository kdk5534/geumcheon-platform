import { Link } from "react-router-dom";
import { usePublicData } from "../../data/PublicDataContext";

export function RealtimePage() {
  const { model } = usePublicData();

  const air = model.metrics.find((metric) => metric.key === "air");
  const stores = model.metrics.find((metric) => metric.key === "commercial");
  const facilities = model.metrics.find((metric) => metric.key === "facility");

  const events = [
    { label: "대기질", value: air?.value || "확인 중", note: "환경 관측값 기준", tone: "mint" },
    { label: "상가업소", value: stores?.value || "확인 중", note: "GEUMCHEON 범위", tone: "coral" },
    { label: "생활시설", value: facilities?.value || "확인 중", note: "시설 API 응답 행", tone: "cobalt" },
  ];

  return (
    <section className="gdp-operational-page" aria-labelledby="realtime-title">
      <header className="gdp-operational-hero">
        <div>
          <span>RECENT CITY STATUS</span>
          <h1 id="realtime-title">최근 도시현황</h1>
          <p>환경·생활·데이터 상태를 시간 기준으로 확인합니다. 최신 시도와 마지막 정상 스냅샷은 분리해서 해석합니다.</p>
        </div>
        <Link to="/datasets">데이터 상태 보기</Link>
      </header>

      <section className="gdp-operational-strip" aria-label="현재 상태 요약">
        {events.map((event) => (
          <article key={event.label} className={`is-${event.tone}`}>
            <span>{event.label}</span>
            <strong>{event.value}</strong>
            <small>{event.note}</small>
          </article>
        ))}
      </section>

      <section className="gdp-operational-timeline" aria-label="최근 상태 타임라인">
        <article>
          <time>{model.asOf}</time>
          <strong>화면 기준일 확인</strong>
          <p>항목별 기준일이 다른 데이터는 한 시점으로 강제 병합하지 않습니다.</p>
        </article>
        <article>
          <time>마지막 정상값</time>
          <strong>스냅샷 유지 정책</strong>
          <p>수집 실패가 있어도 마지막 정상자료는 유지하고, 실패 사실만 별도로 표시합니다.</p>
        </article>
        <article>
          <time>지도 상태</time>
          <strong>VWorld backend proxy</strong>
          <p>지도 타일은 백엔드 프록시를 통해 호출하며, 실패 시 목록으로 같은 과업을 이어갑니다.</p>
        </article>
      </section>
    </section>
  );
}
