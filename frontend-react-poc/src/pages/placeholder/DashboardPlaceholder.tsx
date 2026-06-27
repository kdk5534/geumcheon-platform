import { Link, useLocation } from "react-router-dom";

interface Props {
  eyebrow: string;
  title: string;
  description: string;
  primaryLabel: string;
  modules: Array<{ title: string; body: string; accent: "cobalt" | "mint" | "coral" | "amber" }>;
}

export function DashboardPlaceholder({ eyebrow, title, description, primaryLabel, modules }: Props) {
  const location = useLocation();
  const currentPath = `${location.pathname}${location.search}`;

  return (
    <section className="gdp-placeholder" aria-labelledby="placeholder-title">
      <header className="gdp-placeholder-head">
        <div>
          <span>{eyebrow}</span>
          <h1 id="placeholder-title">{title}</h1>
          <p>{description}</p>
        </div>
        <div className="gdp-placeholder-actions">
          <Link to={`/home?from=${encodeURIComponent(currentPath)}`}>종합 현황에서 보기</Link>
          <Link to="/datasets">데이터 근거</Link>
        </div>
      </header>

      <section className="gdp-placeholder-status" aria-label="마이그레이션 상태">
        <div>
          <span>현재 단계</span>
          <strong>공개 대시보드 화면 구성</strong>
        </div>
        <div>
          <span>우선 과업</span>
          <strong>{primaryLabel}</strong>
        </div>
        <div>
          <span>표현 원칙</span>
          <strong>순위·점수화 없이 원값과 기준일 중심</strong>
        </div>
      </section>

      <div className="gdp-placeholder-grid">
        {modules.map((module) => (
          <article key={module.title} className={`is-${module.accent}`}>
            <span />
            <h2>{module.title}</h2>
            <p>{module.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
