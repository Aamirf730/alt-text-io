import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
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
import JsonLd from "@/components/JsonLd";
import { PLUGIN_VERSION } from "@/lib/utils";

const pageUrl = "https://www.alt-text.pro/ai-alt-text-generator-for-wordpress";

export const metadata: Metadata = {
  title: "AI Alt Text Generator for WordPress | Alt Text Pro",
  description:
    "Generate alt text for WordPress images with AI. Review each draft in the media editor before you save it. Free plugin and 150 free credits to start.",
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    title: "AI Alt Text Generator for WordPress | Alt Text Pro",
    description:
      "Generate alt text for WordPress images with AI. Review each draft in the media editor before you save it. Free plugin and 150 free credits to start.",
    url: pageUrl,
    siteName: "Alt Text Pro",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Alt Text Generator for WordPress | Alt Text Pro",
    description:
      "Generate alt text for WordPress images with AI. Review each draft in the media editor before you save it. Free plugin and 150 free credits to start.",
  },
};

const setupSteps = [
  {
    title: "Create your free account",
    copy: "You get 150 credits when you sign up and 15 more each month. No credit card needed.",
    icon: Sparkles,
  },
  {
    title: "Install the WordPress plugin",
    copy: `Install Alt Text Pro from WordPress.org, or download version ${PLUGIN_VERSION} from your dashboard.`,
    icon: Chrome,
  },
  {
    title: "Connect your site",
    copy: "Open Alt Text Pro in wp-admin and click Connect. The plugin saves your API key for you and stores it encrypted.",
    icon: Zap,
  },
  {
    title: "Generate one image first",
    copy: "Open an image in the media library and click Generate Alt-Text. Read the draft and apply it if it is right. Then try a post, a product photo, or a bulk run.",
    icon: ImageIcon,
  },
];

const useCases = [
  "Generate alt text for one image in the media editor, then apply it",
  "Draft alt text automatically when you upload new images (optional)",
  "Click Add Alt Text in the Posts or Pages list to cover every image in a post",
  "Fill missing alt text across older uploads with bulk processing",
  "Describe WooCommerce product photos, which live in the same media library",
  "Export a log of every generated description as a CSV file",
];

