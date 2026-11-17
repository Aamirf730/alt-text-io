# Planning handoff

## Angle and voice

Readers should be able to recognize a situation they have on their site, compare two answers, and understand the decision in one visit. Organize by the image's purpose on the page. Open with the same photo used in two contexts. Show the contrast immediately, then let the remaining cards build on it. Link to the writing guide for the general rules and procedural steps.

Write as Alt Text Pro addressing editors, photographers, designers and shop owners directly. Use plain, calm wording and assume the reader knows their site's editor. Define terms such as `alt`, accessible name and CSS background at the point they matter. Use commands and named controls where readers can take an action. When the same meeting photo appears in the catalog, for example, say “The laptops help a shopper see how the table is used.” Skip the hypothetical team's identities, what they are discussing and the table's unverified material. Add searchable terms where they describe the content, never as filler.

The comparison library is **Strong** as an editorial format because it lets readers see which details support each use. Search performance is **Promising but Unproven**. Advertising competition and a rankings snapshot do not predict organic reach. Review Search Console impressions, queries and clicks after the URL is indexed before investing in more articles. Keep this planning judgment out of the article.

## Page header and manuscript format

- H1 `Alt Text Examples`. Intro in two or three sentences. Explain that good alt text carries the information or function that matters here. Explain the photograph, context and Weak/Better comparisons. Work in a contextual link to [how to write alt text](/how-to-write-alt-text) without a second instruction-heavy introduction.
- Metadata title `Alt Text Examples: Good and Bad Alt Text | Alt Text Pro`. Description `Compare weak and better alt text for logos, icons, buttons, charts and product photos. See each image in context and copy the HTML for your own page.` Canonical `https://www.alt-text.pro/alt-text-examples`. Match local Open Graph and Twitter patterns, with a 1200 × 630 branded image if the baseline has no shared template. Article JSON-LD must use the actual publication date in `YYYY-MM-DD`. Coordinate the prepared value with the release owner to reflect the first production publication. Use the six visible FAQ answers as the FAQPage JSON-LD source.
- Keep the deliverable as a Markdown article starting at the H1. Use H2 for the ten numbered section topics below, the quick reference, FAQ and Sources. Use H3 for each card and FAQ question. Under a card title, list `Image`, `Context`, `Weak`, `Better` and `Why` as separate lines. Use the exact public asset path in the Image field. Use `alt=""` in the Better field where alt is empty. Add `HTML` in a fenced `html` code block immediately after the card where the snippet applies. The image and HTML fields are implementation directions. The context, variants and one-sentence why are visible on the page. End editor notes after a horizontal rule, outside the article.
- Aim for roughly 160 to 190 prose words per H2 across the opening, between-card bridges and closing application checks. The intro, FAQ and CTA add about 300 words. This makes the approximate 1,800 to 2,500-word prose target achievable with examples measured separately. Use fewer words where another paragraph would merely repeat a rule. Avoid semicolons and en and em dashes in all visible article text. Match wording to the final image, HTML, table and structured metadata.

## Contents and visual card inventory

There are 18 cards. Jump links use the ten section IDs below. The three JPGs are existing site demo assets, 2816 × 1536. All new SVGs live under `/alt-text-examples/`. Assets are fixed. The suggested alt wording can be refined against the asset and context, except for the exact wordmark, visible quote text and chart numbers.

### 1. Alt text for photos · `photos` · 3 cards

- **People in a news story**, `/business-team.jpg`. Use a hypothetical workplace news story to avoid presenting generated demo imagery as reporting. Better can focus on “Eight people around a conference table, with two standing by a whiteboard.” The weak version can be “Meeting photo.”
- **The same image on a product page**, `/business-team.jpg`. In a hypothetical office furniture listing, use the long natural-finish table with people seated around it for scale. Better can be “Long conference table with people seated on both sides using laptops.” Keep dimensions and materials out. This is a second use of precisely the same image. Give both examples copyable `<img>` snippets so the changed alt is obvious.
- **A place photo**, `/mountain-landscape.jpg`. On a landscape photography article about reflections, give readers the snow-striped peaks and evergreens reflected in a lake. Do not name an unverified location or infer photo technique. Use “alt text for photographers” in prose only if it reads naturally. The practical advice is to move attribution or equipment into a caption if those are relevant.

### 2. Alt text for logos · `logos` · 3 cards

