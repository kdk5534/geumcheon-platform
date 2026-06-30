// choropleth 단계구분도 알고리즘 — 분위수 기반 색 구간 계산 및 색상 반환
// frontend-static/js/core/choropleth.js (git c3f150e~1) 에서 TS로 이식

/** 5단계 파랑 그라데이션 팔레트 (연→진) */
export const CHOROPLETH_PALETTE = ["#c5e8f7", "#63bde3", "#0d93cf", "#0c7fb8", "#0a4570"] as const;

/**
 * 분위수 구간 경계값 배열을 반환한다.
 * values가 비어있거나 steps < 2이면 빈 배열을 반환한다.
 */
export function quantileBreaks(values: number[], steps = 5): number[] {
  const sorted = [...values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0 || steps < 2) return [];
  const breaks: number[] = [];
  for (let i = 1; i < steps; i++) {
    const idx = Math.floor((i / steps) * sorted.length);
    breaks.push(sorted[Math.min(idx, sorted.length - 1)]);
  }
  return breaks;
}

/**
 * 주어진 값에 대한 팔레트 색상을 반환한다.
 * breaks가 비어있거나 value가 없으면 투명을 반환한다.
 */
export function choroplethColor(value: number | undefined, breaks: number[]): string {
  if (value === undefined || breaks.length === 0) return "transparent";
  const idx = breaks.findIndex((b) => value <= b);
  if (idx === -1) return CHOROPLETH_PALETTE[CHOROPLETH_PALETTE.length - 1];
  return CHOROPLETH_PALETTE[idx] ?? CHOROPLETH_PALETTE[0];
}

/**
 * 범례 구간 라벨 배열을 반환한다 (breaks 기반 구간 텍스트).
 * 예: ["0–1,234", "1,234–2,567", ...]
 */
export function legendRanges(
  breaks: number[],
  minVal: number,
  maxVal: number,
): Array<{ color: string; label: string }> {
  if (breaks.length === 0) return [];
  const fmt = (n: number) => n.toLocaleString("ko-KR");
  const boundaries = [minVal, ...breaks, maxVal];
  return CHOROPLETH_PALETTE.slice(0, breaks.length + 1).map((color, i) => ({
    color,
    label: `${fmt(boundaries[i])}–${fmt(boundaries[i + 1] ?? maxVal)}`,
  }));
}
