// 수치 카운트업 애니메이션 컴포넌트 — requestAnimationFrame 기반
import { useEffect, useRef, useState } from "react";

interface Props {
  /** 최종 목표 숫자 (문자열 포함, 파싱 불가 시 그대로 출력) */
  value: string;
  /** 애니메이션 지속 시간(ms). 기본 900ms. */
  duration?: number;
  /** 포맷 함수. 미지정 시 toLocaleString("ko-KR") 적용 */
  format?: (n: number) => string;
}

function parseNumeric(value: string): { num: number; suffix: string } | null {
  // "150,340명" → { num: 150340, suffix: "명" }
  const match = value.replace(/,/g, "").match(/^([\d.]+)(.*)$/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  if (!isFinite(num)) return null;
  return { num, suffix: match[2].trim() };
}

export function CountUp({ value, duration = 900, format }: Props) {
  const parsed = parseNumeric(value);
  const [display, setDisplay] = useState(value);
  const rafRef = useRef<number | null>(null);
  // prefers-reduced-motion 확인
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!parsed || reducedMotion) {
      setDisplay(value);
      return undefined;
    }
    const { num, suffix } = parsed;
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * num);
      const formatted = format
        ? format(current) + suffix
        : current.toLocaleString("ko-KR") + suffix;
      setDisplay(formatted);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, format, reducedMotion, parsed]);

  return <>{display}</>;
}
