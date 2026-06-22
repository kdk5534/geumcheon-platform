import { describe, expect, it } from "vitest";
import { buildCommercialMatrix, csvDataUrl, matrixToCsv } from "../../js/core/visualization.js";

describe("visualization data contract", () => {
  const commercial = {
    카페: { byDong: [{ name: "가산동", count: 2 }, { name: "독산동", count: 3 }] },
    음식점: { byDong: [{ name: "가산동", count: 5 }] },
  };

  it("차트·표·CSV가 같은 행렬과 합계를 사용한다", () => {
    const matrix = buildCommercialMatrix(commercial, ["카페", "음식점"], ["가산동", "독산동"]);
    expect(matrix.rows).toEqual([
      { dong: "가산동", values: [2, 5], total: 7 },
      { dong: "독산동", values: [3, 0], total: 3 },
    ]);
    expect(matrix.columnTotals).toEqual([5, 5]);
    expect(matrix.grandTotal).toBe(10);
    expect(matrixToCsv(matrix)).toContain("가산동,2,5,7");
    expect(matrixToCsv(matrix)).toContain("소계,5,5,10");
  });

  it("한글 CSV를 BOM과 UTF-8 데이터 URL로 제공한다", () => {
    const csv = matrixToCsv(buildCommercialMatrix(commercial, ["카페"], ["가산동"]));
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csvDataUrl(csv)).toMatch(/^data:text\/csv;charset=utf-8,/);
  });
});
