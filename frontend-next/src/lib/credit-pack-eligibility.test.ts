import { describe, expect, it } from "vitest";
import { isCreditPackEligible } from "./credit-pack-eligibility";

describe("isCreditPackEligible", () => {
    it("allows an active free account", () => {
        expect(isCreditPackEligible({
            subscription_plan: "free",
            subscription_status: "active",
        })).toBe(true);
    });

    it.each(["tier1", "tier2", "tier4"])("allows an active %s subscriber", (subscription_plan) => {
        expect(isCreditPackEligible({
            subscription_plan,
            subscription_status: "active",
        })).toBe(true);
    });

    it("allows a legacy Pro subscriber", () => {
        expect(isCreditPackEligible({
            subscription_plan: "tier3",
            subscription_status: "active",
        })).toBe(true);
    });

    it("allows a paid subscriber who has scheduled cancellation", () => {
        expect(isCreditPackEligible({
            subscription_plan: "tier1",
            subscription_status: "cancelled",
        })).toBe(true);
    });

    it("allows a subscriber whose renewal charge is past due", () => {
        expect(isCreditPackEligible({
            subscription_plan: "tier2",
            subscription_status: "past_due",
        })).toBe(true);
    });

    it("allows established paid-plan aliases", () => {
        expect(isCreditPackEligible({
            subscription_plan: "lite",
            subscription_status: "active",
        })).toBe(true);
    });

    it.each(["pay_as_go", "small_pack"])("allows an older %s account", (subscription_plan) => {
        expect(isCreditPackEligible({ subscription_plan, subscription_status: "active" })).toBe(true);
    });

    it.each([
        ["revoked subscriber", { subscription_plan: "tier2", subscription_status: "revoked" }],
        ["missing subscription status", { subscription_plan: "tier2" }],
        ["unknown plan", { subscription_plan: "enterprise", subscription_status: "active" }],
        ["missing profile", null],
    ])("rejects a %s", (_label, profile) => {
        expect(isCreditPackEligible(profile)).toBe(false);
    });
});
