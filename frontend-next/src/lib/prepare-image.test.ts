import { describe, expect, it } from "vitest";

import { getBase64PayloadSize, getNextImageSize } from "./prepare-image";

describe("getBase64PayloadSize", () => {
  it("measures the decoded size of the base64 part of a data URL", () => {
    expect(getBase64PayloadSize("data:image/jpeg;base64,QUJD")).toBe(3);
  });

  it("returns 0 when the string is not a data URL", () => {
    expect(getBase64PayloadSize("QUJD")).toBe(0);
  });
});

describe("getNextImageSize", () => {
  it("shrinks both sides by the same factor, keeping a banner's shape", () => {
    expect(getNextImageSize(1600, 100)).toEqual({ width: 1280, height: 80 });
    expect(getNextImageSize(1200, 1600)).toEqual({ width: 960, height: 1280 });
  });

  it("never makes a side larger", () => {
    let size: { width: number; height: number } | null = { width: 1600, height: 100 };
    while (size) {
      const next = getNextImageSize(size.width, size.height);
      if (next) {
        expect(next.width).toBeLessThan(size.width);
        expect(next.height).toBeLessThanOrEqual(size.height);
      }
      size = next;
    }
  });

  it("stops once the image is small, so the caller gives up instead of looping", () => {
    expect(getNextImageSize(320, 200)).toBeNull();
    expect(getNextImageSize(2, 1)).toBeNull();

    let size: { width: number; height: number } | null = { width: 1600, height: 1600 };
    let steps = 0;
    while (size) {
      size = getNextImageSize(size.width, size.height);
      steps += 1;
    }
    expect(steps).toBeLessThan(10);
  });
});
