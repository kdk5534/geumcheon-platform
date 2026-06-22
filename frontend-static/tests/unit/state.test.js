import { describe, expect, it } from "vitest";
import { normalizeApiBase, normalizeCategory, toCategoryCode } from "../../js/core/state.js";

describe("런타임 설정", () => {
  it("API 주소 끝의 슬래시를 제거한다", () => {
    expect(normalizeApiBase("https://data.example.go.kr///")).toBe("https://data.example.go.kr");
  });

  it("빈 API 주소는 동일 출처 요청을 의미한다", () => {
    expect(normalizeApiBase(" /")).toBe("");
    expect(normalizeApiBase(undefined)).toBe("");
  });
});

describe("시설 카테고리 변환", () => {
  it("백엔드 코드를 주민용 한글 라벨로 변환한다", () => {
    expect(normalizeCategory("PHARMACY")).toBe("약국");
    expect(normalizeCategory("school_zone")).toBe("보호구역");
    expect(normalizeCategory("CIVIL_DEFENSE_SHELTER")).toBe("대피시설");
    expect(normalizeCategory("CHILDCARE")).toBe("어린이집");
  });

  it("주민용 라벨을 API 코드로 변환한다", () => {
    expect(toCategoryCode("따릉이")).toBe("BIKE");
    expect(toCategoryCode("충전소")).toBe("EV_CHARGER");
    expect(toCategoryCode("대피시설")).toBe("CIVIL_DEFENSE_SHELTER");
  });
});
