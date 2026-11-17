import Link from "next/link";
import ArticleTable from "./ArticleTable";
import ExampleCard from "./ExampleCard";

const images = {
  businessTeam: { src: "/business-team.jpg", width: 2816, height: 1536, photo: true },
  mountainLandscape: { src: "/mountain-landscape.jpg", width: 2816, height: 1536, photo: true },
  mallowmere: { src: "/alt-text-examples/mallowmere.svg", width: 272, height: 74 },
  search: { src: "/alt-text-examples/search.svg", width: 44, height: 44 },
  sparkles: { src: "/alt-text-examples/sparkles.svg", width: 44, height: 44 },
  cart: { src: "/alt-text-examples/cart.svg", width: 44, height: 44 },
  repairBookings: { src: "/alt-text-examples/repair-bookings.svg", width: 410, height: 235 },
  blueMugSide: { src: "/alt-text-examples/blue-mug-side.svg", width: 320, height: 210 },
  blueMugTop: { src: "/alt-text-examples/blue-mug-top.svg", width: 320, height: 210 },
  imageSettings: { src: "/alt-text-examples/image-settings.svg", width: 420, height: 220 },
  quoteCard: { src: "/alt-text-examples/quote-card.svg", width: 420, height: 210 },
  flourish: { src: "/alt-text-examples/flourish.svg", width: 210, height: 44 },
  freshVegetables: { src: "/fresh-vegetables.jpg", width: 2816, height: 1536, photo: true },
};

export const introduction = (
  <>Good alt text gives readers the detail they would miss if they couldn&apos;t see the image. These examples show the image in context, with weak and better alt text side by side. For the rules and editing steps, see <Link href="/how-to-write-alt-text">how to write alt text</Link>.</>
);

