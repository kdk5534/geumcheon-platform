import { afterEach, describe, expect, it } from "vitest";
import { bindTileFailureFallback, createBaseTileLayer, isExternalAssetsEnabled } from "../../js/core/assets.js";

const originalEnv = globalThis.window?.__ENV__;
const hadWindow = Boolean(globalThis.window);

afterEach(() => {
  if (!hadWindow) {
    delete globalThis.window;
  } else if (globalThis.window) {
    globalThis.window.__ENV__ = originalEnv;
  }
});

describe("VWorld map provider", () => {
  it("uses the server proxy without exposing a provider key", () => {
    const calls = [];
    const L = { tileLayer: (url, options) => { calls.push({ url, options }); return { on() {} }; } };

    createBaseTileLayer(L, "satellite");

    expect(calls[0].url).toContain("/api/public/map/tiles/satellite/{z}/{y}/{x}");
    expect(calls[0].url).not.toContain("api.vworld.kr");
    expect(calls[0].url).not.toMatch(/key=/i);
  });

  it("activates the list fallback after repeated tile errors", () => {
    const handlers = {};
    const layer = { on: (event, handler) => { handlers[event] = handler; } };
    let fallbackCount = 0;

    bindTileFailureFallback(layer, () => { fallbackCount += 1; }, 2);
    handlers.tileerror();
    handlers.tileerror();
    handlers.tileerror();

    expect(fallbackCount).toBe(1);
  });

  it("allows Leaflet assets in local preview when a backend proxy is configured", () => {
    if (!globalThis.window) {
      globalThis.window = { location: { hostname: "localhost" } };
    }
    globalThis.window.__ENV__ = { BACKEND_API_BASE: "http://localhost:8080" };

    expect(isExternalAssetsEnabled()).toBe(true);
  });
});
