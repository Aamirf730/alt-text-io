import { FileText, Layers, PencilLine, Shield } from "lucide-react";

const benefits = [
  {
    icon: Layers,
    title: "Fix a whole library",
    description: "Fill missing alt text across thousands of images in one run.",
  },
  {
    icon: PencilLine,
    title: "Review and edit",
    description: "Change any description in WordPress, before or after it is saved.",
  },
  {
    icon: FileText,
    title: "Uses page context",
    description: "Optional post and site details help the AI describe what matters.",
  },
  {
    icon: Shield,
    title: "Pay per image",
    description: "One credit per image that succeeds. Failed attempts are free.",
  },
];

export default function BenefitsStrip() {
  return (
    <section aria-label="Alt Text Pro benefits" className="bg-white px-4 pb-12 sm:px-6 lg:px-8 lg:pb-16">
      <div className="mx-auto grid max-w-7xl overflow-hidden rounded-2xl border border-line bg-white shadow-notebook md:grid-cols-2 lg:grid-cols-4">
        {benefits.map(({ icon: Icon, title, description }, index) => (
          <div
            key={title}
            className={`flex items-start gap-4 p-6 lg:p-8 ${index > 0 ? "border-t border-line" : ""} ${index === 1 ? "md:border-l md:border-t-0" : ""} ${index === 2 ? "md:border-t lg:border-l lg:border-t-0" : ""} ${index === 3 ? "md:border-l lg:border-t-0" : ""}`}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yellow-soft text-ink">
              <Icon className="h-6 w-6 stroke-[1.8]" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-outfit text-lg font-bold leading-6 tracking-[-0.02em] text-ink">{title}</h2>
              <p className="mt-1 text-base leading-6 text-ink-muted">{description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
