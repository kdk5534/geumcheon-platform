import { afterEach, describe, expect, it, vi } from "vitest";
import { approvedLanguages } from "../../js/core/i18n.js";

describe("approved language policy", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("publishes Korean only by default", () => {
    expect(approvedLanguages()).toEqual(["ko"]);
  });

  it("exposes only explicitly approved supported languages", () => {
    vi.stubGlobal("window", { __ENV__: { APPROVED_LANGUAGES: "ko,en,invalid,ja" } });
    expect(approvedLanguages()).toEqual(["ko", "en", "ja"]);
  });
});
