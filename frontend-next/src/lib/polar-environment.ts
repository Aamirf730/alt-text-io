/**
 * Polar server for every billing route. Production unless explicitly set to
 * "sandbox", so a missing variable can never send live checkouts to the
 * sandbox while the customer portal uses production.
 */
export function getPolarServer(): "sandbox" | "production" {
    return process.env.POLAR_ENVIRONMENT === "sandbox" ? "sandbox" : "production";
}
