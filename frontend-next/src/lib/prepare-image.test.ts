import { describe, expect, it } from "vitest";

import { getBase64PayloadSize } from "./prepare-image";

describe("getBase64PayloadSize", () => {
  it("measures the decoded size of the base64 part of a data URL", () => {
    expect(getBase64PayloadSize("data:image/jpeg;base64,QUJD")).toBe(3);
  });

  it("returns 0 when the string is not a data URL", () => {
    expect(getBase64PayloadSize("QUJD")).toBe(0);
  });
});
