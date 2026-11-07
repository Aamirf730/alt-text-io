import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import JsonLd from "@/components/JsonLd";
import { buttonVariants } from "@/components/ui/button";
import styles from "./guide.module.css";

const title = "How to Write Alt Text for Accessibility and SEO";
const description = "Learn how to write useful alt text with examples for photos, products, charts and buttons. Covers screen readers, captions, SEO and WordPress tools.";
const pageUrl = "https://www.alt-text.pro/how-to-write-alt-text";
const published = "2026-11-07";
const exampleAlt = "Café tables beside a Paris street, with the Eiffel Tower in the background.";
const contents = [
  ["why-alt-text-matters", "Why alt text matters for accessibility"],
  ["best-practices", "Best practices for writing alt text"],
  ["alt-text-vs-captions", "Alt text vs image captions"],
  ["alt-text-for-seo", "How to write alt text for SEO"],
  ["alt-text-tools", "Tools for generating and checking alt text"],
  ["screen-readers", "What screen readers need"],
  ["image-description-examples", "Image description examples"],
  ["website-usability", "How alt text improves usability"],
  ["wordpress", "How to add alt text in WordPress"],
  ["checklist", "A quick check before publishing"],
] as const;

export const metadata: Metadata = {
  title: `${title} | Alt Text Pro`,
  description,
  alternates: { canonical: pageUrl },
  authors: [{ name: "Alt Text Pro", url: "https://www.alt-text.pro/about" }],
  openGraph: {
    title, description, url: pageUrl, siteName: "Alt Text Pro",
    type: "article", publishedTime: published, modifiedTime: published,
    images: [{ url: "/paris-cafe-eiffel-tower.jpg", width: 1536, height: 1024, alt: exampleAlt }],
  },
  twitter: {
    card: "summary_large_image", title, description,
    images: ["/paris-cafe-eiffel-tower.jpg"],
  },
};