export const sections = [
  {
    id: "photos",
    title: "Alt text for photos",
    content: (
      <>
        <p>The first two examples show the same meeting photo. On a workplace news page, the people standing by the whiteboard help readers picture the scene. In a furniture listing, the people and laptops show a shopper how the table is used.</p>
        <ExampleCard example={{
          title: "People in a news story",
          context: "In a sample workplace news story about a team meeting.",
          weak: "Meeting photo",
          better: "Eight people around a conference table, with two standing by a whiteboard.",
          why: "It tells readers how the group is gathered and where the two people are standing.",
          image: images.businessTeam,
          html: "<img src=\"/business-team.jpg\" width=\"2816\" height=\"1536\" alt=\"Eight people around a conference table, with two standing by a whiteboard.\">",
        }} />
        <ExampleCard example={{
          title: "The same image on a product page",
          context: "In a sample furniture listing for the conference table.",
          weak: "Large table",
          better: "Long conference table with people seated on both sides using laptops.",
          why: "It helps a shopper picture how the table is used.",
          image: images.businessTeam,
          html: "<img src=\"/business-team.jpg\" width=\"2816\" height=\"1536\" alt=\"Long conference table with people seated on both sides using laptops.\">",
        }} />
        <p>A verified speaker&apos;s name may be useful in a profile. In a wider shot of a meeting, the useful detail might be who&apos;s at the whiteboard or where people are seated. Check a caption or reporting note before you name people, roles or the occasion.</p>
        <ExampleCard example={{
          title: "A place photo",
          context: "In a landscape photography article about reflections.",
          weak: "Mountain landscape",
          better: "Snow-striped peaks and evergreens reflected in a calm lake.",
          why: "It describes the reflection the reader came to see.",
          image: images.mountainLandscape,
        }} />
        <p>When you write alt text for photographs in a portfolio, consider what you chose to show in the frame. In a series about reflections, the relationship between the shoreline and the water can matter. In a trail guide using the same image, a verified place name or visible route marker might be more useful. Give credits or camera settings in a caption if readers need them. Keeping the caption and the alt text beside each other makes it easier to see what each contributes.</p>
      </>
    ),
  },
  {
    id: "logos",
    title: "Alt text for logos",
    content: (
      <>
        <p>Start with what the logo does on the page. It might name the company, link to its homepage or sit alongside the same name in text. The examples below use the same logo for a fictional company, Mallowmere Studio.</p>
        <ExampleCard example={{
          title: "A standalone company logo",
          context: "At the top of a company profile where the image supplies the name.",
          weak: "Yellow square with a mountain shape",
          better: "Mallowmere Studio",
          why: "The name identifies the company for readers who can't see the logo.",
          image: images.mallowmere,
          html: "<img src=\"/alt-text-examples/mallowmere.svg\" width=\"272\" height=\"74\" alt=\"Mallowmere Studio\">",
        }} />
        <ExampleCard example={{
          title: "A logo that links home",
          context: "As the only content of the site header's home link.",
          weak: "Mallowmere Studio",
          better: "Mallowmere Studio home",
          why: "A reader hearing the link on its own can tell that it goes to the company's homepage.",
          image: images.mallowmere,
          html: "<a href=\"/\">\n  <img src=\"/alt-text-examples/mallowmere.svg\" width=\"272\" height=\"74\" alt=\"Mallowmere Studio home\">\n</a>",
        }} />
        <p>The image&apos;s alt text becomes the link&apos;s accessible name, the label a screen reader can announce. Listen to that name on its own. If a footer logo leads to a different page, change its alt text to name that destination.</p>
        <ExampleCard example={{
          title: "A logo in a partner strip",
          context: "In a partner strip next to the visible name Mallowmere Studio.",
          weak: "Mallowmere Studio",
          better: "",
          why: "The visible name already identifies the partner.",
          image: images.mallowmere,
          visibleLabel: "Mallowmere Studio",
        }} />
        <p>For a strip that uses logos alone to identify partners, give each informative logo the corresponding name. If a logo is a separate link, check the name of that link independently. A nearby partner label may be clear on screen while leaving the link itself unnamed. If the image and label share one link and the label tells readers where it goes, the image can have empty alt text.</p>
      </>
    ),
  },
  {
    id: "icons",
    title: "Alt text for icons",
    content: (
      <>
        <p>Look at what is inside the search button. If it contains just a magnifying glass image, the image&apos;s alt text can name the button. If it also contains the word “Search,” that word can do the job. Check the button&apos;s accessible name on a narrow screen too, since some layouts hide the text label on mobile.</p>
        <ExampleCard example={{
          title: "An icon with a visible label",
          context: "Inside a search button that also contains the visible word Search.",
          weak: "Search",
          better: "",
          why: "The visible label names the button once.",
          image: images.search,
          visibleLabel: "Search",
          html: "<button type=\"submit\">\n  <img src=\"/alt-text-examples/search.svg\" width=\"44\" height=\"44\" alt=\"\">\n  Search\n</button>",
        }} />
        <ExampleCard example={{
          title: "An icon-only search button",
          context: "As the only content of the submit button in a search form.",
          weak: "Magnifying glass",
          better: "Search",
          why: "It tells readers what the button does.",
          image: images.search,
          html: "<button type=\"submit\">\n  <img src=\"/alt-text-examples/search.svg\" width=\"44\" height=\"44\" alt=\"Search\">\n</button>",
        }} />
        <ExampleCard example={{
          title: "A decorative icon",
          context: "Beside a heading where it adds a little ornament.",
          weak: "Sparkles",
          better: "",
          why: "The heading carries the message on its own.",
          image: images.sparkles,
        }} />
        <p>These examples use SVG files in HTML image elements. If you use an inline SVG, give the enclosing button a name such as <code>aria-label=&quot;Search&quot;</code> and hide the SVG from assistive technology with <code>aria-hidden=&quot;true&quot;</code>. Use a real button so people can still reach and activate it with a keyboard.</p>
        <p>Some icons add information that the visible label leaves out. A PDF icon next to “Download agenda” can tell readers what kind of file they are about to open. Put “PDF” in the visible label if everyone needs that detail. For a decorative accent like the sparkles above, removing the icon from the reading order leaves all the information intact.</p>
      </>
    ),
  },
  {
    id: "buttons-and-links",
    title: "Alt text for buttons and links",
    content: (
      <>
        <p>Read your image link&apos;s name as if it were on its own in a list of links. Would you know where “Shopping cart icon” would take you? “View cart” gives you the destination. For a button, use a name that tells the reader what happens when they press it.</p>
        <ExampleCard example={{
          title: "An image link to the cart",
          context: "As the only content of a link to a store's cart.",
          weak: "Shopping cart icon",
          better: "View cart",
          why: "The name tells the reader where activating the link will take them.",
          image: images.cart,
          html: "<a href=\"/cart\">\n  <img src=\"/alt-text-examples/cart.svg\" width=\"44\" height=\"44\" alt=\"View cart\">\n</a>",
        }} />
        <p>The same cart graphic can open the cart or add a product. Give the first control a name such as “View cart” and the second a name such as “Add to cart.” On a product list where several image links say “View product,” give each link a specific destination, such as the name of the product. If the product name is already inside the same link, check whether it supplies all the information the link needs.</p>
        <p>A form can also use <code>input type=&quot;image&quot;</code> to submit. It needs a nonempty alt attribute that gives the submit action, such as “Search” on a search form. In each pattern, inspect the rendered control after you edit it. A caption beside the image may tell a sighted visitor what to click while leaving the actual link or button without a useful name.</p>
      </>
    ),
  },
  {
    id: "charts-and-infographics",
    title: "Alt text for charts, graphs and infographics",
    content: (
      <>
        <p>If you could point out one thing about this chart, it would be that repair bookings rose from April through June. Put that takeaway in the alt text. Give the monthly values in a table so readers can compare two months or calculate the difference.</p>
        <ExampleCard example={{
          title: "A bar chart",
          context: "In an illustrative quarterly report for a fictional repair shop.",
          weak: "Bar chart",
          better: "Repair bookings rose each month, from 48 in April to 76 in June.",
          why: "It states the trend first, and the table below supplies the individual values.",
          image: images.repairBookings,
          html: "<img src=\"/alt-text-examples/repair-bookings.svg\" width=\"410\" height=\"235\" alt=\"Repair bookings rose each month, from 48 in April to 76 in June.\">",
        }} />
        <ArticleTable
          caption="Illustrative repair bookings by month"
          headings={["Month", "Repair bookings"]}
          rows={[
            ["April", "48"],
            ["May", "62"],
            ["June", "76"],
          ]}
        />
        <p>For a chart with two series, name the series in the table headers. Include the units and time span where someone can find them without inspecting the axes. If a note explains a missing month or a change in how a metric was counted, keep that note in the page text as well. Readers need it to interpret both versions of the chart.</p>
        <p>A brief explanation can live in a paragraph next to an image, with <code>aria-describedby</code> pointing to the paragraph when the association helps. Keep tabular data in a separate HTML table so readers can navigate by row and column. For an infographic with several steps or labels, present the details in the same order in a nearby list. The alt text can summarize the subject and tell readers where the full information appears.</p>
      </>
    ),
  },
  {
    id: "product-photos",
    title: "Alt text for product photos",
    content: (
      <>
        <p>Start with what the shopper can learn from this view. The side image shows the shape of the mug and its handle. Looking down into the mug reveals a cream-colored interior. Both descriptions can use the same product type, but each gives the reader a reason to open that image.</p>
        <ExampleCard example={{
          title: "The main product image",
          context: "An illustration of the side view in a fictional WooCommerce catalog that specifies ceramic.",
          weak: "Blue mug",
          better: "Side view of a cobalt blue ceramic mug with a wide loop handle.",
          why: "It gives the color, verified material and visible feature a shopper can compare.",
          image: images.blueMugSide,
          html: "<img src=\"/alt-text-examples/blue-mug-side.svg\" width=\"320\" height=\"210\" alt=\"Side view of a cobalt blue ceramic mug with a wide loop handle.\">",
        }} />
        <ExampleCard example={{
          title: "Another gallery view",
          context: "An illustration of the same mug from above in the product gallery.",
          weak: "Side view of a cobalt blue ceramic mug with a wide loop handle.",
          better: "Top view of the cobalt blue mug showing its cream-colored interior and loop handle.",
          why: "It describes the interior a shopper can see from this angle.",
          image: images.blueMugTop,
        }} />
        <p>Check the product specifications before naming a material or finish. The sample listing confirms that this mug is ceramic, a detail that&apos;s hard to verify from an image of a glazed surface alone. Match the color to the variant pictured. If photos change when the shopper switches variants, check the alt text on the newly selected image too.</p>
        <p>The same review applies to a Shopify gallery. Open the main image and the close-ups in order, and look for what changes from one to the next. If a close-up shows a texture, closure or feature that matters before purchase, describe it there. If one file appears on a category page and on a detail page, see whether the editor lets you use wording appropriate to each. On WordPress, see <Link href="/woocommerce-product-image-alt-text">how to add alt text to WooCommerce product images</Link>.</p>
      </>
    ),
  },
  {
    id: "screenshots",
    title: "Alt text for screenshots",
    content: (
      <>
        <p>Name the control the reader should find and the panel it belongs to. In this mockup, the reader is looking for the Alternative text field inside Image settings. Details such as the menu chevron can stay out of the description.</p>
        <ExampleCard example={{
          title: "A settings panel crop",
          context: "A mock editor screenshot in a tutorial about finding the alternative text field.",
          weak: "Editor screenshot",
          better: "Image settings panel with the Alternative text field open.",
          why: "It points the reader to the field used in the tutorial.",
          image: images.imageSettings,
          html: "<img src=\"/alt-text-examples/image-settings.svg\" width=\"420\" height=\"220\" alt=\"Image settings panel with the Alternative text field open.\">",
        }} />
        <p>In your instructions, say how to reach the state the screenshot shows. Open Image settings, then find the Alternative text field. The sample value shown in it is “Blue ceramic mug with a wide loop handle.” Someone using the tutorial can follow the step and read the example directly in the page text.</p>
        <p>On an error screenshot, the words of the message can matter more than the position of the box. Put any error code or recovery step a reader needs in selectable text so they can copy it. In a series of screenshots, give each alt description the step or state that changes, such as the field opening or a saved value appearing. Review the instructions if an editor update moves or renames a control. A clear description of an old panel still sends readers to the old location.</p>
      </>
    ),
  },
  {
    id: "images-of-text",
    title: "Alt text for images of text",
    content: (
      <>
        <p>If a graphic is the only place readers get a short message, put the words of that message in the alt text. A general description of a quote card might tell readers that the image has words. The actual sentence lets them read what the card says.</p>
        <ExampleCard example={{
          title: "A quote card shared on social media",
          context: "In an example social post where the quote appears only in the card.",
          weak: "Quote card about questions",
          better: "Leave room for better questions.",
          why: "It gives the reader the same words that appear on the card.",
          image: images.quoteCard,
          html: "<img src=\"/alt-text-examples/quote-card.svg\" width=\"420\" height=\"210\" alt=\"Leave room for better questions.\">",
        }} />
        <p>Read through the graphic in order before writing its alt text. A quote card may include who said it. An event graphic may give a date, place or registration detail in smaller type. Include the words a reader needs to get the full message. If the post already contains the entire message and the graphic adds no other information, an HTML image can use empty alt text so readers hear the message once.</p>
        <p>For longer announcements, put the full wording in regular page text, where readers can select, resize or translate it. Then decide what the graphic contributes alongside it. If the whole graphic is a link, give that link a name that makes its destination clear, and keep any event details that people need before following the link in the surrounding text. Check that the text version stays current whenever someone swaps out the graphic.</p>
      </>
    ),
  },
  {
    id: "decorative-and-background-images",
    title: "Alt text for decorative images and backgrounds",
    content: (
      <>
        <p>Read the page with the image hidden. The headings still tell you where sections start when the divider disappears. In a photography tutorial, though, hiding a background image might remove the only example of a reflection. Look for information that disappears with the image.</p>
        <ExampleCard example={{
          title: "A decorative divider",
          context: "Between two sections whose headings already mark the change of topic.",
          weak: "Gold divider",
          better: "",
          why: "The divider adds no information the reader needs.",
          image: images.flourish,
          html: "<img src=\"/alt-text-examples/flourish.svg\" width=\"210\" height=\"44\" alt=\"\">",
        }} />
        <p>Keep both quotes when you type an empty alt attribute. That marks an HTML image as one assistive technology can skip. Leaving the attribute out omits that instruction. If your editor has a “Mark as decorative” option, check the rendered image to confirm what markup it produced.</p>
        <ExampleCard example={{
          title: "A meaningful CSS background",
          context: "As a background image in a photography tutorial about composing reflections.",
          weak: "Scenic background",
          better: "Snow-striped peaks and evergreens reflected in a lake.",
          why: "Visible page text carries the detail that the CSS background cannot convey through an alt attribute.",
          image: images.mountainLandscape,
          background: true,
        }} />
        <p>A CSS background is set by the page&apos;s styling, so it has no HTML image element to give an <code>alt</code> attribute. When the background conveys something the reader needs, write that information in or beside the section. For a standalone image that calls for its own alternative, use an HTML image with appropriate alt text. If the background is only a texture behind a heading, the heading can do its job without a description of the texture.</p>
      </>
    ),
  },
  {
    id: "seo",
    title: "Alt text examples for SEO",
    content: (
      <>
        <p>Google uses alt text, page content and computer vision to understand images. For a farmers market guide, naming the carrots and tomatoes helps readers picture the stall. A list of shopping keywords leaves those details out.</p>
        <ExampleCard example={{
          title: "Produce at a farmers market",
          context: "In a farmers market guide showing what a produce stall looks like.",
          weak: "Farmers market vegetables fresh vegetables buy vegetables local vegetable market produce deals",
          better: "Carrots and mixed-color tomatoes at a farmers market stall.",
          why: "It names the produce a reader would see at the stall.",
          image: images.freshVegetables,
          html: "<img src=\"/fresh-vegetables.jpg\" width=\"2816\" height=\"1536\" alt=\"Carrots and mixed-color tomatoes at a farmers market stall.\">",
        }} />
        <p>Mention a place, variety or product name when you can verify it and it helps someone understand the image. In a guide to a named market, the introduction can establish its location once. Individual image descriptions can then tell readers which stall, feature or scene is pictured. If several images have the same alt text, read them in sequence and see what is missing from each description.</p>
        <p>Read your description aloud with the surrounding paragraph. The alt text should make sense without the picture. Give readers practical details such as opening hours, location or what to buy in season in the guide itself. Alt text gives search engines context for the image, and search visibility depends on more than this field.</p>
      </>
    ),
  },
];

