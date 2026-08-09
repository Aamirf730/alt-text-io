import { FileText, Globe2, Layers, Shield } from "lucide-react";

const benefits = [
  {
    icon: Layers,
    title: "Bulk generation",
    description: "Process one or thousands of images at once.",
  },
  {
    icon: Globe2,
    title: "130+ languages",
    description: "Generate useful descriptions around the world.",
  },
  {
    icon: FileText,
    title: "Context-aware",
    description: "Use surrounding content for better accuracy.",
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
      <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)] md:grid-cols-4">
        {benefits.map(({ icon: Icon, title, description }, index) => (
          <div
            key={title}
            className={`flex items-start gap-5 px-7 py-8 sm:px-9 lg:py-9 ${index > 0 ? "border-t border-slate-200 md:border-l md:border-t-0" : ""}`}
          >
            <Icon className="mt-0.5 h-12 w-12 shrink-0 stroke-[1.8] text-black" aria-hidden="true" />
            <div>
              <h2 className="font-outfit text-lg font-bold tracking-[-0.02em] text-black">{title}</h2>
              <p className="mt-2 text-base leading-6 text-slate-500">{description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
