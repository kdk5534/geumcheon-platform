// 지도·상권·집계구 페이지가 공유하는 순수 데이터 셀렉터

import { state } from "./state.js";

/**
 * 현재 선택된 집계구(권역) 객체를 반환한다.
 * state.geoDistrict 이름과 일치하는 district를 찾고, 없으면 첫 번째를 반환한다.
 * @returns {object|null}
 */
export function currentGeoDistrict() {
  const districts = Array.isArray(state.data.districts) ? state.data.districts : [];
  return districts.find((d) => d.name === state.geoDistrict) || districts[0] || null;
}

/**
 * 현재 선택된 업종(state.industry)의 상권 데이터를 반환한다.
 * @returns {object|null}
 */
export function currentCommercialIndustryData() {
  const commercial = state.data?.commercial;
  if (!commercial) return null;
  return commercial[state.industry] || null;
}

/**
 * 특정 업종 데이터와 행정동 이름을 기준으로 순위·총계·평균 스냅샷을 반환한다.
 * @param {object} industryData — currentCommercialIndustryData() 반환값
 * @param {string} districtName — 기준 행정동 이름
 * @returns {object|null}
 */
export function getIndustryDistrictSnapshot(industryData, districtName) {
  const rows = Array.isArray(industryData?.byDong) ? industryData.byDong : [];
  if (rows.length === 0) return null;

  const ranked = [...rows].sort((a, b) => Number(b.count || 0) - Number(a.count || 0));
  const districtRow = rows.find((row) => row.name === districtName) || ranked[0];
  const leader = ranked[0];
  const total = rows.reduce((sum, row) => sum + Number(row.count || 0), 0);
  const average = Math.round(total / rows.length);
  const rank = ranked.findIndex((row) => row.name === districtRow.name) + 1;

  return {
    rows,
    ranked,
    districtRow,
    leader,
    total,
    average,
    rank,
    gapToLeader: Number(leader?.count || 0) - Number(districtRow?.count || 0),
    gapToAverage: Number(districtRow?.count || 0) - average
  };
}

/**
 * 선택된 집계구에 대한 기본 추천 문구를 반환한다.
 * @param {object|null} district — currentGeoDistrict() 반환값
 * @returns {string}
 */
export function defaultGeoRecommendation(district) {
  if (!district) return "비교 대상이 없습니다.";

  if (district.name === "가산동") return "생활시설은 유지하고 보행 접근성을 보강하면 균형이 좋아집니다.";
  if (district.name === "독산동") return "안전 강점을 유지하면서 교통 연결성 개선 여지를 살펴보면 좋습니다.";
  if (district.name === "시흥동") return "생활시설 보강과 환승 동선 정리가 체감 개선에 가장 효과적입니다.";
  return "상세 분석 보강이 필요합니다.";
}
