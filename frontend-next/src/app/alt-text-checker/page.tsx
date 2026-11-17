import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle,
  CircleSlash,
  Copy,
  FileImage,
  Link2,
  ListChecks,
  ScanSearch,
  TextQuote,
  Type,
  XCircle,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import JsonLd from "@/components/JsonLd";
import AltTextChecker from "./AltTextChecker";

const pageUrl = "https://www.alt-text.pro/alt-text-checker";
const title = "Alt Text Checker: Find Images Missing Alt Text | Alt Text Pro";
const description =
  "Free alt text checker. Paste a page URL to find images with missing, empty or weak alt text, then fix them. No signup needed.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    title,
    description,
    url: pageUrl,
    siteName: "Alt Text Pro",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

const linkClass =
  "font-medium text-ink underline decoration-line-strong decoration-2 underline-offset-4 hover:decoration-ink";

const checks = [
  {
    title: "Missing alt",
    copy: "The image has no alt attribute at all. Screen readers may read out the file name, and search engines get no description.",
    icon: XCircle,
  },
  {
    title: "Links and buttons with no name",
    copy: "An image that is the only thing inside a link, or an image button, with empty or no alt. The link then has no name for screen reader users.",
    icon: Link2,
  },
  {
    title: "Empty alt",
    copy: 'alt="" tells screen readers to skip the image. Right for decoration, wrong for an image that carries meaning, so it is listed for a quick look.',
    icon: CircleSlash,
  },
  {
    title: "File names",
    copy: "Alt text like IMG_4021.jpg or red-fox-final-2, usually filled in automatically from the upload.",
    icon: FileImage,
  },
  {
    title: "Generic words",
    copy: "Alt text that is only “image”, “photo”, “logo” or “banner” and says nothing about this particular image.",
    icon: Type,
  },
  {
    title: "“Image of…”",
    copy: "Screen readers already announce that it is an image, so starting with “image of” or “photo of” repeats it.",
    icon: TextQuote,
  },
  {
    title: "Very long alt",
    copy: "Over 150 characters. Long alt text is tiring to listen to and cannot be skimmed, so it is worth a second look.",
    icon: AlertTriangle,
  },
  {
    title: "Repeated alt",
    copy: "The same alt text on three or more different images, which usually means a template default or copy and paste.",
    icon: Copy,
  },
];

const limits = [
  "Images added by JavaScript after the page loads. The checker reads the HTML the server sends. Common lazy-loading setups are handled.",
  "CSS background images. They have no alt attribute; if one carries meaning, the page needs text that says the same thing.",
  "Whether the alt text is accurate. A tool can tell that alt text exists, not that it describes the image well. That still needs a person.",
  "Pages behind a login, and sites that block automated requests.",
  "More than one page at a time, and more than 300 images per page in the list (the counts include all of them).",
];

const fixSteps = [
  {
    title: "Decide if the image is decorative",
    copy: 'If it adds nothing a reader would miss, such as a divider or a background flourish, use alt="" so screen readers skip it.',
  },
  {
    title: "Describe what matters on this page",
    copy: "Say what the image shows and why it is there, in a short sentence. The same photo can need different alt text on different pages.",
  },
  {
    title: "Fix links and buttons first",
    copy: "When an image is a link or a button, its alt text is the link's name. Describe where it goes or what it does: “Shopping cart”, not “cart icon”.",
  },
  {
    title: "Update it where the image lives",
    copy: "In WordPress, edit the Alternative Text field in the Media Library or the Image block. Other site builders have a similar field in their image settings.",
  },
];

const faqs = [
  {
    question: "What is an alt text checker?",
    answer:
      "An alt text checker, sometimes called an alt tag checker, reads a web page and lists its images with their alt text. It shows which images have none and which have alt text that does not describe anything, such as a file name. This one checks the HTML of one page at a time.",
  },
  {
    question: "How do I check if an image has alt text?",
    answer:
      'Paste the page address into the checker above. To check a single image by hand, right-click it in Chrome, Edge or Firefox, choose Inspect, and look for alt="…" inside the highlighted img tag. No alt attribute means it is missing; alt="" means the image is marked as decorative.',
  },
  {
    question: "Is empty alt text an error?",
    answer:
      'Not always. alt="" tells screen readers to skip an image, which is right for purely decorative images. It is a problem when the image carries information, or when the image is the only thing inside a link or button, because then the link has no name.',
  },
  {
    question: "How long should alt text be?",
    answer:
      "Usually a short sentence. There is no fixed limit, but long alt text is tiring to listen to and cannot be skimmed. This checker flags alt text over 150 characters for a second look. Detail that everyone needs, such as the numbers in a chart, belongs in the page text.",
  },
  {
    question: "Can I check my whole website?",
    answer:
      "This tool checks one page at a time. If your site runs on WordPress, the Alt Text Pro plugin can find every image in your media library that has no alt text and draft descriptions for them in one bulk run, which you can review before saving.",
  },
  {
    question: "Does a clean result mean my site meets WCAG or the ADA?",
    answer:
      "No. The checker finds common alt text problems on one page. Accessibility covers much more than images, and only a person can judge whether alt text is accurate and useful.",
  },
];

