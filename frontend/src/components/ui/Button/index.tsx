// 공통 Button 컴포넌트 — 공공기관 정제형 버튼 (gdp-ui-btn 네임스페이스)
import "./Button.css";

type ButtonVariant = "filled" | "outline" | "ghost" | "subtle" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconOnly?: boolean;
}

export function Button({
  variant = "filled",
  size = "md",
  loading = false,
  iconOnly = false,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const cls = [
    "gdp-ui-btn",
    `gdp-ui-btn--${variant}`,
    `gdp-ui-btn--${size}`,
    iconOnly ? "gdp-ui-btn--icon" : "",
    loading ? "gdp-ui-btn--loading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {children}
    </button>
  );
}
