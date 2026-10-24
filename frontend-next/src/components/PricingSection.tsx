import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CREDIT_PACKS, SUBSCRIPTION_PLANS } from "@/lib/pricing-catalog";

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
    <section id="pricing" className="relative overflow-hidden bg-[#fffef0] py-24 sm:py-28 lg:py-32">
      <div className="relative z-10 mx-auto max-w-[1760px] px-5 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-sm font-semibold text-black">Pricing</p>
          <h2 className="mt-7 font-outfit text-5xl font-bold leading-[0.94] tracking-[-0.075em] text-black sm:text-6xl lg:text-[5.6rem]">
            Simple pricing that scales
            <br />
            with your workflow.
          </h2>
          <p className="mt-7 text-xl text-slate-500 sm:text-2xl">Start free. Upgrade anytime.</p>

          <div className="mx-auto mt-12 flex w-fit items-center rounded-full border border-[#d9e0dc] bg-white p-1.5 shadow-sm">
            <button
              type="button"
              onClick={() => onBillingCycleChange("monthly")}
              className={`rounded-full px-6 py-3 text-base font-medium transition ${
                !isAnnual ? "bg-black text-white" : "text-black hover:bg-slate-50"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => onBillingCycleChange("annual")}
              className={`rounded-full px-6 py-3 text-base font-medium transition ${
                isAnnual ? "bg-black text-white" : "text-black hover:bg-slate-50"
              }`}
            >
              Annual <span className="ml-1 text-sm">2 months free</span>
            </button>
          </div>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:mt-14 xl:grid-cols-4">
          {pricingPlans.map((plan) => (
            <article
              key={plan.id}
              className={`flex min-h-[540px] flex-col rounded-[2rem] p-8 xl:p-9 ${
                plan.featured
                  ? "border-2 border-[#FEE11C] bg-[#fffbe2] shadow-[0_18px_44px_rgba(254,225,28,0.2)]"
                  : "border border-[#dbe2df] bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-base font-semibold uppercase tracking-[0.14em] text-slate-500">{plan.name}</h3>
                {plan.featured && (
                    <span className="whitespace-nowrap rounded-full bg-[#FEE11C] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-black">
                    Most popular
                  </span>
                )}
              </div>

              <div className="mt-6 flex items-baseline gap-1 text-black">
                <span className="font-outfit text-6xl font-bold leading-none tracking-[-0.075em]">
                  {isAnnual ? plan.annualPrice : plan.monthlyPrice}
                </span>
                <span className="text-xl text-slate-500">/{isAnnual && plan.id !== "free" ? "yr" : "mo"}</span>
              </div>
              <p className="mt-5 whitespace-nowrap text-base font-semibold text-black">{plan.credits}</p>
              {isAnnual && plan.id !== "free" && (
                <p className="mt-2 text-sm text-slate-500">{plan.annualMonthlyPrice}/mo billed yearly</p>
              )}

              <ul className="mt-10 space-y-5 text-base text-slate-500">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-black" strokeWidth={2} aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                type="button"
                onClick={() => onSelectPlan(plan.id, plan.name, isAnnual ? plan.annualPrice : plan.monthlyPrice)}
                className={`mt-auto h-14 w-full rounded-full text-base font-semibold transition hover:-translate-y-0.5 ${
                  plan.featured
                    ? "bg-[#FEE11C] text-black shadow-[0_12px_24px_rgba(254,225,28,0.28)] hover:bg-[#FEE11C]/90"
                    : "border border-[#dbe2df] bg-white text-black shadow-sm hover:bg-slate-50"
                }`}
              >
                {plan.cta}
              </Button>
            </article>
          ))}
        </div>

        <div className="mt-16">
          <div className="mx-auto max-w-3xl text-center">
            <h3 className="font-outfit text-3xl font-bold tracking-[-0.05em] text-black sm:text-4xl">
              Fixing a whole media library?
            </h3>
            <p className="mt-3 text-lg text-slate-500">
              Buy credits once. They never expire and work on every plan, including Free.
            </p>
          </div>
          <div className="mx-auto mt-8 grid max-w-5xl gap-5 md:grid-cols-3">
            {CREDIT_PACKS.map((pack) => (
              <article key={pack.id} className="flex flex-col rounded-[2rem] border border-[#dbe2df] bg-white p-8">
                <h4 className="text-base font-semibold uppercase tracking-[0.14em] text-slate-500">{pack.name}</h4>
                <div className="mt-5 flex items-baseline gap-2 text-black">
                  <span className="font-outfit text-5xl font-bold leading-none tracking-[-0.075em]">{pack.price}</span>
                  <span className="text-base text-slate-500">one-time</span>
                </div>
                <p className="mt-4 text-base font-semibold text-black">{pack.creditCount.toLocaleString()} credits</p>
                <Button
                  type="button"
                  onClick={() => onSelectPlan(pack.id, pack.name, pack.price)}
                  className="mt-8 h-12 w-full rounded-full border border-[#dbe2df] bg-white text-base font-semibold text-black shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
                >
                  Buy {pack.creditCount.toLocaleString()} credits
                </Button>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-12 text-center">
          <span className="inline-flex rounded-full bg-[#FEE11C] px-6 py-3 text-base font-bold text-black shadow-[0_10px_22px_rgba(254,225,28,0.22)]">
            1 credit per successful image
          </span>
          <p className="mt-3 text-sm text-slate-500">Simple, transparent pricing for every image.</p>
        </div>
      </div>
    </section>
  );
}
