import { Link } from "react-router-dom";

const topics = [
  { to: "/population", label: "인구·생활", body: "행정동별 인구와 생활시설을 함께 확인합니다.", accent: "cobalt" },
  { to: "/commercial", label: "상권·경제", body: "업종 분포와 점포 현황을 중립적으로 탐색합니다.", accent: "coral" },
  { to: "/welfare", label: "복지·건강", body: "필요한 도움에서 시설과 근거로 이어집니다.", accent: "mint" },
  { to: "/safety", label: "안전·환경", body: "대기질과 안전시설 레이어를 확인합니다.", accent: "amber" },
  { to: "/datasets", label: "데이터 카탈로그", body: "출처, 기준일, 다운로드 가능 여부를 확인합니다.", accent: "cobalt" },
];

export function TopicsPage() {
  return (
    <section className="gdp-topics-page" aria-labelledby="topics-title">
      <header className="gdp-operational-hero">
        <div>
          <span>TOPIC HUB</span>
          <h1 id="topics-title">분야별 생활 데이터</h1>
          <p>주민이 이해하기 쉬운 과업 단위로 데이터 탐색을 시작합니다. 각 주제는 지도, 표, 데이터 카탈로그로 이어집니다.</p>
        </div>
      </header>
      <div className="gdp-topic-hub-grid">
        {topics.map((topic) => (
          <Link key={topic.to} to={topic.to} className={`is-${topic.accent}`}>
            <span>{topic.label}</span>
            <strong>{topic.body}</strong>
          </Link>
        ))}
      </div>
    </section>
  );
}
