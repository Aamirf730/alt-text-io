import { describe, expect, it } from "vitest";
import { isCreditPackEligibleSubscriber } from "./credit-pack-eligibility";

describe("isCreditPackEligibleSubscriber", () => {
    it.each(["monthly", "annual"])("allows an active paid %s subscriber", (billing_cycle) => {
        expect(isCreditPackEligibleSubscriber({
            subscription_plan: "tier2",
            subscription_status: "active",
            billing_cycle,
        })).toBe(true);
    });

    it("allows a paid subscriber who has scheduled cancellation", () => {
        expect(isCreditPackEligibleSubscriber({
            subscription_plan: "tier1",
            subscription_status: "cancelled",
            billing_cycle: "annual",
        })).toBe(true);
    });

    it("allows established paid-plan aliases", () => {
        expect(isCreditPackEligibleSubscriber({
            subscription_plan: "lite",
            subscription_status: "active",
            billing_cycle: "annual",
        })).toBe(true);
    });

    it.each([
        ["free account", { subscription_plan: "free", subscription_status: "active", billing_cycle: "monthly" }],
        ["revoked monthly subscriber", { subscription_plan: "tier2", subscription_status: "revoked", billing_cycle: "monthly" }],
        ["unsupported billing cycle", { subscription_plan: "tier2", subscription_status: "active", billing_cycle: "weekly" }],
        ["missing subscription status", { subscription_plan: "tier2", billing_cycle: "monthly" }],
    ])("rejects a %s", (_label, profile) => {
        expect(isCreditPackEligibleSubscriber(profile)).toBe(false);
    });
});
