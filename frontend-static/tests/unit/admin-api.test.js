import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAdminAuthHeader, fetchAdminJson } from "../../js/pages/admin-api.js";

describe("관리자 API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("한글 자격 증명도 UTF-8 Basic 헤더로 인코딩한다", () => {
    const header = buildAdminAuthHeader("관리자", "비밀번호");
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(header.slice(6)), (char) => char.charCodeAt(0)));
    expect(decoded).toBe("관리자:비밀번호");
  });

  it("HTTP 실패의 상태와 서버 메시지를 보존한다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ message: "forbidden" }),
    })));

    await expect(fetchAdminJson("https://example.test/admin")).rejects.toMatchObject({
      message: "forbidden",
      status: 403,
      isHttpFailure: true,
    });
  });
});