- **A standalone company logo**, `/alt-text-examples/mallowmere.svg`. The fictional wordmark reads `Mallowmere Studio`. Weak can be a description of the mark's shape. Better exactly `Mallowmere Studio`. Show the actual `<img>`.
- **A logo that links home**, same image. Weak `Mallowmere Studio`. Better exactly `Mallowmere Studio home`. Show `<a href="/"><img …></a>` to make the position of the alt clear.
- **A logo in a partner strip**, same image next to a visible `Mallowmere Studio` label in the example. Weak repeats the name in the image alt. Better `alt=""`. Explain how the answer would change if that strip used the image alone to name the partner or if the two items were separate links. Avoid the prefix “logo of” even in the weak answer.

### 3. Alt text for icons · `icons` · 3 cards

- **An icon with a visible label**, `/alt-text-examples/search.svg` beside visible `Search`. Context is one button with both the image and visible text. Weak `Search`. Better `alt=""`. The markup example uses a named visible text button with an empty icon alt.
- **An icon-only Search button**, same SVG alone. Weak `Magnifying glass`. Better `Search`. Show `<button type="submit"><img src="/alt-text-examples/search.svg" alt="Search"></button>` as a specimen for a search form.
- **A decorative icon**, `/alt-text-examples/sparkles.svg`. Put it beside a heading as ornament. Weak `Sparkles`. Better `alt=""`. Plain prose can cover inline Lucide `<svg>` as a different markup case: give an icon-only control its own accessible name and hide the decorative SVG, since `<svg>` does not use an HTML `img` alt attribute. A specimen artboard should avoid dead interactive controls.

### 4. Alt text for buttons and links · `buttons-and-links` · 1 card

- **An image link to the cart**, `/alt-text-examples/cart.svg`. Context is its only content. Weak `Shopping cart icon`. Better `View cart`. Example `<a href="/cart"><img src="/alt-text-examples/cart.svg" alt="View cart"></a>`. Use `/cart` only in the illustrative code. Present the actual preview as a specimen so it never sends users to an absent page. Describe the difference between naming a link's destination and a button's action. Mention `input type="image"` names the submit action, such as `Search`, and visible text can name a control if included in the control itself.

### 5. Alt text for charts, graphs and infographics · `charts-and-infographics` · 1 card

- **A bar chart**, `/alt-text-examples/repair-bookings.svg`. Fictional repair shop report. Art heading `Repair bookings`, tick labels `Apr`, `May`, `Jun`, values 48, 62, 76, bars to scale from zero. Weak `Bar chart`. Better can be “Repair bookings rose each month, from 48 in April to 76 in June.” Below this card render a real table captioned `Illustrative repair bookings by month` with headers `Month`, `Repair bookings` and rows April 48, May 62, June 76. Snippet shows the short alt and clearly indicates in prose that the nearby table supplies all values. Structured content is easier to navigate than flattening a table through `aria-describedby`. Discuss using a concise plain-text description if `aria-describedby` is used, and how to keep infographic labels or data accessible as text. A real HTML table keeps its own headers and caption.

### 6. Alt text for product photos · `product-photos` · 2 cards

- **The main product image**, `/alt-text-examples/blue-mug-side.svg`. A clearly marked illustration from a fictional WooCommerce catalog with a cobalt blue ceramic mug and wide loop handle in side profile. Weak `Blue mug` or a SKU. Better can be “Side view of a cobalt blue ceramic mug with a wide loop handle.” Include `<img>`. The fictional catalog confirms ceramic. Teach readers to confirm material from specifications and choose the visible detail that helps compare options.
- **Another gallery view**, `/alt-text-examples/blue-mug-top.svg`. The same blue mug, cream-colored interior and loop handle seen from above. Weak can repeat the main gallery image's alt. Better brings the cream-colored interior and top view into focus. Add the descriptive link to [writing alt text for WooCommerce product images](/woocommerce-product-image-alt-text). A passing Shopify mention can illustrate that the same choice applies to product galleries there. Keep the product CTA scoped to WordPress.

### 7. Alt text for screenshots · `screenshots` · 1 card

- **A settings panel crop**, `/alt-text-examples/image-settings.svg`. A mock tutorial view with `Image settings`, an `Alternative text` field, and example value `Blue ceramic mug with a wide loop handle.` Weak `Editor screenshot`. Better can be “Image settings panel with the Alternative text field open.” Include `<img>`. The surrounding article tells the reader to open Image settings and find Alternative text. The screenshot gives them a visual cue. If the pictured value is necessary to complete a task, include it in nearby text rather than expecting the image to carry the instruction. Identify artwork as a mockup of an editor.

### 8. Alt text for images of text · `images-of-text` · 1 card

- **A quote card shared on social media**, `/alt-text-examples/quote-card.svg`. In a post where the message appears only in the graphic, weak `Quote card about questions`. Better exactly `Leave room for better questions.` including terminal period. No attribution or extra text in the artwork. Include `<img>`. Explain how to treat present attribution, event dates and other words a reader needs, and when already-present text can let a redundant graphic use empty alt. Recommend ordinary text when feasible since readers can resize, select or translate it. In the linked graphic case the control's name still needs to tell the reader what the link does.

