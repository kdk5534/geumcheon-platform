// 차트를 감싸는 공통 프레임 — 제목·캡션·슬롯을 일관된 룩으로 렌더링
import type { ReactNode } from "react";
import "./ChartFrame.css";

interface Props {
  title?: string;
  caption?: string;
  height?: number | string;
  children: ReactNode;
  className?: string;
}

export function ChartFrame({ title, caption, height = 240, children, className = "" }: Props) {
  return (
    <div className={`gdp-chart-frame ${className}`}>
      {title && <p className="gdp-chart-frame__title">{title}</p>}
      <div className="gdp-chart-frame__body" style={{ height }}>
        {children}
      </div>
      {caption && <p className="gdp-chart-frame__caption">{caption}</p>}
    </div>
  );
}
