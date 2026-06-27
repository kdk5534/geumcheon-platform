import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAdminJson, loginAdminSession } from "../../js/pages/admin-api.js";

describe("관리자 세션 API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("로그인 자격정보를 Basic 헤더가 아닌 JSON 본문으로 전송한다", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { loginId: "operator", roles: ["OPERATOR"] } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { headerName: "X-XSRF-TOKEN", token: "csrf-token" } }) });
    vi.stubGlobal("fetch", fetchMock);

    await loginAdminSession("operator", "secret");

    const [, options] = fetchMock.mock.calls[0];
    expect(options.credentials).toBe("include");
    expect(options.headers.Authorization).toBeUndefined();
    expect(JSON.parse(options.body)).toEqual({ loginId: "operator", password: "secret" });
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
