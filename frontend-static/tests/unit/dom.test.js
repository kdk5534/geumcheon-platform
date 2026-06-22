import { describe, expect, it } from "vitest";
import { clamp01, escapeHtml, formatBytes, formatMockTimestamp } from "../../js/core/dom.js";

describe("DOM 문자열 유틸", () => {
  it("외부 문자열의 HTML 특수문자를 모두 이스케이프한다", () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')"> &`))
      .toBe("&lt;img src=x onerror=&quot;alert(&#039;x&#039;)&quot;&gt; &amp;");
  });

  it("바이트 크기를 경계값에 맞게 표시한다", () => {
    expect(formatBytes(1023)).toBe("1023B");
    expect(formatBytes(1024)).toBe("1.0KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0MB");
  });

  it("비율을 0과 1 사이로 제한한다", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(2)).toBe(1);
  });

  it("고정 날짜를 한국어 화면 형식으로 변환한다", () => {
    const date = new Date(2026, 5, 19, 2, 32);
    expect(formatMockTimestamp(date)).toBe("2026.06.19 02:32");
  });
});
