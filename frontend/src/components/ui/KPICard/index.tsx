// 공통 KPICard 컴포넌트 — 주요 지표 수치 카드 (gdp-ui-kpi 네임스페이스)
import "./KPICard.css";

type KPIAccent = "cobalt" | "mint" | "coral" | "amber";
type DeltaDirection = "up" | "down" | "neutral";

interface KPICardProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: string;
  deltaDirection?: DeltaDirection;
  sub?: string;
  accent?: KPIAccent;
  small?: boolean;
  className?: string;
}

export function KPICard({
  label,
  value,
  unit,
  delta,
  deltaDirection = "neutral",
  sub,
  accent,
  small = false,
  className = "",
}: KPICardProps) {
  const cls = [
    "gdp-ui-kpi",
    accent ? `gdp-ui-kpi--${accent}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls}>
      <div className="gdp-ui-kpi__header">
        <p className="gdp-ui-kpi__label">{label}</p>
        {delta ? (
          <span className={`gdp-ui-kpi__delta gdp-ui-kpi__delta--${deltaDirection}`}>
            {deltaDirection === "up" ? "▲" : deltaDirection === "down" ? "▼" : ""}
            {delta}
          </span>
        ) : null}
      </div>
      <p className={`gdp-ui-kpi__value${small ? " gdp-ui-kpi__value--sm" : ""}`}>
        {value}
        {unit ? <span className="gdp-ui-kpi__unit">{unit}</span> : null}
      </p>
      {sub ? <p className="gdp-ui-kpi__sub">{sub}</p> : null}
    </div>
  );
}