export default function AltTextGuidePage() {
  return (
    <div className="min-h-screen bg-white text-ink">
      <a href="#guide" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:p-4">Skip to article</a>
      <Navbar />
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "Article",
        "@id": `${pageUrl}#article`, headline: title, description,
        mainEntityOfPage: pageUrl, url: pageUrl,
        datePublished: published, dateModified: published, inLanguage: "en",
        image: ["https://www.alt-text.pro/paris-cafe-eiffel-tower.jpg"],
        author: { "@type": "Organization", name: "Alt Text Pro", url: "https://www.alt-text.pro/about" },
        publisher: { "@type": "Organization", name: "Alt Text Pro", url: "https://www.alt-text.pro" },
      }} />
      <main id="guide" className={styles.guide}>
        <header className={styles.header}>
          <p className="label-caps mb-5">The Alt Text Pro guide</p>
          <h1>{title}</h1>
          <p className={styles.dek}>Describe what matters. Give readers the information they would miss without the image.</p>
          <p className={styles.byline}>By <Link href="/about">Alt Text Pro</Link> · Published <time dateTime="2026-11-07">November 7, 2026</time></p>
        </header>

        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <nav aria-label="Article contents">
              <p className="label-caps mb-4">In this guide</p>
              <ol>{contents.map(([id, label]) => <li key={id}><a href={`#${id}`}>{label}</a></li>)}</ol>
            </nav>
          </aside>

          <article className={styles.article} aria-label={title}>
            <p>You upload a photo, give it a filename and move on. The alt text field is still empty. It is easy to miss, especially when a post has twenty images and a deadline.</p>
            <p>Alt text is a text alternative for an image. On a web page, it usually lives in the image element&apos;s <code>alt</code> attribute. It helps someone understand the image when they cannot see it. It also gives search engines more context.</p>
            <p>The useful question is simple: what does this image add to this page? Your answer is usually a better starting point than a list of everything in the picture.</p>

            <figure className={styles.figure}>
              <Image src="/paris-cafe-eiffel-tower.jpg" alt={exampleAlt} width={1536} height={1024} sizes="(max-width: 1023px) 100vw, 740px" preload className={styles.exampleImage} />
              <figcaption>One scene, several possible descriptions. A travel guide might focus on the landmark. A café design article might focus on the tables and chairs.</figcaption>
            </figure>
            <div className={styles.example}>
              <p><strong>Too vague:</strong> Paris photo</p>
              <p><strong>Useful for a travel article:</strong> {exampleAlt}</p>
              <p><strong>Useful for a design article:</strong> Round café tables and woven bistro chairs under a dark awning.</p>
            </div>

            <section id="why-alt-text-matters">
              <h2>Why alt text matters for web accessibility</h2>
              <p>A reader should not have to see a photograph or diagram to get the information your page depends on. Text alternatives let assistive technology present that information as speech or braille.</p>
              <p>Imagine a recipe that shows a dough test only in a photo. A description such as “Dough stretched into a thin sheet with light showing through the center” gives the reader something they can use. “Baking image” does not.</p>
              <p><a href="https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html">WCAG 2.2 Success Criterion 1.1.1</a> calls for text alternatives that serve an equivalent purpose, with exceptions for content such as decoration. Adding words to every image is not the goal. Preserving the information or function is.</p>
              <p>Alt text is one part of an accessible page. It does not fix an unlabeled form, a keyboard trap or unreadable text contrast.</p>
            </section>

            <section id="best-practices">
              <h2>Best practices for writing alt text</h2>
              <p>Start with the subject and the detail that matters in context. Then cut anything that does not help the reader understand the page.</p>
              <ul>
                <li><strong>Be specific.</strong> “Red backpack with two side pockets” gives a shopper more information than “bag.”</li>
                <li><strong>Keep it concise.</strong> A short phrase or sentence often works. Put the main information first.</li>
                <li><strong>Skip routine introductions.</strong> You usually do not need “image of” or “picture of.” Mention the medium when it matters, such as a watercolor or an X-ray.</li>
                <li><strong>Use ordinary language.</strong> Write something you could say aloud without sounding like a search query.</li>
                <li><strong>Check the facts.</strong> Do not guess a person&apos;s name, a location, a material or a product feature from appearance alone.</li>
                <li><strong>Read it beside the surrounding text.</strong> Remove needless repetition, but keep visual details that the text does not explain.</li>
              </ul>
              <p>The <a href="https://www.w3.org/WAI/tutorials/images/tips/">W3C&apos;s alt text writing tips</a> recommend a concise description of the image&apos;s purpose. There is no universal WCAG rule that alt text must stop at 125 characters. If a diagram needs several paragraphs, give it a short introduction in the alt text and explain the detail on the page.</p>
              <h3>When an empty alt attribute is the right choice</h3>
              <p>A decorative flourish between sections adds no information. Give it an empty attribute, <code>alt=&quot;&quot;</code>, so assistive technology can skip it. Keep the attribute present and leave nothing between the quotes.</p>
              <p>Leaving out the attribute is different. Some screen readers may announce a filename or URL instead. A stock photo is not automatically decorative either. Its purpose on the page decides. The <a href="https://www.w3.org/WAI/tutorials/images/decorative/">W3C&apos;s decorative image examples</a> explain this distinction, and its <a href="https://www.w3.org/WAI/tutorials/images/decision-tree/">alt decision tree</a> helps with uncertain cases.</p>
            </section>

            <section id="alt-text-vs-captions">
              <h2>Alt text vs image captions</h2>
              <p>A caption is visible text alongside an image. It might explain the story, name the photographer or give a date. Alt text supplies the image information someone needs when they cannot see it.</p>
              <div className={styles.tableWrap} role="region" aria-label="Alt text and captions comparison" tabIndex={0}>
                <table>
                  <caption>Two fields with different jobs</caption>
                  <thead><tr><th scope="col">Field</th><th scope="col">Main job</th><th scope="col">Example for a café photo</th></tr></thead>
                  <tbody>
                    <tr><th scope="row">Alt text</th><td>Convey relevant visual information</td><td>Outdoor café tables facing the Eiffel Tower across a cobbled street.</td></tr>
                    <tr><th scope="row">Caption</th><td>Add visible context</td><td>A café stop on our walking route through Paris.</td></tr>
                    <tr><th scope="row">Image title</th><td>Provide an optional title or label, depending on the system</td><td>Paris café stop</td></tr>
                  </tbody>
                </table>
              </div>
              <p>You can use both alt text and a caption. Avoid copying the same sentence into both fields, which can make someone hear it twice. If the nearby text already conveys everything the image contributes, an empty alt attribute may be appropriate. Do not assume a caption containing only a photo credit replaces a description.</p>
              <p>The <a href="https://www.w3.org/WAI/tutorials/images/informative/">W3C&apos;s informative image guidance</a> shows how surrounding text affects the alternative you need. An image title or hover tooltip is not a reliable substitute for alt text.</p>
            </section>

            <section id="alt-text-for-seo">
              <h2>How to write alt text for SEO</h2>
              <p>Google uses alt text alongside the page content and image analysis to understand an image. Its <a href="https://developers.google.com/search/docs/appearance/google-images">image SEO guidance</a> recommends useful descriptions in context and warns against keyword stuffing.</p>
              <p>Use a relevant term when it honestly describes the subject. If your page reviews a specific backpack and the photo shows it, the verified model name can belong in the description. Unrelated search phrases do not.</p>
              <div className={styles.example}>
                <p><strong>Stuffed:</strong> best hiking backpack cheap hiking bag buy backpack outdoor backpack sale</p>
                <p><strong>Descriptive:</strong> Green hiking backpack with a padded hip belt and two mesh bottle pockets.</p>
              </div>
              <p>Keep photos near the text they support, use descriptive filenames and make sure images load properly. Alt text helps explain the content. It cannot guarantee a ranking or make an irrelevant page useful.</p>
            </section>

            <section id="alt-text-tools">
              <h2>Tools for generating and checking alt text</h2>
              <p>The right workflow depends on how many images you have and how much context each one needs. A product catalog and a personal essay do not need the same process.</p>
              <h3>The WordPress editor</h3>
              <p>For a handful of images, writing descriptions directly in WordPress is often quickest. The Image block has an alternative text field, and you can edit image details in the Media Library. Keep the post open so you can write for its context.</p>
              <h3>Alt Text Pro</h3>
              <p><Link href="/ai-alt-text-generator-for-wordpress">Alt Text Pro</Link> drafts descriptions inside WordPress. You can generate one in the media editor, review it and apply it. For an older library, <Link href="/bulk-generate-alt-text-wordpress">bulk generation</Link> can help fill missing descriptions. It also works with <Link href="/woocommerce-product-image-alt-text">WooCommerce product images</Link>.</p>
              <p>Try a small set first. Check product names, text inside screenshots and details the image cannot establish. Keep intentionally decorative images out of the batch. An empty field may be a deliberate accessibility choice.</p>
              <h3>A general image description tool</h3>
              <p>If you use an AI tool that accepts images, give it the page context as well. A useful prompt is: “Write a short alt description for this photo in a guide to small balcony gardens. Focus on the planter arrangement. Do not guess plant species.” Verify the result before copying it into your site.</p>
              <h3>An accessibility checker</h3>
              <p><a href="https://wave.webaim.org/">WAVE</a> can help flag accessibility issues and support a manual review. A checker can identify a missing attribute. It cannot reliably decide whether your description tells the right story. Use it to find work, then inspect the page yourself.</p>
            </section>

            <section id="screen-readers">
              <h2>What screen readers need from alt text</h2>
              <p>For a normal HTML image, the description belongs in the <code>alt</code> attribute. This example would describe a product photo:</p>
              <pre><code>{'<img src="blue-mug.jpg" alt="Blue ceramic mug with a wide handle" />'}</code></pre>
              <p>A purely decorative image can use:</p>
              <pre><code>{'<img src="section-flourish.svg" alt="" />'}</code></pre>
              <p>If an image is the only content in a link or button, describe its destination or action. A magnifying glass that submits a search needs a name such as “Search,” not “Black magnifying glass.” A linked logo might need “Alt Text Pro home.” If visible text already names the same control, repeating it on the icon can be unnecessary.</p>
              <p>These are <a href="https://www.w3.org/WAI/tutorials/images/functional/">functional images</a>. Their job matters more than their appearance. Also check that the control still has an accessible name on mobile, where a visible label may disappear.</p>
              <p>Test the finished page with a screen reader, such as VoiceOver or NVDA. Listen through the reading order and navigate its links. Can you understand the useful images and tell what each image link will do? A filled field in the editor alone cannot answer that.</p>
            </section>

            <section id="image-description-examples">
              <h2>Describing images for accessibility: practical examples</h2>
              <p>The examples below are illustrative. Use only details you can verify in your own image and page.</p>
              <h3>A product gallery</h3>
              <p>Give each view a reason to exist. For a shoe, the main photo could use “Navy running shoe with white sole, side view.” Another might use “Sole of the navy running shoe showing the tread pattern.” Repeating “running shoe” across six photos loses the differences a shopper needs.</p>
              <h3>A tutorial screenshot</h3>
              <p>Describe the relevant state or control, such as “Image block settings with the Alternative text field open.” Put the full instructions in the article itself. A screenshot should help someone follow a step, not be the only place that step is explained.</p>
              <h3>A chart or infographic</h3>
              <p>For a fictional sales chart, a short alternative could be “Monthly sales rise from 120 in January to 210 in March. Values are listed below.” Then provide the actual values, labels and important relationships in accessible text or a table. Only point to information that is really available.</p>
              <p>The <a href="https://www.w3.org/WAI/tutorials/images/complex/">W3C&apos;s complex image guidance</a> describes this combination of a short alternative and a fuller description. Squeezing a whole infographic into one long alt attribute makes it harder to navigate.</p>
              <h3>A photo of a person</h3>
              <p>In a speaker profile, a confirmed name may be enough: “Priya Shah.” In an article about pottery techniques, the action matters: “Potter shaping the rim of a bowl on a wheel.” Do not invent someone&apos;s identity, mood or background.</p>
              <h3>A poster with important text</h3>
              <p>If the poster is the only place that gives an event&apos;s date and venue, readers need those details in text. Better still, publish them as normal page content too. When that nearby text already gives the full message, the poster does not need to repeat it all.</p>
            </section>

            <section id="website-usability">
              <h2>How alt text improves website usability</h2>
              <p>Good descriptions help people complete the task they came for. A shopper can compare product views. A reader can follow a diagram. Someone using an image link can understand where it leads.</p>
              <p>Alt text can also provide a fallback when an image fails to load, although its visible presentation depends on the browser and layout. It does not reduce the file size or make the image download faster.</p>
              <p>Too much description can create friction as well. Hearing every decorative leaf and divider makes a page tiring to navigate. Review a page as a whole, not as a collection of empty fields to fill.</p>
            </section>

            <section id="wordpress">
              <h2>How to add alt text in WordPress</h2>
              <ol>
                <li>Open the post or page and select the Image block.</li>
                <li>Open its block settings and find the alternative text field. Its position can vary with your WordPress version.</li>
                <li>Write the description for this use of the image. For a purely decorative image, keep the alt text empty.</li>
                <li>Save or update the page, then check the published result.</li>
              </ol>
              <p>The <a href="https://wordpress.org/documentation/article/image-block/">WordPress Image block documentation</a> explains the image settings and caption controls. You can also save a description under Media, then Library, by opening the attachment details.</p>
              <p>Do not assume a Media Library edit updates every existing page. A block or page builder may store its own image markup. Inspect an already published post, especially if the same photo appears in several places. You may need a different description for each use.</p>
            </section>

            <section id="checklist">
              <h2>A quick check before publishing</h2>
              <ul>
                <li>Does each informative image have a useful text alternative?</li>
                <li>Are decorative images intentionally skipped?</li>
                <li>Do image links and buttons have clear names?</li>
                <li>Have you checked names, numbers and any AI guesses?</li>
                <li>Does the alt text add something beyond the caption?</li>
                <li>Are chart details and essential screenshot instructions available as normal text?</li>
                <li>Have you checked the published page, including its mobile layout?</li>
              </ul>
              <p>Start with one important page. Read its descriptions in order, fix the unclear ones and use what you learn on the next page. A small, careful review is a useful first step before generating descriptions for an entire library.</p>
            </section>

            <aside className={styles.cta} aria-label="Try Alt Text Pro">
              <h2>Have a WordPress library to work through?</h2>
              <p>Generate a draft with Alt Text Pro, check it against the image and page, then save the description that fits.</p>
              <Link href="/ai-alt-text-generator-for-wordpress" className={buttonVariants()}>See how Alt Text Pro works</Link>
            </aside>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
}
