// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { consumePendingDemoImage, savePendingDemoImage } from "./pending-demo-image";

const NOW = Date.parse("2026-10-29T12:00:00.000Z");
const IMAGE = "data:image/jpeg;base64,QUJD";

describe("pending demo image", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps the homepage image through email confirmation and returns it once", () => {
    expect(savePendingDemoImage(IMAGE, NOW)).toBe(true);
    expect(consumePendingDemoImage(NOW + 10 * 60_000)).toBe(IMAGE);
    expect(consumePendingDemoImage(NOW + 11 * 60_000)).toBeNull();
  });

  it("drops an image older than a day", () => {
    savePendingDemoImage(IMAGE, NOW);
    expect(consumePendingDemoImage(NOW + 25 * 60 * 60_000)).toBeNull();
  });

  it("refuses anything that is not an image data URL", () => {
    expect(savePendingDemoImage("https://example.com/a.jpg", NOW)).toBe(false);
    window.localStorage.setItem("altTextPro.pendingDemoImage", JSON.stringify({ dataUrl: "javascript:alert(1)", savedAt: NOW }));
    expect(consumePendingDemoImage(NOW)).toBeNull();
  });
});
