import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  Clock,
  FileStack,
  Layers,
  ListChecks,
  PauseCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import JsonLd from "@/components/JsonLd";

const pageUrl = "https://www.alt-text.pro/bulk-generate-alt-text-wordpress";

export const metadata: Metadata = {
  title: "How to Bulk Generate Alt Text in WordPress | Alt Text Pro",
  description:
    "Bulk generate AI alt text for WordPress media-library images, review results safely, and fix missing alt text across old posts, pages, and product images.",
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    title: "How to Bulk Generate Alt Text in WordPress",
    description:
      "Use Alt Text Pro to bulk generate alt text for missing WordPress media-library image descriptions.",
    url: pageUrl,
    siteName: "Alt Text Pro",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Bulk Generate Alt Text in WordPress",
    description:
      "Bulk generate AI alt text for WordPress media-library images and older content.",
  },
};

const bulkWorkflow = [
  {
    title: "Audit missing alt text",
    copy: "Find images that need descriptions before spending credits. Focus on missing or weak alt text first.",
    icon: ListChecks,
  },
  {
    title: "Run a small batch",
    copy: "Start with a handful of images so you can confirm output quality and credit usage before scaling.",
    icon: Layers,
  },
  {
    title: "Review generated text",
    copy: "Check important pages, product images, and hero visuals for context-specific accuracy.",
    icon: ShieldCheck,
  },
  {
    title: "Scale the cleanup",
    copy: "Once the process looks right, continue with larger media-library batches and monitor credits.",
    icon: RefreshCw,
  },
];

const idealFor = [
  "Old WordPress media libraries with missing alt text",
  "Blog archives with hundreds of image uploads",
  "WooCommerce catalogs imported without image descriptions",
  "Agency accessibility and SEO cleanup projects",
  "Site migrations where media metadata was lost",
  "Publishers preparing older content for search and accessibility audits",
];

const faqs = [
  {
    question: "Is it safe to bulk generate alt text for every image?",
    answer:
      "Start with a small batch first. Bulk processing is useful, but important images should still be reviewed because the best alt text depends on page context.",
  },
  {
    question: "Can I cancel a bulk alt text job?",
    answer:
      "Yes. The WordPress plugin includes cancellation handling for bulk processing. Already completed successful generations still use credits.",
  },
  {
    question: "Should I overwrite existing alt text?",
    answer:
      "Usually no for the first pass. Start by filling missing alt text. Only overwrite existing descriptions when you have reviewed the current quality.",
  },
  {
    question: "How many credits does bulk processing use?",
    answer:
      "Each successful image generation uses 1 credit. Use a small batch first to confirm the workflow before processing a large media library.",
  },
];

export default function BulkGenerateAltTextWordPressPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to bulk generate alt text in WordPress",
    description:
      "A safe workflow for bulk generating AI alt text for missing WordPress image descriptions.",
    step: bulkWorkflow.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.title,
      text: step.copy,
    })),
  };

  return (
    <div className="min-h-screen bg-notebook-paper text-notebook-slate">
      <Navbar />
      <JsonLd data={structuredData} />

      <main>
        <section className="relative overflow-hidden border-b border-notebook-blue/5">
          <div className="absolute inset-0 bg-gradient-to-b from-notebook-blue/5 via-transparent to-transparent pointer-events-none" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 relative z-10">
            <div className="grid lg:grid-cols-[1fr_0.9fr] gap-14 items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white border border-notebook-blue/10 px-4 py-2 mb-8 shadow-sm">
                  <FileStack className="h-4 w-4 text-notebook-blue" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-notebook-blue font-outfit">
                    Media Library Cleanup
                  </span>
                </div>

                <h1 className="text-5xl lg:text-7xl font-bold font-outfit tracking-tight leading-[1.05] mb-8">
                  How to Bulk Generate Alt Text in WordPress
                </h1>

                <p className="text-xl text-slate-500 leading-relaxed max-w-2xl mb-10">
                  Use AI to fill missing alt text across your WordPress media library, old blog posts, pages, and product images without writing every description manually.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 mb-10">
                  <Link
                    href="/?auth=signup"
                    className="inline-flex h-14 items-center justify-center rounded-full bg-notebook-blue px-8 text-sm font-bold uppercase tracking-widest text-white shadow-notebook hover:bg-notebook-blue/90 transition-colors font-outfit"
                  >
                    Get 150 Free Credits
                    <ArrowRight className="ml-3 h-4 w-4" />
                  </Link>
                  <Link
                    href="/docs#installation"
                    className="inline-flex h-14 items-center justify-center rounded-full border border-notebook-blue/10 bg-white px-8 text-sm font-bold uppercase tracking-widest text-notebook-slate hover:text-notebook-blue transition-colors font-outfit"
                  >
                    Setup Guide
                  </Link>
                </div>

                <div className="grid sm:grid-cols-3 gap-3 max-w-2xl">
                  {["Missing alt text", "Small test batches", "Credit tracking"].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                      <CheckCircle className="h-4 w-4 text-notebook-blue" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-notebook-blue/10 rounded-[2.5rem] p-6 lg:p-8 shadow-notebook-lg">
                <div className="rounded-[2rem] bg-notebook-paper border border-notebook-blue/5 p-6 mb-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-2xl bg-white border border-notebook-blue/10 flex items-center justify-center">
                        <FileStack className="h-6 w-6 text-notebook-blue" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 font-outfit">
                          Bulk batch
                        </p>
                        <p className="text-sm font-semibold text-notebook-slate">
                          24 missing descriptions selected
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-notebook-blue/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-notebook-blue">
                      Review
                    </span>
                  </div>

                  <div className="space-y-3">
                    {[
                      { label: "Images queued", value: "24" },
                      { label: "Estimated credits", value: "24" },
                      { label: "Recommended first batch", value: "5" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between rounded-2xl bg-white border border-notebook-blue/5 px-5 py-4">
                        <span className="text-sm font-semibold text-slate-500">{item.label}</span>
                        <span className="text-xl font-bold text-notebook-slate font-outfit">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Batch review", icon: ListChecks },
                    { label: "Cancel safe", icon: PauseCircle },
                    { label: "Credit aware", icon: Zap },
                    { label: "History logs", icon: Clock },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="rounded-2xl border border-notebook-blue/5 bg-white p-4">
                        <Icon className="h-5 w-5 text-notebook-blue mb-3" />
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 font-outfit">
                          {item.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 bg-white border-b border-notebook-blue/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mb-12">
              <h2 className="text-3xl lg:text-5xl font-bold font-outfit tracking-tight mb-5">
                When bulk alt text generation makes sense
              </h2>
              <p className="text-lg text-slate-500 leading-relaxed">
                Bulk generation is best when you have a clear cleanup target: images with missing alt text, imported media, or older content that needs accessibility and SEO maintenance.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {idealFor.map((item) => (
                <div key={item} className="rounded-[2rem] bg-notebook-paper border border-notebook-blue/5 p-6">
                  <CheckCircle className="h-5 w-5 text-notebook-blue mb-5" />
                  <p className="text-notebook-slate font-semibold leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 bg-notebook-paper border-b border-notebook-blue/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12">
              <div>
                <h2 className="text-3xl lg:text-5xl font-bold font-outfit tracking-tight mb-5">
                  Safe bulk processing workflow
                </h2>
                <p className="text-lg text-slate-500 leading-relaxed">
                  A careful bulk workflow protects credits and quality. The goal is not just more descriptions, but useful descriptions that fit your content.
                </p>
              </div>

              <div className="space-y-4">
                {bulkWorkflow.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.title} className="rounded-[2rem] bg-white border border-notebook-blue/5 p-6 flex gap-5">
                      <div className="h-12 w-12 rounded-2xl bg-notebook-blue/5 border border-notebook-blue/10 flex items-center justify-center shrink-0">
                        <Icon className="h-5 w-5 text-notebook-blue" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 font-outfit">
                          Step {index + 1}
                        </p>
                        <h3 className="text-xl font-bold font-outfit mb-2">{step.title}</h3>
                        <p className="text-slate-500 leading-relaxed">{step.copy}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 bg-white border-b border-notebook-blue/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-start">
              <div>
                <h2 className="text-3xl lg:text-5xl font-bold font-outfit tracking-tight mb-5">
                  What to check before a large batch
                </h2>
                <p className="text-lg text-slate-500 leading-relaxed">
                  Before processing hundreds of images, confirm your settings, review one result, and keep enough credits for the batch size you choose.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  "Connection is active",
                  "Credits are available",
                  "Overwrite setting is intentional",
                  "First result is reviewed",
                  "Batch size is manageable",
                  "Important pages are checked",
                ].map((item) => (
                  <div key={item} className="rounded-3xl bg-notebook-paper border border-notebook-blue/5 p-6">
                    <Sparkles className="h-5 w-5 text-notebook-blue mb-4" />
                    <p className="font-semibold text-notebook-slate">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 bg-notebook-paper">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-5xl font-bold font-outfit tracking-tight mb-5">
                Bulk alt text FAQ
              </h2>
              <p className="text-lg text-slate-500">
                Practical answers before running a media-library cleanup.
              </p>
            </div>

            <div className="space-y-4">
              {faqs.map((faq) => (
                <div key={faq.question} className="rounded-[2rem] bg-white border border-notebook-blue/5 p-7">
                  <h3 className="text-xl font-bold font-outfit mb-3">{faq.question}</h3>
                  <p className="text-slate-500 leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 rounded-[2.5rem] bg-white border border-notebook-blue/10 p-8 lg:p-10 text-center shadow-notebook">
              <h2 className="text-3xl font-bold font-outfit tracking-tight mb-4">
                Bulk-fix missing WordPress alt text.
              </h2>
              <p className="text-slate-500 mb-8">
                Start with one image, then run a small batch before scaling to the whole media library.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link
                  href="/?auth=signup"
                  className="inline-flex h-14 items-center justify-center rounded-full bg-notebook-blue px-8 py-4 text-sm font-bold uppercase tracking-widest text-white shadow-notebook hover:bg-notebook-blue/90 transition-colors font-outfit"
                >
                  Get 150 Free Credits
                </Link>
                <Link
                  href="/woocommerce-product-image-alt-text"
                  className="inline-flex h-14 items-center justify-center rounded-full border border-notebook-blue/10 bg-white px-8 py-4 text-sm font-bold uppercase tracking-widest text-notebook-slate hover:text-notebook-blue transition-colors font-outfit"
                >
                  WooCommerce Guide
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
