import { describe, expect, it } from "vitest";
import {
  averageDistrictScore,
  averageScoreAcrossDistricts,
  formatDelta,
  getDistrictAverages,
  getElderlyRatio,
  getPopulationElderlyRatio,
  rankDistricts,
  buildDistrictComparisonRows,
} from "../../js/pages/dong-metrics.js";

describe("우리 동 비교 수치", () => {
  const districts = [
    { name: "가산동", scores: { life: 80, traffic: 70, safety: 60 } },
    { name: "독산동", scores: { life: 90, traffic: 90, safety: 90 } },
  ];

  it("유효한 점수만 평균에 포함한다", () => {
    expect(averageDistrictScore({ scores: { a: 80, b: 60, c: null } })).toBe(70);
    expect(averageDistrictScore({ scores: {} })).toBe(0);
  });

  it("권역별 지표 평균과 평균 대비 차이를 계산한다", () => {
    expect(getDistrictAverages(districts, ["life", "traffic"]))
      .toEqual({ life: 85, traffic: 80 });
    expect(formatDelta(90, 80, "구 평균")).toBe("구 평균보다 10.0점 높음");
    expect(formatDelta(1000, 1000, "구 평균", "명")).toBe("구 평균보다 0명 같음");
  });

  it("60대 이상 인구 비율을 개별 동과 전체에서 계산한다", () => {
    const population = [
      { byAge: [{ ageBand: "50~59세", male: 20, female: 20 }, { ageBand: "60~69세", male: 10, female: 10 }] },
      { byAge: [{ ageBand: "70세 이상", male: 10, female: 10 }, { ageBand: "0~9세", male: 10, female: 10 }] },
    ];
    expect(getPopulationElderlyRatio(population[0])).toBe("33.3");
    expect(getElderlyRatio(population)).toBe("40.0");
    expect(getPopulationElderlyRatio(null)).toBe("");
  });

  it("원본 배열을 바꾸지 않고 평균 점수 내림차순으로 정렬한다", () => {
    const ranked = rankDistricts(districts);

    expect(ranked.map((district) => district.name)).toEqual(["독산동", "가산동"]);
    expect(ranked[0].avgScore).toBe(90);
    expect(districts[0]).not.toHaveProperty("avgScore");
  });

  it("권역 전체 평균을 계산하고 빈 배열은 0을 반환한다", () => {
    expect(averageScoreAcrossDistricts(districts)).toBe(80);
    expect(averageScoreAcrossDistricts([])).toBe(0);
  });

  it("편차 막대·표·CSV가 공유할 비교 행을 만든다", () => {
    expect(buildDistrictComparisonRows(
      { name: "가산동", scores: { 생활: 80, 교통: 70, 안전: 60 } },
      { 생활: 75, 교통: 70, 안전: 65 }
    )).toEqual([
      { metric: "생활", value: 80, average: 75, delta: 5, summary: "구 평균보다 5.0점 높음" },
      { metric: "교통", value: 70, average: 70, delta: 0, summary: "구 평균보다 0.0점 같음" },
      { metric: "안전", value: 60, average: 65, delta: -5, summary: "구 평균보다 5.0점 낮음" },
    ]);
  });
});
