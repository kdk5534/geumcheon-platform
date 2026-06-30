// 공통 Section/PageHeader 컴포넌트 — 페이지 레이아웃 구조 도우미 (gdp-ui- 네임스페이스)
import "./Section.css";

/* ── Page 래퍼 ── */
export function Page({ className = "", children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`gdp-ui-page ${className}`} {...rest}>
      {children}
    </div>
  );
}

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, action, className = "" }: PageHeaderProps) {
  return (
    <header className={`gdp-ui-page-header ${className}`}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <div>
          {eyebrow ? <p className="gdp-ui-eyebrow">{eyebrow}</p> : null}
          <h1 className="gdp-ui-page-title">{title}</h1>
          {description ? <p className="gdp-ui-page-description">{description}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
    </header>
  );
}

/* ── Section 단위 ── */
interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  title?: string;
  action?: React.ReactNode;
}

export function Section({ title, action, className = "", children, ...rest }: SectionProps) {
  return (
    <section className={`gdp-ui-section ${className}`} {...rest}>
      {title ? (
        <div className="gdp-ui-section-header">
          <h2 className="gdp-ui-section-title">{title}</h2>
          {action ? <div className="gdp-ui-section-action">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/* ── 그리드 ── */
type GridCols = 2 | 3 | 4 | "auto";

interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: GridCols;
}

export function Grid({ cols = "auto", className = "", children, ...rest }: GridProps) {
  const cls = ["gdp-ui-grid", `gdp-ui-grid--${cols}`, className].filter(Boolean).join(" ");
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}
