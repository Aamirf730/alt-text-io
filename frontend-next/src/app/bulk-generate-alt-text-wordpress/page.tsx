import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
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
  title: "Bulk Fix Missing Alt Text in WordPress | Alt Text Pro",
  description:
    "Find WordPress images with no alt text and fill them in one run. Stop anytime, keep the alt text you already wrote, and pay 1 credit per image.",
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    title: "Bulk Fix Missing Alt Text in WordPress | Alt Text Pro",
    description:
      "Find WordPress images with no alt text and fill them in one run. Stop anytime, keep the alt text you already wrote, and pay 1 credit per image.",
    url: pageUrl,
    siteName: "Alt Text Pro",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bulk Fix Missing Alt Text in WordPress | Alt Text Pro",
    description:
      "Find WordPress images with no alt text and fill them in one run. Stop anytime, keep the alt text you already wrote, and pay 1 credit per image.",
  },
};

const bulkWorkflow = [
  {
    title: "Check what is missing",
    copy: "Open Alt Text Pro, then Bulk Process. The page shows how many images have no alt text and how many credits you have.",
    icon: ListChecks,
  },
  {
    title: "Test on a few images",
    copy: "Choose Process selected images and pick a handful. Read the results before you commit credits to the whole library.",
    icon: Layers,
  },
  {
    title: "Run the missing alt text pass",
    copy: "Choose Process images missing alt-text and start. Leave overwrite off so existing alt text is kept. One run covers up to your newest 20,000 images.",
    icon: RefreshCw,
  },
  {
    title: "Review the important images",
    copy: "Check hero images, product photos, and anything on key pages. Edit in the media library, or export the log as CSV to read through the results.",
    icon: ShieldCheck,
  },
];

const idealFor = [
  "Old WordPress media libraries with missing alt text",
  "Blog archives with hundreds of image uploads",
  "WooCommerce catalogs imported without image descriptions",
  "Agency accessibility and SEO cleanup projects",
  "Site migrations where media metadata was lost",
  "Publishers preparing older content for an accessibility review",
];

const faqs = [
  {
    question: "Will it overwrite alt text I already wrote?",
    answer:
      "Not unless you choose to. The default option only processes images with no alt text, and replacing existing alt text is a separate setting that is off by default.",
  },
  {
    question: "Can I stop a bulk run?",
    answer:
      "Yes. Click Stop after current image. The image already being generated finishes and is counted, and no new image starts.",
  },
  {
    question: "How many images can one run handle?",
    answer:
      "One run covers up to your newest 20,000 images. If your library is bigger, start another run when it finishes to continue with older images.",
  },
  {
    question: "How many credits will it use?",
    answer:
      "One credit for each image that gets alt text. Failed images do not use credits. For a one-off backlog, a credit pack lets you pay once instead of changing your plan, and pack credits never expire.",
  },
  {
    question: "Does it also fix images inside my posts?",
    answer:
      "Bulk processing updates the alt text stored in the media library. To also fill empty alt attributes in a post's content, use Add Alt Text in the Posts or Pages list. It keeps any alt text the author already wrote.",
  },
];

export default function BulkGenerateAltTextWordPressPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to bulk fix missing alt text in WordPress",
    description:
      "Find WordPress media library images with no alt text, test on a few, then fill the rest in one run with Alt Text Pro.",
    step: bulkWorkflow.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.title,
      text: step.copy,
    })),
  };

  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-white text-ink">
      <Navbar />
      <JsonLd data={structuredData} />
      <JsonLd data={faqStructuredData} />

      <main>
        <section className="relative overflow-hidden border-b border-line">
          <div className="absolute inset-0 bg-gradient-to-b from-yellow-tint via-transparent to-transparent pointer-events-none" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 relative z-10">
            <div className="grid lg:grid-cols-[1fr_0.9fr] gap-14 items-center">
              <div>
                <div className="inline-flex h-8 items-center gap-2 rounded-full bg-yellow-soft px-3 mb-8">
                  <FileStack className="h-4 w-4 text-ink" />
                  <span className="label-caps">
                    Media Library Cleanup
                  </span>
                </div>

                <h1 className="text-5xl lg:text-7xl font-bold font-outfit tracking-tight leading-[1.05] mb-8">
                  Bulk Fix Missing Alt Text in WordPress
                </h1>

                <p className="text-xl text-ink-muted leading-relaxed max-w-2xl mb-10">
                  Alt Text Pro finds the images in your media library that have no alt text and writes a description for each one. You watch the progress, stop when you want, and edit any result afterwards.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 mb-10">
                  <Link
                    href="/?auth=signup"
                    className={buttonVariants()}
                  >
                    Get 150 Free Credits
                    <ArrowRight aria-hidden="true" />
                  </Link>
                  <Link
                    href="/docs#installation"
                    className={buttonVariants({ variant: "secondary" })}
                  >
                    Setup Guide
                  </Link>
                </div>

                <div className="grid sm:grid-cols-3 gap-3 max-w-2xl">
                  {["Missing alt text only", "Stop anytime", "1 credit per image"].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm font-semibold text-ink-muted">
                      <CheckCircle className="h-4 w-4 text-ink" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-line rounded-2xl p-6 lg:p-8 shadow-notebook-lg">
                <div className="rounded-2xl bg-white border border-line p-6 mb-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-yellow-soft flex items-center justify-center shrink-0">
                        <FileStack className="h-6 w-6 text-ink" />
                      </div>
                      <div>
                        <p className="label-caps">
                          Bulk batch
                        </p>
                        <p className="text-sm font-semibold text-ink">
                          24 missing descriptions selected
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex h-7 items-center rounded-full bg-yellow-soft px-3 text-xs font-semibold text-ink">
                      Review
                    </span>
                  </div>

                  <div className="space-y-3">
                    {[
                      { label: "Images queued", value: "24" },
                      { label: "Estimated credits", value: "24" },
                      { label: "Already described, skipped", value: "312" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between rounded-2xl bg-white border border-line px-5 py-4">
                        <span className="text-sm font-semibold text-ink-muted">{item.label}</span>
                        <span className="text-xl font-bold text-ink font-outfit">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Live progress", icon: ListChecks },
                    { label: "Stop anytime", icon: PauseCircle },
                    { label: "Credit check", icon: Zap },
                    { label: "CSV logs", icon: Clock },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="rounded-2xl border border-line bg-white p-4">
                        <Icon className="h-5 w-5 text-ink mb-3" />
                        <p className="label-caps">
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

        <section className="py-20 bg-white border-b border-line">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mb-12">
              <h2 className="text-3xl lg:text-5xl font-bold font-outfit tracking-tight mb-5">
                When to use bulk processing
              </h2>
              <p className="text-lg text-ink-muted leading-relaxed">
                Bulk processing is for a backlog: a media library built up over years, an import that lost its metadata, or a store catalog that never had alt text. For a single image, the{" "}
                <Link href="/ai-alt-text-generator-for-wordpress" className="font-medium text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink">media editor button</Link> is quicker.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {idealFor.map((item) => (
                <div key={item} className="rounded-2xl bg-white border border-line p-6">
                  <CheckCircle className="h-5 w-5 text-ink mb-5" />
                  <p className="text-ink font-semibold leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 bg-white border-b border-line">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12">
              <div>
                <h2 className="text-3xl lg:text-5xl font-bold font-outfit tracking-tight mb-5">
                  How to run a bulk fix
                </h2>
                <p className="text-lg text-ink-muted leading-relaxed">
                  A few minutes of checking up front saves credits, and saves you from a library full of descriptions you would rewrite anyway.
                </p>
              </div>

              <div className="space-y-4">
                {bulkWorkflow.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.title} className="rounded-2xl bg-white border border-line p-6 flex gap-5">
                      <div className="h-12 w-12 rounded-xl bg-yellow-soft flex items-center justify-center shrink-0">
                        <Icon className="h-5 w-5 text-ink" />
                      </div>
                      <div>
                        <p className="label-caps mb-2">
                          Step {index + 1}
                        </p>
                        <h3 className="text-xl font-bold font-outfit mb-2">{step.title}</h3>
                        <p className="text-ink-muted leading-relaxed">{step.copy}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 bg-white border-b border-line">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-start">
              <div>
                <h2 className="text-3xl lg:text-5xl font-bold font-outfit tracking-tight mb-5">
                  Before a large run
                </h2>
                <p className="text-lg text-ink-muted leading-relaxed">
                  Large runs take time and use credits, so check these first. Short on credits? Credit packs never expire and work on every plan. Compare{" "}
                  <Link href="/#pricing" className="font-medium text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink">plans and credit packs</Link>.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  "Connection is active",
                  "Enough credits for the run",
                  "Overwrite is off, unless you mean it",
                  "A few test results reviewed",
                  "Key pages noted for review",
                  "Product photos checked for names",
                ].map((item) => (
                  <div key={item} className="rounded-2xl bg-white border border-line p-6">
                    <Sparkles className="h-5 w-5 text-ink mb-4" />
                    <p className="font-semibold text-ink">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-5xl font-bold font-outfit tracking-tight mb-5">
                Questions about bulk processing
              </h2>
              <p className="text-lg text-ink-muted">
                Answers before you run a media library cleanup.
              </p>
            </div>

            <div className="space-y-4">
              {faqs.map((faq) => (
                <div key={faq.question} className="rounded-2xl bg-white border border-line p-6">
                  <h3 className="text-xl font-bold font-outfit mb-3">{faq.question}</h3>
                  <p className="text-ink-muted leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 rounded-2xl bg-white border border-line p-8 lg:p-10 text-center shadow-notebook">
              <h2 className="text-3xl font-bold font-outfit tracking-tight mb-4">
                Clear your alt text backlog.
              </h2>
              <p className="text-ink-muted mb-8">
                Start with 150 free credits. Test a few images, then run the rest. Setup steps are in the{" "}
                <Link href="/docs#wordpress-plugin" className="font-medium text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink">docs</Link>.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link
                  href="/?auth=signup"
                  className={buttonVariants()}
                >
                  Get 150 Free Credits
                </Link>
                <Link
                  href="/woocommerce-product-image-alt-text"
                  className={buttonVariants({ variant: "secondary" })}
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
