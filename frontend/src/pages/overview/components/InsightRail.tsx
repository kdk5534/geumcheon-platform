import type { OverviewModel, OverviewTopic } from "../overviewTypes";

interface Props {
  model: OverviewModel;
  topic: OverviewTopic;
  district: string;
  selectedBreakdown: string;
}

const topicLabel: Record<OverviewTopic, string> = {
  population: "인구·생활",
  commercial: "상권·경제",
  welfare: "복지·건강",
  safety: "안전·환경",
};

export function InsightRail({ model, topic, district, selectedBreakdown }: Props) {
  const geocoded = model.facilities.filter((facility) => facility.lat && facility.lng).length;
  const filtered = selectedBreakdown
    ? model.facilities.filter((facility) => facility.category.includes(selectedBreakdown))
    : model.facilities;
  const visibleRows = filtered.length || model.facilities.length;
  const coordinateRate = model.facilities.length ? Math.round((geocoded / model.facilities.length) * 100) : 0;

  return (
    <section className="gdp-insight-rail" aria-labelledby="gdp-insight-title">
      <header>
        <span>READING GUIDE</span>
        <h2 id="gdp-insight-title">현재 화면 해석</h2>
        <p>선택한 조건이 지도, 차트, 목록에 함께 반영되는지 확인할 수 있습니다.</p>
      </header>

      <div className="gdp-insight-grid">
        <article>
          <span>분석 범위</span>
          <strong>{district || "금천구 전체"}</strong>
          <small>{topicLabel[topic]} 화면 기준</small>
        </article>
        <article>
          <span>표시 데이터</span>
          <strong>{visibleRows.toLocaleString("ko-KR")}행</strong>
          <small>시설 행 기준, distinct 시설 수와 다를 수 있음</small>
        </article>
        <article>
          <span>좌표 연결</span>
          <strong>{coordinateRate}%</strong>
          <small>{geocoded.toLocaleString("ko-KR")}행이 지도 표시 가능</small>
        </article>
      </div>

      <ol className="gdp-insight-steps">
        <li>
          <strong>1. 주제 선택</strong>
          <span>인구·상권·복지·안전 중 먼저 관심 영역을 좁힙니다.</span>
        </li>
        <li>
          <strong>2. 차트 클릭</strong>
          <span>막대나 조각을 선택하면 지도와 목록의 표시 행이 함께 바뀝니다.</span>
        </li>
        <li>
          <strong>3. 근거 확인</strong>
          <span>상태바를 펼쳐 기준일, 공급 방식, 활성 필터를 확인합니다.</span>
        </li>
      </ol>
    </section>
  );
}
