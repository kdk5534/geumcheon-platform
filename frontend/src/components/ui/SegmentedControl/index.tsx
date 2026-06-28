// 공통 SegmentedControl — role=radiogroup 기반 세그먼트 선택기 (gdp-ui-seg 네임스페이스)
import "./SegmentedControl.css";

interface SegmentItem<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string = string> {
  items: SegmentItem<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md" | "lg";
  label: string; // aria-label (접근성 필수)
  className?: string;
}

export function SegmentedControl<T extends string = string>({
  items,
  value,
  onChange,
  size = "md",
  label,
  className = "",
}: SegmentedControlProps<T>) {
  const cls = [
    "gdp-ui-seg",
    size !== "md" ? `gdp-ui-seg--${size}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div role="radiogroup" aria-label={label} className={cls}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="radio"
          aria-checked={value === item.value}
          className="gdp-ui-seg__item"
          onClick={() => onChange(item.value)}
        >
          {item.icon ? <span className="gdp-ui-seg__icon">{item.icon}</span> : null}
          {item.label}
        </button>
      ))}
    </div>
  );
}
