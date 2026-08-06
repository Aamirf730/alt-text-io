import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const connectDirectory = path.resolve(process.cwd(), "src/app/connect");
const pageSource = fs.readFileSync(path.join(connectDirectory, "page.tsx"), "utf8");
const stateStyles = fs.readFileSync(path.join(connectDirectory, "connect-states.css"), "utf8");

describe("WordPress connect result screens", () => {
    it("loads shared styling before any early result-state return", () => {
        expect(pageSource).toContain('import "./connect-states.css";');

        for (const className of [
            "connect-loading",
            "connect-confirmation",
            "connect-recovery",
            "connect-success",
        ]) {
            expect(stateStyles).toContain(`.${className}`);
        }
    });

    it("keeps a recovered API key masked until the customer reveals it", () => {
        expect(pageSource).toContain('type={isManualApiKeyVisible ? "text" : "password"}');
        expect(pageSource).toContain('aria-label={isManualApiKeyVisible ? "Hide API key" : "Show API key"}');
        expect(pageSource).toContain("data-1p-ignore=\"true\"");
    });

    it("keeps the primary connection flow on the Alt Text Pro teal palette", () => {
        expect(pageSource).toContain("background: linear-gradient(135deg, #0f5b66 0%, #167b83 100%)");
        expect(pageSource).toContain("margin: 0 auto 16px");
        expect(pageSource).not.toContain("#6366f1");
        expect(pageSource).not.toContain("#8b5cf6");
    });
});
