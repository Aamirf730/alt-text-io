import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  ArrowRight,
  CheckCircle,
  PackageCheck,
  Search,
  Shield,
  ShoppingCart,
  Sparkles,
  Tags,
  Upload,
  Zap,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import JsonLd from "@/components/JsonLd";

const pageUrl = "https://www.alt-text.pro/woocommerce-product-image-alt-text";

export const metadata: Metadata = {
  title: "WooCommerce Product Image Alt Text | Alt Text Pro",
  description:
    "Add alt text to WooCommerce product photos and gallery images with AI, then check product details before you save. Start with 150 free credits.",
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    title: "WooCommerce Product Image Alt Text | Alt Text Pro",
    description:
      "Add alt text to WooCommerce product photos and gallery images with AI, then check product details before you save. Start with 150 free credits.",
    url: pageUrl,
    siteName: "Alt Text Pro",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WooCommerce Product Image Alt Text | Alt Text Pro",
    description:
      "Add alt text to WooCommerce product photos and gallery images with AI, then check product details before you save. Start with 150 free credits.",
  },
};

const productUseCases = [
  "Product catalog images missing alt text",
  "Gallery images uploaded with camera filenames",
  "Variant photos that need clear product descriptions",
  "Store migrations where media metadata was lost",
  "Agency cleanup projects across client WooCommerce stores",
  "Accessibility and search updates before a product launch",
];

const workflow = [
  {
    title: "Connect the store",
    copy: "Install the Alt Text Pro plugin, click Connect, and check how many credits you have before you start.",
    icon: ShoppingCart,
  },
  {
    title: "Start with one product image",
    copy: "Open a product photo in the media library and generate a draft. Check that the wording is accurate and fits your store.",
    icon: Upload,
  },
  {
    title: "Add what the AI cannot know",
    copy: "The AI sees the photo, not your catalog. Add the product name, exact material, or model where it helps the shopper.",
    icon: Tags,
  },
  {
    title: "Fill the rest of the catalog",
    copy: "Use bulk processing for product images still missing alt text. Try a few selected images first, then run the rest.",
    icon: PackageCheck,
  },
];

const faqs = [
  {
    question: "Does it work with product gallery images?",
    answer:
      "Yes. Main product images and gallery images are both stored in the WordPress media library, so Alt Text Pro treats them like any other image.",
  },
  {
    question: "Should product image alt text include keywords?",
    answer:
      "Only where they describe what is in the photo. Name the product type, color, or material if they are visible and useful. A list of search terms makes the image harder to understand.",
  },
  {
    question: "Will the AI know my product names?",
    answer:
      "Not from the photo alone. It describes what it sees. You can add context for an image before generating, or edit the draft to include the exact product name.",
  },
  {
    question: "Does each product image use a credit?",
    answer:
      "Each image that gets alt text uses 1 credit, including gallery images. Failed requests do not use credits.",
  },
];

export default function WooCommerceProductImageAltTextPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Alt Text Pro",
    applicationCategory: "WordPressPlugin",
    operatingSystem: "WordPress",
    url: pageUrl,
    description:
      "WordPress plugin that drafts alt text with AI for WooCommerce product and gallery images.",
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
          <div className="absolute inset-0 bg-gradient-to-b from-notebook-teal/10 via-transparent to-transparent pointer-events-none" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 relative z-10">
            <div className="grid lg:grid-cols-[1fr_0.9fr] gap-14 items-center">
              <div>
                <div className="inline-flex h-8 items-center gap-2 rounded-full bg-yellow-soft px-3 mb-8">
                  <ShoppingCart className="h-4 w-4 text-ink" />
                  <span className="label-caps">
                    WooCommerce stores
                  </span>
                </div>

                <h1 className="text-5xl lg:text-7xl font-bold font-outfit tracking-tight leading-[1.05] mb-8">
                  Alt Text for WooCommerce Product Images
                </h1>

                <p className="text-xl text-ink-muted leading-relaxed max-w-2xl mb-10">
                  Product photos and gallery images live in your media library, so Alt Text Pro can describe them one at a time or across the whole catalog. You add the product details the AI cannot see.
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
                  {["Product images", "Gallery images", "Bulk cleanup"].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm font-semibold text-ink-muted">
                      <CheckCircle className="h-4 w-4 text-ink" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-line rounded-2xl p-6 lg:p-8 shadow-notebook-lg">
                <div className="rounded-2xl bg-white border border-line p-6 mb-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-12 w-12 rounded-xl bg-yellow-soft flex items-center justify-center shrink-0">
                      <PackageCheck className="h-6 w-6 text-ink" />
                    </div>
                    <div>
                      <p className="label-caps">
                        Product gallery
                      </p>
                      <p className="text-sm font-semibold text-ink">
                        42 missing descriptions found
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white border border-line p-5">
                    <p className="label-caps mb-3">
                      Example product alt text
                    </p>
                    <p className="text-ink leading-relaxed">
                      Black leather ankle boot with side zipper and stacked heel, photographed on a light studio background.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Product photo", icon: Search },
                    { label: "Gallery item", icon: Tags },
                    { label: "Catalog batch", icon: Zap },
                    { label: "Accessibility", icon: Shield },
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
                Why product images need alt text
              </h2>
              <p className="text-lg text-ink-muted leading-relaxed">
                A product photo shows shape, color, material, and packaging. Without alt text, shoppers who use screen readers miss that, and search engines have less text to understand the image.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {productUseCases.map((item) => (
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
                  How to add alt text to a product catalog
                </h2>
                <p className="text-lg text-ink-muted leading-relaxed">
                  Accuracy matters more for products than for blog photos. Test one product image, then a few, then the full catalog. The{" "}
                  <Link href="/bulk-generate-alt-text-wordpress" className="font-medium text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink">bulk guide</Link> explains how a run works.
                </p>
              </div>

              <div className="space-y-4">
                {workflow.map((step, index) => {
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
                  Describe the product, don&apos;t stuff it
                </h2>
                <p className="text-lg text-ink-muted leading-relaxed">
                  Good product alt text describes the photo the way a shopper would. Mention details that are visible and useful, and leave out lists of keywords.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  "Visible product type",
                  "Color and material",
                  "Angle or image purpose",
                  "Key product feature",
                  "Concise wording",
                  "Human review for context",
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
                Questions from store owners
              </h2>
              <p className="text-lg text-ink-muted">
                For store owners and agencies working through a product catalog.
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
                Start with one product photo.
              </h2>
              <p className="text-ink-muted mb-8">
                Create a free account, connect your store, and see the draft before you run the whole catalog. Need more credits later? Compare{" "}
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
                  href="/ai-alt-text-generator-for-wordpress"
                  className={buttonVariants({ variant: "secondary" })}
                >
                  How It Works in WordPress
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
