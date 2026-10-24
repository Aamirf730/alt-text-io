import { FileText, Layers, PencilLine, Shield } from "lucide-react";

const benefits = [
  {
    icon: Layers,
    title: "Bulk generation",
    description: "Process one or thousands of images at once.",
  },
  {
    icon: PencilLine,
    title: "Review and edit",
    description: "Keep human control before saving a suggestion.",
  },
  {
    icon: FileText,
    title: "Context-aware",
    description: "Use surrounding content to produce more relevant drafts.",
  },
  {
    icon: Shield,
    title: "Transparent Usage",
    description: "One transparent credit for every successful image.",
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