const faqs = [
  {
    question: "Does AI alt text replace manual review?",
    answer:
      "No. The AI writes a draft from what it sees. It can misread an image, and it cannot always know why the image is on your page. Review important images and edit where needed.",
  },
  {
    question: "Which AI model writes the descriptions?",
    answer:
      "Google Gemini, through the Alt Text Pro service. You do not need your own AI account or API key from Google.",
  },
  {
    question: "Can it add alt text to many images at once?",
    answer:
      "Yes. Bulk processing fills in missing alt text across your media library, up to your newest 20,000 images per run. Try it on a few images first.",
  },
  {
    question: "Does it work with WooCommerce product images?",
    answer:
      "Yes. Product and gallery images are stored in the WordPress media library, so they work like any other image.",
  },
  {
    question: "How do credits work?",
    answer:
      "Each image that gets alt text uses 1 credit. Failed requests do not use credits. The free plan includes 150 signup credits that never expire, plus 15 credits each month.",
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
      "WordPress plugin that drafts alt text with AI for images in the media library, posts, pages, and WooCommerce products.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free account includes 150 signup credits plus 15 every month.",
    },
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
            <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
              <div>
                <div className="inline-flex h-8 items-center gap-2 rounded-full bg-yellow-soft px-3 mb-8">
                  <Sparkles className="h-4 w-4 text-ink" />
                  <span className="label-caps">
                    WordPress plugin
                  </span>
                </div>

                <h1 className="text-5xl lg:text-7xl font-bold font-outfit tracking-tight leading-[1.05] mb-8">
                  AI Alt Text Generator for WordPress
                </h1>

                <p className="text-xl text-ink-muted leading-relaxed max-w-2xl mb-10">
                  Alt Text Pro adds a Generate button to the WordPress media editor. The AI writes a short description of the image, you check it, and it goes into the alt text field.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 mb-10">
                  <Link
                    href="/?auth=signup"
                    className={buttonVariants()}
                  >
                    Get 150 Free Credits
                    <ArrowRight aria-hidden="true" />
                  </Link>
                  <a
                    href="https://wordpress.org/plugins/alt-text-pro/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "secondary" })}
                  >
                    Install Plugin
                  </a>
                </div>

                <div className="grid sm:grid-cols-3 gap-3 max-w-2xl">
                  {["150 free credits", "No credit card", "Free on WordPress.org"].map((item) => (
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
                        <Upload className="h-5 w-5 text-ink" />
                      </div>
                      <div>
                        <p className="label-caps">
                          WordPress Upload
                        </p>
                        <p className="text-sm font-semibold text-ink">
                          product-photo-042.jpg
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex h-7 items-center rounded-full bg-yellow-soft px-3 text-xs font-semibold text-ink">
                      Ready
                    </span>
                  </div>

                  <div className="rounded-2xl bg-white border border-line p-5">
                    <p className="label-caps mb-3">
                      Generated alt text
                    </p>
                    <p className="text-ink leading-relaxed">
                      Stainless steel water bottle with a black screw cap, photographed on a white background.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Media library", icon: Layers },
                    { label: "Posts + pages", icon: FileText },
                    { label: "WooCommerce", icon: Search },
                    { label: "Bulk runs", icon: Zap },
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
                Where it fits in WordPress
              </h2>
              <p className="text-lg text-ink-muted leading-relaxed">
                Alt Text Pro works where you already manage images: the media library, the upload screen, and the Posts and Pages lists. Fixing a large library? Read the{" "}
                <Link href="/bulk-generate-alt-text-wordpress" className="font-medium text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink">bulk guide</Link>. Running a store? See{" "}
                <Link href="/woocommerce-product-image-alt-text" className="font-medium text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink">WooCommerce product images</Link>.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {useCases.map((item) => (
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
                  How to generate alt text in WordPress
                </h2>
                <p className="text-lg text-ink-muted leading-relaxed">
                  Start small. Generate alt text for one image, check that it fits the page, then move on to the rest of your library.
                </p>
              </div>

              <div className="space-y-4">
                {setupSteps.map((step, index) => {
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
                  What good alt text looks like
                </h2>
                <p className="text-lg text-ink-muted leading-relaxed mb-8">
                  Good alt text says what the image shows and why it is on the page. Screen-reader users hear it in place of the image, and search engines read it as text about the image.
                </p>
                <Link href="/alt-text-simulator" className="inline-flex items-center gap-2 text-[15px] font-semibold text-ink underline-offset-4 hover:underline">
                  See the alt text simulator
                  <ArrowRight aria-hidden="true" />
                </Link>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  "Describe the image accurately",
                  "Stay concise and readable",
                  "Avoid keyword stuffing",
                  "Match the page context",
                  "Help screen-reader users",
                  "Stay easy to edit",
                ].map((item) => (
                  <div key={item} className="rounded-2xl bg-white border border-line p-6">
                    <Shield className="h-5 w-5 text-ink mb-4" />
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
                Questions about AI alt text
              </h2>
              <p className="text-lg text-ink-muted">
                Short answers before you try it on your own images.
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
                Try it on one image.
              </h2>
              <p className="text-ink-muted mb-8">
                Create a free account, connect the plugin, and see your first draft. Need more later? Compare{" "}
                <Link href="/#pricing" className="font-medium text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink">plans and credit packs</Link>.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link
                  href="/?auth=signup"
                  className={buttonVariants()}
                >
                  Get 150 Free Credits
                </Link>
                <Link
                  href="/docs#installation"
                  className={buttonVariants({ variant: "secondary" })}
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
