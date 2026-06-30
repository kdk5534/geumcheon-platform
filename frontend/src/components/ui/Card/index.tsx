// 공통 Card/Panel 컴포넌트 — 공공기관 정제형 카드 (gdp-ui-card 네임스페이스)
import "./Card.css";

type CardElevation = "flat" | "default" | "raised" | "floating";
type CardAccent = "cobalt" | "mint" | "coral" | "amber";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: CardElevation;
  accent?: CardAccent;
  interactive?: boolean;
}

export function Card({
  elevation = "default",
  accent,
  interactive = false,
  className = "",
  children,
  ...rest
}: CardProps) {
  const cls = [
    "gdp-ui-card",
    elevation !== "default" ? `gdp-ui-card--${elevation}` : "",
    accent ? "gdp-ui-card--accent" : "",
    accent && accent !== "cobalt" ? `gdp-ui-card--accent-${accent}` : "",
    interactive ? "gdp-ui-card--interactive" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`gdp-ui-card-header ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ className = "", children, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={`gdp-ui-card-title ${className}`} {...rest}>
      {children}
    </h3>
  );
}

export function CardDescription({ className = "", children, ...rest }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`gdp-ui-card-description ${className}`} {...rest}>
      {children}
    </p>
  );
}

export function CardBody({ className = "", children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`gdp-ui-card-body ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ className = "", children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`gdp-ui-card-footer ${className}`} {...rest}>
      {children}
    </div>
  );
}
