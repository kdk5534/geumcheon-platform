// 행정동 이름 정규화 유틸 — 경계 GeoJSON과 인구 데이터 간 이름 매칭에 사용

/**
 * 다양한 형태의 행정동 이름을 최소 동 이름으로 정규화한다.
 *   "서울특별시 금천구 가산동"  → "가산동"
 *   "서울특별시 금천구 독산제1동" → "독산1동"
 *   "독산1동"                  → "독산1동" (그대로)
 *   "독산제2동"                → "독산2동"
 */
export function normalizeDongName(raw: string): string {
  let name = (raw || "").trim();
  // "OO시 OO구 OO동" 형태: 구 이후 부분만 추출
  const m = name.match(/구\s+(.+)$/);
  if (m) name = m[1].trim();
  // "제N동" → "N동"
  name = name.replace(/제(\d+)동$/, "$1동");
  return name;
}