export const reference = {
  title: "Quick reference",
  caption: "Alt text by image type",
  headings: ["Image type", "What the alt text should say", "Example"],
  rows: [
    ["Photo", "The subject and the detail that matters on this page", "Snow-striped peaks and evergreens reflected in a calm lake."],
    ["Logo", "The organization name or the destination of a linked logo", "Mallowmere Studio home"],
    ["Icon", "The action if the icon names a control, or empty alt if text inside the same control already gives it a name", "Search"],
    ["Image button or link", "What the button does or where the link goes", "View cart"],
    ["Chart or infographic", "The main takeaway, with details in nearby text or a table", "Repair bookings rose each month, from 48 in April to 76 in June."],
    ["Product photo", "The product and the relevant details visible in that view", "Side view of a cobalt blue ceramic mug with a wide loop handle."],
    ["Screenshot", "The control, state or detail the reader needs to find", "Image settings panel with the Alternative text field open."],
    ["Image of text", "The words in the graphic when it is the only place they appear", "Leave room for better questions."],
    ["Decorative image or CSS background", "Empty alt for a decorative HTML image. Visible page text for meaningful CSS backgrounds.", "alt=\"\" for a decorative divider"],
    ["Image for SEO", "An accurate description with relevant terms used naturally", "Carrots and mixed-color tomatoes at a farmers market stall."],
  ],
};

