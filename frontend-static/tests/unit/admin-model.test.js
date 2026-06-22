import { describe, expect, it } from "vitest";
import {
  canCommitUpload,
  defaultAdminDatasets,
  friendlyAdminError,
  isDatasetUploadable,
  mapBackendLog,
  mergeDatasetEdits,
  normalizeAdminDataset,
  uploadStatusLabel,
  validateAdminAuthDraft,
  validateAdminDatasetDraft,
} from "../../js/pages/admin-model.js";

describe("관리자 인증 모델", () => {
  it("ID 공백을 제거하고 유효한 자격 증명을 반환한다", () => {
    expect(validateAdminAuthDraft({ loginId: " admin ", password: "secret" }))
      .toMatchObject({ valid: true, loginId: "admin", password: "secret" });
  });

  it("빈 ID와 비밀번호를 함께 검증한다", () => {
    const result = validateAdminAuthDraft({ loginId: " ", password: " " });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });
});

describe("관리자 데이터셋 모델", () => {
  it("백엔드의 별칭 필드를 일관된 데이터셋 형태로 정규화한다", () => {
    expect(normalizeAdminDataset({ key: "sample", name: "표본", source: "테스트" }))
      .toMatchObject({ datasetKey: "sample", datasetName: "표본", sourceName: "테스트", publicVisible: true });
  });

  it("로컬 수정값을 원본 배열 변경 없이 병합한다", () => {
    const base = [normalizeAdminDataset({ datasetKey: "sample", datasetName: "원본" })];
    const merged = mergeDatasetEdits(base, { sample: { datasetName: "수정본" } });
    expect(merged[0].datasetName).toBe("수정본");
    expect(base[0].datasetName).toBe("원본");
  });

  it("화면 공개와 CSV 지원 여부를 업로드 조건에 함께 적용한다", () => {
    expect(isDatasetUploadable({ publicVisible: true, uploadMode: "API/CSV" })).toBe(true);
    expect(isDatasetUploadable({ publicVisible: false, uploadMode: "CSV" })).toBe(false);
    expect(canCommitUpload({ publicVisible: true, uploadMode: "CSV", supportsUploadCommit: true })).toBe(true);
  });

  it("필수 이름과 허용된 업로드 방식을 검증한다", () => {
    const result = validateAdminDatasetDraft({ datasetKey: "sample", uploadMode: "ZIP", publicVisible: false });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      "데이터명은 반드시 입력해야 합니다.",
      "업로드 방식은 CSV, API, API/CSV 중 하나여야 합니다.",
    ]));
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("기본 데이터셋은 고유 키를 가지며 시설 업로드를 지원한다", () => {
    const datasets = defaultAdminDatasets();
    expect(new Set(datasets.map((dataset) => dataset.datasetKey)).size).toBe(datasets.length);
    expect(canCommitUpload(datasets.find((dataset) => dataset.datasetKey === "facilities"))).toBe(true);
  });
});

describe("관리자 로그와 오류 모델", () => {
  it("백엔드 로그의 누락 필드를 안전한 기본값으로 바꾼다", () => {
    const log = mapBackendLog({ datasetKey: "sample", status: "SUCCESS" }, new Date("2026-06-19T00:00:00Z"));
    expect(log).toMatchObject({ datasetName: "sample", fileName: "-", rowCount: 0 });
    expect(uploadStatusLabel(log.status)).toBe("성공");
  });

  it("인증 실패를 사용자 메시지로 변환한다", () => {
    expect(friendlyAdminError({ status: 401 })).toBe("아이디 또는 비밀번호가 맞지 않습니다.");
  });
});