### 9. Alt text for decorative images and backgrounds · `decorative-and-background-images` · 2 cards

- **A decorative divider**, `/alt-text-examples/flourish.svg`. Duplication-free use between sections. Weak `Curved divider`. Better `alt=""`. Include `<img src="/alt-text-examples/flourish.svg" alt="">`. Briefly explain the difference between an explicitly empty attribute and an absent attribute.
- **A meaningful CSS background**, `/mountain-landscape.jpg` reused through actual background CSS. Context is a photography tutorial hero conveying what a reflection looks like. Weak “Scenic background” or no usable equivalent. Better is visible text in the hero or directly beside it: `Snow-striped peaks and evergreens reflected in a lake.` Mark Better as page text, since a CSS background has no HTML `alt` field. If the descriptive text must be associated with a particular image elsewhere, the alternate implementation is a real `<img>` with appropriate alt. This card needs a visual but no duplicate `<img>`.

### 10. Alt text examples for SEO · `seo` · 1 card

- **Produce at a farmers market**, `/fresh-vegetables.jpg`. On a market guide about seasonal produce. Weak is an obviously stuffed shopping keyword list. Better can be “Carrots and mixed-color tomatoes at a farmers market stall.” Include `<img>`. Only use varieties, location or season if independently known and useful. Google uses alt alongside the page and image to understand it. Readers still need a succinct description and relevant surrounding text. Avoid ranking, guaranteed visibility and compliance claims.

## Closing material

- **Quick reference**. Add one row per section with a real `<caption>` such as `Alt text by image type`, column headers `Image type`, `What the alt text should say`, `Example`, and appropriate row headers. Quote faithful examples and show `alt=""` literally. In the decorative/background row, clarify which example is an HTML image and what changes for CSS.
- **FAQ**. Use the six exact brief questions. Good example can reuse the market image's concrete details and context. Length answer says a short phrase or sentence often works and no fixed ceiling, with the checker's flag strictly over 150 characters as a prompt to review. Logo answer distinguishes standalone and sole home link plus duplicate visible label. Icons answer distinguishes label, icon-only controls and decoration. Decorative answer retains the attribute with an empty value. Keyword answer allows wording that describes the image and reflects context naturally. Avoid implying the checker judges accuracy or offers a compliance verdict.
- **CTA**. Link [check a page for missing or weak alt text](/alt-text-checker). On WordPress, link [draft a description in the media editor](/ai-alt-text-generator-for-wordpress) and [draft descriptions across a media library](/bulk-generate-alt-text-wordpress). Say you review each one before saving.
- **Sources**. Short visible list: [W3C WAI Images Tutorial](https://www.w3.org/WAI/tutorials/images/), [W3C WAI alt decision tree](https://www.w3.org/WAI/tutorials/images/decision-tree/), [WCAG 2.2 SC 1.1.1](https://www.w3.org/TR/WCAG22/#non-text-content), [HTML Standard requirements for providing text alternatives](https://html.spec.whatwg.org/multipage/images.html#alt), [Google Search Central image SEO guidance](https://developers.google.com/search/docs/appearance/google-images#use-descriptive-alt-text). WAI's [complex images guidance](https://www.w3.org/WAI/tutorials/images/complex/) and [CSS background technique](https://www.w3.org/WAI/WCAG22/Techniques/failures/F3) support those specific details and can be linked from the section discussion if needed.

## Handoff checks

- Confirm every proposed detail can be seen in the demo image or has a declared sample catalog fact. Test whether Weak and Better remain meaningful when read without the visual. Distinguish empty alt, functional image labels and visible descriptions of CSS backgrounds.
- Keep alt text in snippets synchronized with Better text and the image's rendered `alt`. Every section has at least one copyable `<img>` sample, with wrappers for functional cases. Add intrinsic dimensions to each rendered image. Preserve the same table statistics, quote text and visible labels across article and assets.
- Confirm correct headings, ten anchors, responsive card stack on narrow phones, operable copy buttons, and no live demo controls without working destinations. Verify local HTML, Article and FAQPage data, canonical/social and sitemap entries, all incoming links, OG rendering, no missing alt in the checker and intentional empty results. The local checker transport may use its existing injectable fixture path since production intentionally blocks loopback.
- Verify the rendered punctuation and word count, then compare the edited article against sources and the existing how-to, checker and WooCommerce guide. Local commit is scoped to the brief. External publication awaits the user's authorization.