export const faqTitle = "FAQ";

export const faqs = [
  {
    question: "What is a good example of alt text?",
    answer: "“Carrots and mixed-color tomatoes at a farmers market stall” is useful in a market guide because it tells readers what is visible and where the produce is displayed. A guide to market photography might describe the layout of the crates or the way the produce is arranged.",
  },
  {
    question: "How long should alt text be?",
    answer: "A short phrase or sentence often does the job. WCAG does not set a character limit for alt text. The Alt Text Pro checker flags alt text over 150 characters so you can review it. If a chart or infographic needs a longer explanation, keep the key point in the alt text and put the details on the page.",
  },
  {
    question: "What alt text should a logo have?",
    answer: "Use the company name when a standalone logo identifies the company. If it is the only content of a home link, use wording like “Mallowmere Studio home.” When visible text already identifies an unlinked logo, or names the same link, the redundant image can use empty alt.",
  },
  {
    question: "Do icons need alt text?",
    answer: "An icon that supplies the name of a button or link needs a text alternative that communicates the action or destination. For an HTML image icon that sits inside a control with a clear text label, use alt=\"\". A purely decorative image icon also uses empty alt.",
  },
  {
    question: "What is the alt text for a decorative image?",
    answer: "Use alt=\"\" on a decorative HTML image. The attribute is present and its value is empty, which tells assistive technology it can skip the image. Check that it really is decorative in the context where you use it.",
  },
  {
    question: "Should alt text include keywords?",
    answer: "Use a search phrase when it naturally describes the image in context. Say what someone would see, such as the product type or the subject of the photo. If a word comes up twice, check whether it adds anything the second time.",
  },
];

