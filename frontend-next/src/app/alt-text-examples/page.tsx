import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import JsonLd from "@/components/JsonLd";
import Navbar from "@/components/Navbar";
import guide from "../how-to-write-alt-text/guide.module.css";
import ArticleTable from "./ArticleTable";
import { introduction, sections, reference, faqs, faqTitle, callToAction, sources } from "./article-content";
import styles from "./examples.module.css";

const title = "Alt Text Examples";
const headline = "Alt Text Examples: Good and Bad Alt Text";
const description = "Compare weak and better alt text for logos, icons, buttons, charts and product photos. See each image in context and copy the HTML for your own page.";
const pageUrl = "https://www.alt-text.pro/alt-text-examples";
const shareImage = `${pageUrl}/opengraph-image`;
const shareImageAlt = "Alt Text Examples compares “Mountain landscape” with “Snowy peaks reflected in a lake.”";
const authorUrl = "https://www.alt-text.pro/about";
// Keep the date aligned with the first production publication when releasing this page.
const published = "2026-11-18";

export const metadata: Metadata = {
  title: `${headline} | Alt Text Pro`,
  description,
  alternates: { canonical: pageUrl },
  authors: [{ name: "Alt Text Pro", url: authorUrl }],
  openGraph: {
    type: "article",
    title: headline,
    description,
    url: pageUrl,
    siteName: "Alt Text Pro",
    publishedTime: published,
    images: [{ url: shareImage, alt: shareImageAlt, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: headline,
    description,
    images: [{ url: shareImage, alt: shareImageAlt }],
  },
};

export default function AltTextExamplesPage() {
  return (
    <div className="min-h-screen bg-white text-ink">
      <a href="#examples" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:p-4">Skip to article</a>
      <Navbar />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Article",
        "@id": `${pageUrl}#article`,
        headline: title,
        description,
        mainEntityOfPage: pageUrl,
        url: pageUrl,
        datePublished: published,
        inLanguage: "en",
        image: [shareImage],
        author: { "@type": "Organization", name: "Alt Text Pro", url: authorUrl },
        publisher: { "@type": "Organization", name: "Alt Text Pro", url: "https://www.alt-text.pro" },
      }} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "@id": `${pageUrl}#faq`,
        mainEntity: faqs.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      }} />
      <main id="examples" className={guide.guide}>
        <header className={guide.header}>
          <h1>{title}</h1>
          <p className={`${guide.dek} ${styles.intro}`}>{introduction}</p>
          <p className={guide.byline}>By <Link href="/about">Alt Text Pro</Link></p>
        </header>
        <div className={guide.layout}>
          <aside className={guide.sidebar}>
            <nav aria-label="Article contents">
              <p className="label-caps mb-4">On this page</p>
              <ol>{sections.map(({ id, title }) => <li key={id}><a href={`#${id}`}>{title}</a></li>)}</ol>
            </nav>
          </aside>
          <article aria-label={title} className={`${guide.article} ${styles.library}`}>
            {sections.map(({ id, title, content }) => (
              <section id={id} key={id}>
                <h2>{title}</h2>
                {content}
              </section>
            ))}
            <section id="quick-reference">
              <h2>{reference.title}</h2>
              <ArticleTable caption={reference.caption} headings={reference.headings} rows={reference.rows} />
            </section>
            <section id="faq">
              <h2>{faqTitle}</h2>
              {faqs.map(({ question, answer }) => (
                <div key={question}>
                  <h3>{question}</h3>
                  <p>{answer}</p>
                </div>
              ))}
            </section>
            <aside className={guide.cta} aria-labelledby="try-tools">
              <h2 id="try-tools">{callToAction.title}</h2>
              {callToAction.content}
            </aside>
            <section aria-labelledby="sources">
              <h2 id="sources">Sources</h2>
              <ul>{sources.map(({ href, label }) => <li key={href}><a href={href}>{label}</a></li>)}</ul>
            </section>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
}
