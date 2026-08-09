import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  Chrome,
  FileText,
  Image as ImageIcon,
  Layers,
  Search,
  Shield,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { PLUGIN_VERSION } from "@/lib/utils";

const pageUrl = "https://www.alt-text.pro/ai-alt-text-generator-for-wordpress";

export const metadata: Metadata = {
  title: "AI Alt Text Generator for WordPress | Alt Text Pro",
  description:
    "Use Alt Text Pro to generate AI alt text for WordPress images, bulk-fix missing media-library alt text, and improve accessibility with 150 free signup credits plus 15 every month.",
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    title: "AI Alt Text Generator for WordPress",
    description:
      "Generate useful alt text for WordPress media-library, post, page, and WooCommerce images with AI.",
    url: pageUrl,
    siteName: "Alt Text Pro",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Alt Text Generator for WordPress",
    description:
      "Generate AI alt text for WordPress images and bulk-fix missing media-library descriptions.",
  },
};

const setupSteps = [
  {
    title: "Create your free account",
    copy: "Start with 150 free credits, then 15 free credits every month, so you can test the complete WordPress workflow before upgrading.",
    icon: Sparkles,
  },
  {
    title: "Install the WordPress plugin",
    copy: `Use WordPress.org or download plugin version ${PLUGIN_VERSION} directly from your Alt Text Pro dashboard.`,
    icon: Chrome,
  },
  {
    title: "Connect your site",
    copy: "Open Alt Text Pro in wp-admin and click Connect. The plugin can save your API key automatically.",
    icon: Zap,
  },
  {
    title: "Generate one image first",
    copy: "Run a single image generation, review the result, then move to posts, pages, products, or bulk processing.",
    icon: ImageIcon,
  },
];

const useCases = [
  "Fill missing alt text across old media-library uploads",
  "Generate descriptions for new WordPress uploads",
  "Fix product image alt text for WooCommerce stores",
  "Add image descriptions inside posts and pages",
  "Create a repeatable workflow for client SEO and accessibility cleanups",
];

const faqs = [
  {
    question: "Does AI alt text replace manual review?",
    answer:
      "No. AI gives you a strong starting point, but the best alt text depends on the purpose of the image on that specific page. Review important images before publishing.",
  },
  {
    question: "Can it bulk generate alt text in WordPress?",
    answer:
      "Yes. Alt Text Pro includes bulk processing for media-library images that are missing alt text. Start with one image first, then run a smaller batch before processing a large library.",
  },
  {
    question: "Does it work with WooCommerce product images?",
    answer:
      "Yes. WooCommerce product images are a practical use case, especially when a catalog has many missing image descriptions.",
  },
  {
    question: "How do credits work?",
    answer:
      "Each successful alt text generation uses 1 credit. Failed generations do not consume credits.",
  },
];

export default function AiAltTextGeneratorForWordPressPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Alt Text Pro",
    applicationCategory: "WordPressPlugin",
    operatingSystem: "WordPress",
    url: pageUrl,
    description:
      "AI alt text generator for WordPress media-library, post, page, and WooCommerce images.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free account includes 150 signup credits plus 15 every month.",
    },
  };

  return (
    <div className="min-h-screen bg-notebook-paper text-notebook-slate">
      <Navbar />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <main>
        <section className="relative overflow-hidden border-b border-notebook-blue/5">
          <div className="absolute inset-0 bg-gradient-to-b from-notebook-blue/5 via-transparent to-transparent pointer-events-none" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 relative z-10">
            <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white border border-notebook-blue/10 px-4 py-2 mb-8 shadow-sm">
                  <Sparkles className="h-4 w-4 text-notebook-blue" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-notebook-blue font-outfit">
                    WordPress AI Alt Text
                  </span>
                </div>

                <h1 className="text-5xl lg:text-7xl font-bold font-outfit tracking-tight leading-[1.05] mb-8">
                  AI Alt Text Generator for WordPress
                </h1>

                <p className="text-xl text-slate-500 leading-relaxed max-w-2xl mb-10">
                  Generate useful alt text for WordPress images, bulk-fix missing media-library descriptions, and improve accessibility without writing every image description by hand.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 mb-10">
                  <Link
                    href="/"
                    className="inline-flex h-14 items-center justify-center rounded-full bg-notebook-blue px-8 text-sm font-bold uppercase tracking-widest text-white shadow-notebook hover:bg-notebook-blue/90 transition-colors font-outfit"
                  >
                    Get 150 Free Credits
                    <ArrowRight className="ml-3 h-4 w-4" />
                  </Link>
                  <a
                    href="https://wordpress.org/plugins/alt-text-pro/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-14 items-center justify-center rounded-full border border-notebook-blue/10 bg-white px-8 text-sm font-bold uppercase tracking-widest text-notebook-slate hover:text-notebook-blue transition-colors font-outfit"
                  >
                    Install Plugin
                  </a>
                </div>

                <div className="grid sm:grid-cols-3 gap-3 max-w-2xl">
                  {["150 free signup credits", "No credit card", "WordPress plugin"].map((item) => (
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
                      <div className="h-11 w-11 rounded-2xl bg-white border border-notebook-blue/10 flex items-center justify-center">
                        <Upload className="h-5 w-5 text-notebook-blue" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 font-outfit">
                          WordPress Upload
                        </p>
                        <p className="text-sm font-semibold text-notebook-slate">
                          product-photo-042.jpg
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-notebook-blue/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-notebook-blue">
                      Ready
                    </span>
                  </div>

                  <div className="rounded-2xl bg-white border border-notebook-blue/5 p-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-notebook-blue mb-3 font-outfit">
                      Generated alt text
                    </p>
                    <p className="text-notebook-slate leading-relaxed">
                      Stainless steel water bottle with black cap on a white background, shown as a WooCommerce product image.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Media library", icon: Layers },
                    { label: "Posts + pages", icon: FileText },
                    { label: "WooCommerce", icon: Search },
                    { label: "Bulk batches", icon: Zap },
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
                Built for the WordPress workflow
              </h2>
              <p className="text-lg text-slate-500 leading-relaxed">
                Alt Text Pro is designed around how WordPress users actually manage images: uploads, media-library cleanup, product catalogs, and content images inside posts.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {useCases.map((item) => (
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
                  How to generate alt text in WordPress
                </h2>
                <p className="text-lg text-slate-500 leading-relaxed">
                  Start small. Generate one image first, confirm the output fits your page context, then use bulk processing for the larger cleanup.
                </p>
              </div>

              <div className="space-y-4">
                {setupSteps.map((step, index) => {
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
                  What good AI alt text should do
                </h2>
                <p className="text-lg text-slate-500 leading-relaxed mb-8">
                  A useful WordPress alt text generator should not only detect objects. It should create descriptions that make sense for visitors, screen readers, and search engines.
                </p>
                <Link href="/alt-text-simulator" className="inline-flex items-center text-sm font-bold uppercase tracking-widest text-notebook-blue font-outfit hover:opacity-80">
                  See the alt text simulator
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  "Describe the image accurately",
                  "Stay concise and readable",
                  "Avoid keyword stuffing",
                  "Match the page context",
                  "Support accessibility basics",
                  "Remain editable by humans",
                ].map((item) => (
                  <div key={item} className="rounded-3xl bg-notebook-paper border border-notebook-blue/5 p-6">
                    <Shield className="h-5 w-5 text-notebook-blue mb-4" />
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
                AI alt text generator FAQ
              </h2>
              <p className="text-lg text-slate-500">
                Practical answers for WordPress site owners before they start processing images.
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
                Generate your first WordPress alt text today.
              </h2>
              <p className="text-slate-500 mb-8">
                Start free, install the plugin, and test one image before running a larger cleanup.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link
                  href="/"
                  className="inline-flex h-14 items-center justify-center rounded-full bg-notebook-blue px-8 py-4 text-sm font-bold uppercase tracking-widest text-white shadow-notebook hover:bg-notebook-blue/90 transition-colors font-outfit"
                >
                  Get 150 Free Credits
                </Link>
                <Link
                  href="/docs#installation"
                  className="inline-flex h-14 items-center justify-center rounded-full border border-notebook-blue/10 bg-white px-8 py-4 text-sm font-bold uppercase tracking-widest text-notebook-slate hover:text-notebook-blue transition-colors font-outfit"
                >
                  Read Setup Guide
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
