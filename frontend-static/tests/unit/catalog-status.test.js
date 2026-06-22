import { describe, expect, it } from "vitest";
import { summarizeOperationalStatuses } from "../../js/pages/catalog.js";

describe("데이터셋 운영 상태 요약", () => {
  it("최근 실패와 마지막 정상자료 보유를 별도 집계한다", () => {
    const summary = summarizeOperationalStatuses([
      {
        attemptStatus: "FAILED",
        dataStatus: "AVAILABLE",
        collectedAt: "2026-06-19T03:00:00Z",
      },
      {
        attemptStatus: "SUCCESS",
        dataStatus: "AVAILABLE",
        collectedAt: "2026-06-20T03:00:00Z",
      },
      {
        attemptStatus: "NO_ATTEMPT",
        dataStatus: "NO_SUCCESS",
        collectedAt: null,
      },
    ]);

    expect(summary).toEqual({
      total: 3,
      available: 2,
      attention: 1,
      noSuccess: 1,
      latestCollectedAt: "2026-06-20T03:00:00Z",
    });
  });
});
