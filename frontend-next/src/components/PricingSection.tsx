import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CREDIT_PACKS, PRICE_TAX_NOTE, SUBSCRIPTION_PLANS } from "@/lib/pricing-catalog";

type PricingSectionProps = {
  billingCycle: string;
  onBillingCycleChange: (cycle: string) => void;
  onSelectPlan: (planId: string, planName: string, planPrice: string) => void;
};

export const pricingPlans = SUBSCRIPTION_PLANS;

export default function PricingSection({
  billingCycle,
  onBillingCycleChange,
  onSelectPlan,
}: PricingSectionProps) {
  const isAnnual = billingCycle === "annual";

  return (
    <section id="pricing" className="relative overflow-hidden bg-yellow-tint py-24 sm:py-28 lg:py-32">
      <div className="relative z-10 mx-auto max-w-[1760px] px-5 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-5xl text-center">
          <p className="label-caps">Pricing</p>
          <h2 className="mt-7 font-outfit text-5xl font-bold leading-[0.94] tracking-[-0.075em] text-ink sm:text-6xl lg:text-[5.6rem]">
            Start free.
            <br />
            Pay per image.
          </h2>
          <p className="mt-7 text-xl text-ink-muted sm:text-2xl">150 free credits when you sign up, plus 15 every month. Upgrade or cancel anytime.</p>

          <div className="mx-auto mt-12 flex w-fit items-center rounded-full border border-line bg-white p-1.5 shadow-notebook">
            <button
              type="button"
              onClick={() => onBillingCycleChange("monthly")}
              className={`inline-flex h-11 items-center justify-center rounded-full px-6 text-[15px] font-semibold transition-colors ${
                !isAnnual ? "bg-brand-yellow text-ink" : "text-ink hover:bg-yellow-tint"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => onBillingCycleChange("annual")}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold transition-colors ${
                isAnnual ? "bg-brand-yellow text-ink" : "text-ink hover:bg-yellow-tint"
              }`}
            >
              Annual <span className="rounded-full bg-yellow-soft px-2 py-0.5 text-xs font-semibold">2 months free</span>
            </button>
          </div>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:mt-14 xl:grid-cols-4">
          {pricingPlans.map((plan) => (
            <article
              key={plan.id}
              className={`flex h-full flex-col rounded-2xl bg-white p-6 shadow-notebook sm:p-8 ${
                plan.featured
                  ? "border-2 border-brand-yellow"
                  : "border border-line"
              }`}
            >
              <div className="flex min-h-7 items-center justify-between gap-4">
                <h3 className="label-caps">{plan.name}</h3>
                {plan.featured && (
                    <span className="inline-flex h-7 items-center whitespace-nowrap rounded-full bg-brand-yellow px-3 text-xs font-semibold text-ink">
                    Recommended
                  </span>
                )}
              </div>

              <div className="mt-6 flex items-baseline gap-1 text-ink">
                <span className="font-outfit text-6xl font-bold leading-none tracking-[-0.075em]">
                  {isAnnual ? plan.annualPrice : plan.monthlyPrice}
                </span>
                <span className="text-xl text-ink-muted">/{isAnnual && plan.id !== "free" ? "yr" : "mo"}</span>
              </div>
              <p className="mt-5 whitespace-nowrap text-base font-semibold text-ink">{plan.credits}</p>
              {isAnnual && plan.id !== "free" && (
                <p className="mt-2 text-sm text-ink-muted">{plan.annualMonthlyPrice}/mo billed yearly</p>
              )}

              <ul className="mb-8 mt-8 space-y-3 text-base leading-6 text-ink-muted">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <span className="flex h-6 shrink-0 items-center"><Check className="h-4 w-4 text-ink" strokeWidth={2.25} aria-hidden="true" /></span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                type="button"
                onClick={() => onSelectPlan(plan.id, plan.name, isAnnual ? plan.annualPrice : plan.monthlyPrice)}
                variant={plan.featured ? "default" : "secondary"}
                className="mt-auto w-full"
              >
                {plan.cta}
              </Button>
            </article>
          ))}
        </div>

        <div className="mt-16">
          <div className="mx-auto max-w-3xl text-center">
            <h3 className="font-outfit text-3xl font-bold tracking-[-0.05em] text-ink sm:text-4xl">
              Fixing a whole media library?
            </h3>
            <p className="mt-3 text-lg text-ink-muted">
              Buy credits once. They never expire and work on every plan, including Free.{" "}
              <Link href="/bulk-generate-alt-text-wordpress" className="font-medium text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink">See how bulk processing works</Link>.
            </p>
            <p className="mt-3 text-base text-ink-muted">
              Each image uses 1 credit. For example, for 800 images your 150 free credits plus the {CREDIT_PACKS[0].price} pack is plenty. Once your site is connected, the plugin&apos;s Bulk page shows how many images need alt text and whether your credits cover them.
            </p>
          </div>
          <div className="mx-auto mt-8 grid max-w-5xl gap-5 md:grid-cols-3">
            {CREDIT_PACKS.map((pack) => (
              <article key={pack.id} className="flex h-full flex-col rounded-2xl border border-line bg-white p-6 shadow-notebook sm:p-8">
                <h4 className="label-caps">{pack.name}</h4>
                <div className="mt-5 flex items-baseline gap-2 text-ink">
                  <span className="font-outfit text-5xl font-bold leading-none tracking-[-0.075em]">{pack.price}</span>
                  <span className="text-base text-ink-muted">one-time</span>
                </div>
                <p className="mb-8 mt-4 text-base font-semibold text-ink">{pack.creditCount.toLocaleString()} credits</p>
                <Button
                  type="button"
                  onClick={() => onSelectPlan(pack.id, pack.name, pack.price)}
                  variant="secondary"
                  className="mt-auto w-full"
                >
                  Buy {pack.creditCount.toLocaleString()} credits
                </Button>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-12 text-center">
          <span className="inline-flex h-11 items-center rounded-full bg-yellow-soft px-6 text-base font-semibold text-ink">
            1 credit per successful image
          </span>
          <p className="mt-3 text-sm text-ink-muted">Failed requests don&apos;t use credits. Plan credits refresh monthly; signup and pack credits never expire.</p>
          <p className="mt-1 text-sm text-ink-muted">{PRICE_TAX_NOTE}</p>
        </div>
      </div>
    </section>
  );
}
