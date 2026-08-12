import { describe, expect, it } from "vitest";
import { sanitizeServerLogText } from "./safe-server-log";

describe("sanitizeServerLogText", () => {
  it("redacts customer identifiers and credentials", () => {
    const input = "person@example.com 27824595-99f6-468a-8f6c-58ebf62731a7 alt_secret_123456789?token=private";
    const output = sanitizeServerLogText(input);

    expect(output).not.toContain("person@example.com");
    expect(output).not.toContain("27824595-99f6-468a-8f6c-58ebf62731a7");
    expect(output).not.toContain("alt_secret_123456789");
    expect(output).not.toContain("token=private");
  });
});
