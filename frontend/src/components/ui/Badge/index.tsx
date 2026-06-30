// 공통 Badge/StatusBadge 컴포넌트 — gdp-ui-badge 네임스페이스 (기존 gdp-status-badge--* 보존)
import "./Badge.css";

type BadgeColor = "neutral" | "cobalt" | "green" | "amber" | "red";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: BadgeColor;
}

export function Badge({ color = "neutral", className = "", children, ...rest }: BadgeProps) {
  const cls = ["gdp-ui-badge", `gdp-ui-badge--${color}`, className].filter(Boolean).join(" ");
  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  );
}

type StatusColor = "green" | "amber" | "red" | "gray";

interface StatusDotProps {
  color: StatusColor;
  className?: string;
}

export function StatusDot({ color, className = "" }: StatusDotProps) {
  return (
    <span
      className={["gdp-ui-status-dot", `gdp-ui-status-dot--${color}`, className].filter(Boolean).join(" ")}
      aria-hidden="true"
    />
  );
}