export const callToAction = {
  title: "Check your page",
  content: (
    <>
      <p><Link href="/alt-text-checker">Check a page for missing or weak alt text</Link> with the free Alt Text Pro checker. Look at each result in context before deciding whether an empty value is intentional or a description needs an edit.</p>
      <p>On WordPress, Alt Text Pro can <Link href="/ai-alt-text-generator-for-wordpress">draft an image description in the media editor</Link> or <Link href="/bulk-generate-alt-text-wordpress">draft descriptions across a media library</Link>. Review each draft against the image and the page before saving it.</p>
    </>
  ),
};

export const sources = [
  { label: "W3C WAI Images Tutorial", href: "https://www.w3.org/WAI/tutorials/images/" },
  { label: "W3C WAI alt decision tree", href: "https://www.w3.org/WAI/tutorials/images/decision-tree/" },
  { label: "W3C WAI complex images tutorial", href: "https://www.w3.org/WAI/tutorials/images/complex/" },
  { label: "WCAG 2.2 Success Criterion 1.1.1, Non-text Content", href: "https://www.w3.org/TR/WCAG22/#non-text-content" },
  { label: "HTML Standard requirements for text alternatives", href: "https://html.spec.whatwg.org/multipage/images.html#alt" },
  { label: "Google Search Central image SEO guidance", href: "https://developers.google.com/search/docs/appearance/google-images#use-descriptive-alt-text" },
];
