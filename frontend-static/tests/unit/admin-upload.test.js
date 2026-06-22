import { describe, expect, it } from "vitest";
import {
  fileExtension,
  getUploadFileKind,
  isCsvFile,
  isExcelFile,
  parseCsv,
} from "../../js/pages/admin-upload.js";

describe("관리자 업로드 파일 처리", () => {
  it("인용된 쉼표와 줄바꿈, 이중 따옴표를 보존한다", () => {
    const rows = parseCsv('name,note\r\n"가산,동","첫째 줄\n둘째 ""줄"""');

    expect(rows).toEqual([
      ["name", "note"],
      ["가산,동", '첫째 줄\n둘째 "줄"'],
    ]);
  });

  it("빈 행은 결과에서 제외한다", () => {
    expect(parseCsv("a,b\n\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("확장자와 MIME 형식으로 CSV·Excel 파일을 판별한다", () => {
    expect(fileExtension({ name: "DATA.CSV" })).toBe("csv");
    expect(isCsvFile({ name: "data.csv" })).toBe(true);
    expect(isExcelFile({ name: "data.xlsx" })).toBe(true);
    expect(getUploadFileKind({ name: "data.txt" })).toBe("unsupported");
  });
});