export default function AltTextCheckerPage() {
  const appStructuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Alt Text Checker",
    url: pageUrl,
    description,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any",
    isAccessibleForFree: true,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    publisher: {
      "@type": "Organization",
      name: "Alt Text Pro",
      url: "https://www.alt-text.pro",
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
      <JsonLd data={appStructuredData} />
      <JsonLd data={faqStructuredData} />

      <main>
        <section className="relative border-b border-line">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-yellow-tint via-transparent to-transparent" />
          <div className="relative z-10 mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div className="mb-8 inline-flex h-8 items-center gap-2 rounded-full bg-yellow-soft px-3">
              <ScanSearch className="h-4 w-4 text-ink" aria-hidden="true" />
              <span className="label-caps">Free tool · No signup</span>
            </div>

            <h1 className="mb-6 font-outfit text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-7xl">
              Free Alt Text Checker
            </h1>

            <p className="mb-10 max-w-3xl text-lg leading-relaxed text-ink-muted sm:text-xl">
              Paste the address of any page to see which images are missing alt text, which have empty alt, and which have alt text that needs another look, like file names or generic words.
            </p>

            <AltTextChecker />
          </div>
        </section>

        <section className="border-b border-line bg-white py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-12 max-w-3xl">
              <h2 className="mb-5 font-outfit text-3xl font-bold tracking-tight lg:text-5xl">
                What this checker looks for
              </h2>
              <p className="text-lg leading-relaxed text-ink-muted">
                It works as an image alt text checker and a missing alt tag finder in one pass. Every image on the page gets one of these results, or “Looks fine”.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {checks.map((check) => {
                const Icon = check.icon;
                return (
                  <div key={check.title} className="rounded-2xl border border-line bg-white p-6">
                    <Icon className="mb-5 h-5 w-5 text-ink" aria-hidden="true" />
                    <h3 className="mb-2 font-outfit text-lg font-bold">{check.title}</h3>
                    <p className="leading-relaxed text-ink-muted">{check.copy}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-b border-line bg-white py-20">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
            <div>
              <h2 className="mb-5 font-outfit text-3xl font-bold tracking-tight lg:text-5xl">
                What it can&apos;t check
              </h2>
              <p className="text-lg leading-relaxed text-ink-muted">
                An automated website alt text checker is a quick first pass, not a full accessibility review. These are the limits worth knowing.
              </p>
            </div>
            <ul className="space-y-4">
              {limits.map((item) => (
                <li key={item} className="flex gap-4 rounded-2xl border border-line bg-white p-5">
                  <ListChecks className="mt-0.5 h-5 w-5 shrink-0 text-ink" aria-hidden="true" />
                  <span className="leading-relaxed text-ink">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-b border-line bg-white py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-12 max-w-3xl">
              <h2 className="mb-5 font-outfit text-3xl font-bold tracking-tight lg:text-5xl">
                How to fix missing alt text
              </h2>
              <p className="text-lg leading-relaxed text-ink-muted">
                Once you have checked for missing alt tags, work through the list in this order. For examples by image type, read{" "}
                <Link href="/how-to-write-alt-text" className={linkClass}>how to write alt text</Link>.
              </p>
            </div>

            <ol className="grid gap-5 md:grid-cols-2">
              {fixSteps.map((step, index) => (
                <li key={step.title} className="flex gap-5 rounded-2xl border border-line bg-white p-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yellow-soft font-outfit text-lg font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="mb-2 font-outfit text-xl font-bold">{step.title}</h3>
                    <p className="leading-relaxed text-ink-muted">{step.copy}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-8 flex gap-4 rounded-2xl border border-line bg-yellow-tint p-6">
              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-ink" aria-hidden="true" />
              <p className="leading-relaxed text-ink">
                On WordPress, Alt Text Pro can draft the descriptions for you, one image at a time in the{" "}
                <Link href="/ai-alt-text-generator-for-wordpress" className={linkClass}>media editor</Link>, or for a whole library with a{" "}
                <Link href="/bulk-generate-alt-text-wordpress" className={linkClass}>bulk run</Link>. You review each one before it is saved.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="mb-12 text-center">
              <h2 className="mb-5 font-outfit text-3xl font-bold tracking-tight lg:text-5xl">
                Questions about checking alt text
              </h2>
            </div>

            <div className="space-y-4">
              {faqs.map((faq) => (
                <div key={faq.question} className="rounded-2xl border border-line bg-white p-6">
                  <h3 className="mb-3 font-outfit text-xl font-bold">{faq.question}</h3>
                  <p className="leading-relaxed text-ink-muted">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
