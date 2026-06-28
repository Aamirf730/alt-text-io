import type { Metadata } from "next";
import Link from "next/link";
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

const pageUrl = "https://www.alt-text.pro/woocommerce-product-image-alt-text";

export const metadata: Metadata = {
  title: "WooCommerce Product Image Alt Text | Alt Text Pro",
  description:
    "Generate AI alt text for WooCommerce product images, improve product image accessibility, and clean up missing WordPress media-library alt text.",
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    title: "WooCommerce Product Image Alt Text",
    description:
      "Use Alt Text Pro to generate useful AI alt text for WooCommerce product galleries and WordPress media-library images.",
    url: pageUrl,
    siteName: "Alt Text Pro",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WooCommerce Product Image Alt Text",
    description:
      "Generate AI alt text for WooCommerce product images and product galleries.",
  },
};

const productUseCases = [
  "Product catalog images missing alt text",
  "Gallery images uploaded with camera filenames",
  "Variant photos that need clear product descriptions",
  "Store migrations where media metadata was lost",
  "Agency cleanup projects across client WooCommerce stores",
  "SEO and accessibility updates before a product launch",
];

const workflow = [
  {
    title: "Connect the store",
    copy: "Install Alt Text Pro, connect your account, and confirm your credits before processing product images.",
    icon: ShoppingCart,
  },
  {
    title: "Start with one product image",
    copy: "Generate alt text for a single image first so you can check tone, accuracy, and product-specific context.",
    icon: Upload,
  },
  {
    title: "Review product details",
    copy: "Edit generated text when a product name, material, color, or use case needs more precision.",
    icon: Tags,
  },
  {
    title: "Move to catalog cleanup",
    copy: "After the first result is correct, process missing alt text in smaller batches before larger store-wide runs.",
    icon: PackageCheck,
  },
];

const faqs = [
  {
    question: "Can AI generate alt text for WooCommerce product galleries?",
    answer:
      "Yes. Product galleries are a strong use case for Alt Text Pro, especially when product images were uploaded without useful alt text.",
  },
  {
    question: "Should product image alt text include keywords?",
    answer:
      "It can include natural product details when they are visible and useful, but it should not be keyword-stuffed. The main job is to describe the image accurately.",
  },
  {
    question: "Can I edit generated WooCommerce alt text?",
    answer:
      "Yes. Generated alt text is a starting point. You can review and edit it inside WordPress when the page context needs a more specific description.",
  },
  {
    question: "Does each WooCommerce image use a credit?",
    answer:
      "Each successful alt text generation uses 1 credit. Failed requests do not consume credits.",
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
      "AI alt text generator for WooCommerce product images and WordPress media-library cleanup.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free account includes 30 credits.",
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
          <div className="absolute inset-0 bg-gradient-to-b from-notebook-teal/10 via-transparent to-transparent pointer-events-none" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 relative z-10">
            <div className="grid lg:grid-cols-[1fr_0.9fr] gap-14 items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white border border-notebook-blue/10 px-4 py-2 mb-8 shadow-sm">
                  <ShoppingCart className="h-4 w-4 text-notebook-blue" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-notebook-blue font-outfit">
                    WooCommerce Image SEO
                  </span>
                </div>

                <h1 className="text-5xl lg:text-7xl font-bold font-outfit tracking-tight leading-[1.05] mb-8">
                  WooCommerce Product Image Alt Text
                </h1>

                <p className="text-xl text-slate-500 leading-relaxed max-w-2xl mb-10">
                  Generate useful AI alt text for WooCommerce product images, product galleries, and old catalog uploads that are missing clear image descriptions.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 mb-10">
                  <Link
                    href="/"
                    className="inline-flex h-14 items-center justify-center rounded-full bg-notebook-blue px-8 text-sm font-bold uppercase tracking-widest text-white shadow-notebook hover:bg-notebook-blue/90 transition-colors font-outfit"
                  >
                    Get 30 Free Credits
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
                  {["Product images", "Gallery images", "Bulk cleanup"].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                      <CheckCircle className="h-4 w-4 text-notebook-blue" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-notebook-blue/10 rounded-[2.5rem] p-6 lg:p-8 shadow-notebook-lg">
                <div className="rounded-[2rem] bg-notebook-paper border border-notebook-blue/5 p-6 mb-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-12 w-12 rounded-2xl bg-white border border-notebook-blue/10 flex items-center justify-center">
                      <PackageCheck className="h-6 w-6 text-notebook-blue" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 font-outfit">
                        Product gallery
                      </p>
                      <p className="text-sm font-semibold text-notebook-slate">
                        42 missing descriptions found
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white border border-notebook-blue/5 p-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-notebook-blue mb-3 font-outfit">
                      Example product alt text
                    </p>
                    <p className="text-notebook-slate leading-relaxed">
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
                Why WooCommerce stores need better product image alt text
              </h2>
              <p className="text-lg text-slate-500 leading-relaxed">
                Product images often carry important information: shape, material, color, packaging, and use case. Missing alt text makes that information harder for screen-reader users and search engines to understand.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {productUseCases.map((item) => (
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
                  A safer catalog cleanup workflow
                </h2>
                <p className="text-lg text-slate-500 leading-relaxed">
                  For product images, accuracy matters. Test one product image first, then expand into a small product batch before processing a full catalog.
                </p>
              </div>

              <div className="space-y-4">
                {workflow.map((step, index) => {
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
                  Product alt text should be descriptive, not stuffed
                </h2>
                <p className="text-lg text-slate-500 leading-relaxed">
                  The best WooCommerce image alt text describes what is visible and useful. Include product details naturally when they help the customer understand the image.
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
                WooCommerce alt text FAQ
              </h2>
              <p className="text-lg text-slate-500">
                Practical answers for store owners and agencies cleaning up product catalogs.
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
                Clean up your WooCommerce product images.
              </h2>
              <p className="text-slate-500 mb-8">
                Start free, connect your store, and generate one product image description before running a larger batch.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link
                  href="/"
                  className="inline-flex h-14 items-center justify-center rounded-full bg-notebook-blue px-8 py-4 text-sm font-bold uppercase tracking-widest text-white shadow-notebook hover:bg-notebook-blue/90 transition-colors font-outfit"
                >
                  Get 30 Free Credits
                </Link>
                <Link
                  href="/ai-alt-text-generator-for-wordpress"
                  className="inline-flex h-14 items-center justify-center rounded-full border border-notebook-blue/10 bg-white px-8 py-4 text-sm font-bold uppercase tracking-widest text-notebook-slate hover:text-notebook-blue transition-colors font-outfit"
                >
                  Read WordPress Guide
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
