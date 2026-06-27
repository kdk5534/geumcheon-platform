import type { OverviewModel } from "../overviewTypes";

interface Props {
  model: OverviewModel;
}

export function OverviewBriefStrip({ model }: Props) {
  return (
    <section className="gdp-brief-strip" aria-label="현재 분석 맥락">
      <article>
        <span>분석 범위</span>
        <strong>금천구 전체</strong>
        <p>인접 지역은 기본 분석에서 제외</p>
      </article>
      <article>
        <span>대표 지표</span>
        <strong>{model.metrics.length}개</strong>
        <p>인구, 상권, 시설, 환경</p>
      </article>
      <article>
        <span>공간 데이터</span>
        <strong>{model.facilities.length.toLocaleString("ko-KR")}건</strong>
        <p>지도 실패 시 목록으로 대체</p>
      </article>
      <article>
        <span>데이터 상태</span>
        <strong>{model.sourceMode}</strong>
        <p>{model.asOf}</p>
      </article>
    </section>
  );
}
