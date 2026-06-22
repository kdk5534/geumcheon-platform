import { describe, expect, it } from "vitest";
import { createDataState, DATA_STATUSES, resolveDataStatus } from "../../js/core/data-state.js";

describe("공통 데이터 상태", () => {
  it.each([
    [{ hasData: true, sourceMode: "db" }, "live"],
    [{ hasData: true, sourceMode: "local" }, "sample"],
    [{ hasData: true, sourceMode: "mixed" }, "stale"],
    [{ hasData: true, sourceMode: "db", error: "partial" }, "stale"],
    [{ hasData: false }, "empty"],
    [{ hasData: false, error: "offline" }, "error"],
  ])("%o를 %s로 판정한다", (input, expected) => {
    expect(resolveDataStatus(input)).toBe(expected);
  });

  it("출처와 기준시각을 보존하고 오류만 재시도 가능하게 표시한다", () => {
    const state = createDataState({
      error: "offline",
      observedAt: "2026-06-19T08:00:00+09:00",
      collectedAt: "2026-06-19T07:55:00+09:00",
      sourceName: "금천구 공공데이터",
      sourceUrl: "https://example.test/data",
    });

    expect(state).toMatchObject({
      status: "error",
      retryable: true,
      sourceName: "금천구 공공데이터",
      collectedAt: "2026-06-19T07:55:00+09:00",
    });
    expect(Object.isFrozen(state)).toBe(true);
    expect(DATA_STATUSES).toEqual(["live", "sample", "stale", "empty", "error"]);
  });
});
