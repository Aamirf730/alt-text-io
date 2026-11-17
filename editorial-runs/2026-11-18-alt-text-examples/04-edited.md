# Alt Text Examples

Good alt text tells a reader what matters about an image where it appears. Each example here shows the image, where it might be used, a weak version and a better one. For the rules and editing steps, see the guide to [how to write alt text](/how-to-write-alt-text).

## Alt text for photos

The two meeting examples use the same file. In a news story about a workplace meeting, the arrangement of the group helps readers picture the scene. In a furniture listing, a shopper wants to see how people fit around the table. The seated people and laptops show how its surface is used.

### People in a news story

Image: /business-team.jpg
Context: On an illustrative workplace news page about a team meeting.
Weak: Meeting photo
Better: Eight people around a conference table, with two standing by a whiteboard.
Why: It places the group around the table and gives the reader a landmark in the room.

```html
<img src="/business-team.jpg" width="2816" height="1536" alt="Eight people around a conference table, with two standing by a whiteboard.">
```

### The same image on a product page

Image: /business-team.jpg
Context: On an illustrative furniture listing for the conference table in the same image.
Weak: Large table
Better: Long conference table with people seated on both sides using laptops.
Why: It helps a shopper picture how the table is used.

```html
<img src="/business-team.jpg" width="2816" height="1536" alt="Long conference table with people seated on both sides using laptops.">
```

Before describing a person, check whether the story can identify them and whether their identity matters here. A verified speaker's name may be useful in a profile. For a wider view of a room or crowd, where people are standing and what they are doing can carry more of the scene. Check a caption or reporting note for names, roles and the occasion before you include them.

### A place photo

Image: /mountain-landscape.jpg
Context: In a landscape photography article about reflections.
Weak: Mountain landscape
Better: Snow-striped peaks and evergreens reflected in a calm lake.
Why: It describes the reflection the reader came to see.

When you write alt text for photographs in a portfolio, consider what you chose to show in the frame. In a series about reflections, the relationship between the shoreline and the water can matter. In a trail guide using the same image, a verified place name or visible route marker might be more useful. Give credits or camera settings in a caption if readers need them. Keeping the caption and the alt text beside each other makes it easier to see what each contributes.

## Alt text for logos

A logo can identify a company, serve as the home link, or sit beside text that already gives the name. Look at how the logo is used before describing it. Mallowmere Studio is a fictional company, and the same wordmark has a different job in each example below.

### A standalone company logo

Image: /alt-text-examples/mallowmere.svg
Context: At the top of a company profile where the image supplies the name.
Weak: Yellow square with a mountain shape
Better: Mallowmere Studio
Why: The company name is the information the wordmark supplies.

```html
<img src="/alt-text-examples/mallowmere.svg" width="272" height="74" alt="Mallowmere Studio">
```

### A logo that links home

Image: /alt-text-examples/mallowmere.svg
Context: As the only content of the site header's home link.
Weak: Mallowmere Studio
Better: Mallowmere Studio home
Why: It gives the link a name that includes its destination.

```html
<a href="/">
  <img src="/alt-text-examples/mallowmere.svg" width="272" height="74" alt="Mallowmere Studio home">
</a>
```

The alt text on the image inside this link supplies its accessible name. That is the label the browser exposes to tools such as screen readers. If the name “Mallowmere Studio home” would make sense when heard away from the rest of the header, the link can stand on its own. The same check works for a footer logo that leads somewhere else. Use the name of the page the reader actually opens.

### A logo in a partner strip

Image: /alt-text-examples/mallowmere.svg
Context: In a partner strip next to the visible name Mallowmere Studio.
Weak: Mallowmere Studio
Better: alt=""
Why: The visible name already identifies the partner.

For a strip that uses logos alone to identify partners, give each informative logo the corresponding name. If a logo is a separate link, check the name of that link independently. A nearby partner label may be clear on screen while leaving the link itself unnamed. If the image and label share one link and the label tells readers where it goes, the image can have empty alt text.

## Alt text for icons

A magnifying glass can mark the search control or sit next to the word “Search.” In the first situation, the control needs a name. In the second, the text inside the button already gives it one. Check the control’s accessible name at narrow widths too. A layout change can hide the label the control relies on.

### An icon with a visible label

Image: /alt-text-examples/search.svg
Context: Inside a search button that also contains the visible word Search.
Weak: Search
Better: alt=""
Why: The visible label names the button once.

```html
<button type="submit">
  <img src="/alt-text-examples/search.svg" width="44" height="44" alt="">
  Search
</button>
```

### An icon-only search button

Image: /alt-text-examples/search.svg
Context: As the only content of the submit button in a search form.
Weak: Magnifying glass
Better: Search
Why: It tells readers what the button does.

```html
<button type="submit">
  <img src="/alt-text-examples/search.svg" width="44" height="44" alt="Search">
</button>
```

### A decorative icon

Image: /alt-text-examples/sparkles.svg
Context: Beside a heading where it adds a little ornament.
Weak: Sparkles
Better: alt=""
Why: The heading carries the message on its own.

The examples use icons saved as image files. If you put an SVG directly in the page markup, an HTML `alt` attribute on the `<svg>` will not label the control. Give an icon-only button a name on the button itself, for example with `aria-label="Search"`, and hide its pictorial SVG from assistive technology with `aria-hidden="true"`. Keep the button available to the keyboard.

Some icons add information that the visible label leaves out. A PDF icon next to “Download agenda” can tell readers what kind of file they are about to open. Put “PDF” in the visible label if everyone needs that detail. For a decorative accent like the sparkles above, removing the icon from the reading order leaves all the information intact.

## Alt text for buttons and links

Read the name of an image link as though it were on its own in a list of links. “View cart” tells readers where they will go. “Shopping cart icon” gives them the shape they would see on screen and leaves the destination implicit. The same principle applies to picture buttons, where the useful name is the action the button carries out.

### An image link to the cart

Image: /alt-text-examples/cart.svg
Context: As the only content of a link to a store's cart.
Weak: Shopping cart icon
Better: View cart
Why: The name tells the reader where activating the link will take them.

```html
<a href="/cart">
  <img src="/alt-text-examples/cart.svg" width="44" height="44" alt="View cart">
</a>
```

Choose the wording by following the action through. Two cart graphics might look identical. One opens a cart page and the other adds a product, so they would need different names. On a product list where several image links say “View product,” give each link a specific destination, such as the name of the product. If the product name is already inside the same link, check whether it supplies all the information the link needs.

A form can also use `input type="image"` to submit. It needs a nonempty alt attribute that gives the submit action, such as “Search” on a search form. In each pattern, inspect the rendered control after you edit it. A caption beside the image may tell a sighted visitor what to click while leaving the actual link or button without a useful name.

## Alt text for charts, graphs and infographics

Decide what you would say if you had time to point out one thing about the chart. The bars show repair bookings rising from April through June. The short alt text gives that relationship. The table provides each value so someone can check it, compare months or use it in a calculation.

### A bar chart

Image: /alt-text-examples/repair-bookings.svg
Context: In an illustrative quarterly report for a fictional repair shop.
Weak: Bar chart
Better: Repair bookings rose each month, from 48 in April to 76 in June.
Why: It states the trend first, and the table below supplies the individual values.

```html
<img src="/alt-text-examples/repair-bookings.svg" width="410" height="235" alt="Repair bookings rose each month, from 48 in April to 76 in June.">
```

Illustrative repair bookings by month

| Month | Repair bookings |
| --- | --- |
| April | 48 |
| May | 62 |
| June | 76 |

For a chart with two series, name the series in the table headers. Include the units and time span where someone can find them without inspecting the axes. If a note explains a missing month or a change in how a metric was counted, keep that note in the page text as well. Readers need it to interpret both versions of the chart.

A brief explanation can live in a paragraph next to an image, with `aria-describedby` pointing to the paragraph when the association helps. Keep tabular data in a separate HTML table so readers can navigate by row and column. For an infographic with several steps or labels, present the details in the same order in a nearby list. The alt text can summarize the subject and tell readers where the full information appears.

## Alt text for product photos

Start with what the shopper can learn from this view. The side image shows the shape of the mug and its handle. Looking down into the mug reveals a cream-colored interior. Both descriptions can use the same product type, but each gives the reader a reason to open that image.

### The main product image

Image: /alt-text-examples/blue-mug-side.svg
Context: An illustration of the side view in a fictional WooCommerce catalog that specifies ceramic.
Weak: Blue mug
Better: Side view of a cobalt blue ceramic mug with a wide loop handle.
Why: It gives the color, verified material and visible feature a shopper can compare.

```html
<img src="/alt-text-examples/blue-mug-side.svg" width="320" height="210" alt="Side view of a cobalt blue ceramic mug with a wide loop handle.">
```

### Another gallery view

Image: /alt-text-examples/blue-mug-top.svg
Context: An illustration of the same mug from above in the product gallery.
Weak: Side view of a cobalt blue ceramic mug with a wide loop handle.
Better: Top view of the cobalt blue mug showing its cream-colored interior and loop handle.
Why: It describes the interior a shopper can see from this angle.

Check the listing before naming a material or finish. Ceramic comes from the sample product specification above. An image alone can leave several plausible materials, especially when the surface is painted or glazed. Match the color to the variant pictured. If photos change when the shopper switches variants, check the alt text on the newly selected image too.

The same review applies to a Shopify gallery. Open the main image and the close-ups in order, and look for what changes from one to the next. If a close-up shows a texture, closure or feature that matters before purchase, describe it there. If one file appears on a category page and on a detail page, see whether the editor lets you use wording appropriate to each. On WordPress, see [how to add alt text to WooCommerce product images](/woocommerce-product-image-alt-text).

## Alt text for screenshots

Imagine explaining where to click while the reader looks at the page in their own editor. Name the control they should find and the panel it belongs to. In this mockup, the useful detail is the open Alternative text field inside Image settings. The menu chevron and the shape of the input box can be left out.

### A settings panel crop

Image: /alt-text-examples/image-settings.svg
Context: A mock editor screenshot in a tutorial about finding the alternative text field.
Weak: Editor screenshot
Better: Image settings panel with the Alternative text field open.
Why: It points the reader to the field used in the tutorial.

```html
<img src="/alt-text-examples/image-settings.svg" width="420" height="220" alt="Image settings panel with the Alternative text field open.">
```

In your instructions, say how to reach the state the screenshot shows. Open Image settings, then find the Alternative text field. The sample value shown in it is “Blue ceramic mug with a wide loop handle.” Someone using the tutorial can follow the step and read the example directly in the page text.

On an error screenshot, the words of the message can matter more than the position of the box. Put any error code or recovery step a reader needs in selectable text so they can copy it. In a series of screenshots, give each alt description the step or state that changes, such as the field opening or a saved value appearing. Review the instructions if an editor update moves or renames a control. A clear description of an old panel still sends readers to the old location.

## Alt text for images of text

If a graphic is the only place readers get a short message, put the words of that message in the alt text. A general description of a quote card might tell readers that the image has words. The actual sentence lets them read what the card says.

### A quote card shared on social media

Image: /alt-text-examples/quote-card.svg
Context: In an example social post where the quote appears only in the card.
Weak: Quote card about questions
Better: Leave room for better questions.
Why: It gives the reader the same words that appear on the card.

```html
<img src="/alt-text-examples/quote-card.svg" width="420" height="210" alt="Leave room for better questions.">
```

Read through the graphic in order before writing its alt text. A quote card may include who said it. An event graphic may give a date, place or registration detail in smaller type. Include the words a reader needs to get the full message. If the post already contains the entire message and the graphic adds no other information, an HTML image can use empty alt text so readers hear the message once.

For longer announcements, put the full wording in regular page text, where readers can select, resize or translate it. Then decide what the graphic contributes alongside it. If the whole graphic is a link, give that link a name that makes its destination clear, and keep any event details that people need before following the link in the surrounding text. Check that the text version stays current whenever someone swaps out the graphic.

## Alt text for decorative images and backgrounds

Imagine removing the image and reading the content that remains. Between sections, a divider can give a page a visual pause. The headings already signal where each section starts. In a photography tutorial, a picture used as a background may still demonstrate the technique the reader came to learn. The same test can help you identify which details belong in text.

### A decorative divider

Image: /alt-text-examples/flourish.svg
Context: Between two sections whose headings already mark the change of topic.
Weak: Gold divider
Better: alt=""
Why: The divider adds no information the reader needs.

```html
<img src="/alt-text-examples/flourish.svg" width="210" height="44" alt="">
```

Keep both quotes when you type an empty alt attribute. That marks an HTML image as one assistive technology can skip. Leaving the attribute out omits that instruction. If your editor has a “Mark as decorative” option, check the rendered image to confirm what markup it produced.

### A meaningful CSS background

Image: /mountain-landscape.jpg
Context: As a background image in a photography tutorial about composing reflections.
Weak: Scenic background
Better: Snow-striped peaks and evergreens reflected in a lake.
Why: Visible page text carries the detail that the CSS background cannot convey through an alt attribute.

A CSS background is set by the page's styling, so it has no HTML image element to give an `alt` attribute. When the background conveys something the reader needs, write that information in or beside the section. For a standalone image that calls for its own alternative, use an HTML image with appropriate alt text. If the background is only a texture behind a heading, the heading can do its job without a description of the texture.

## Alt text examples for SEO

Google uses alt text alongside page content and computer vision to understand images. On a farmers market guide, details such as carrots and tomatoes help describe the actual stall. Repeating the same shopping phrase in different orders gives the reader very little idea of what is there. Let the picture and the page lead you to the words.

### Produce at a farmers market

Image: /fresh-vegetables.jpg
Context: In a farmers market guide showing what a produce stall looks like.
Weak: Farmers market vegetables fresh vegetables buy vegetables local vegetable market produce deals
Better: Carrots and mixed-color tomatoes at a farmers market stall.
Why: Carrots and tomatoes tell readers what is on the stall and fit the market guide.

```html
<img src="/fresh-vegetables.jpg" width="2816" height="1536" alt="Carrots and mixed-color tomatoes at a farmers market stall.">
```

Mention a place, variety or product name when you can verify it and it helps someone understand the image. In a guide to a named market, the introduction can establish its location once. Individual image descriptions can then tell readers which stall, feature or scene is pictured. If several images have the same alt text, read them in sequence and see what is missing from each description.

Read the result aloud before you save it. An alternative should make sense as part of the page when someone hears it without the picture. Give surrounding text the job of explaining details such as opening hours, location or what to buy in season. Descriptive alt text gives search engines and readers context about the image itself. Search visibility depends on more than the wording in this field.

## Quick reference

Alt text by image type

| Image type | What the alt text should say | Example |
| --- | --- | --- |
| Photo | The subject and the detail that matters on this page | Snow-striped peaks and evergreens reflected in a calm lake. |
| Logo | The organization name or the destination of a linked logo | Mallowmere Studio home |
| Icon | The action if the icon names a control, or empty alt if text inside the same control already gives it a name | Search |
| Image button or link | What the button does or where the link goes | View cart |
| Chart or infographic | The main takeaway, with details in nearby text or a table | Repair bookings rose each month, from 48 in April to 76 in June. |
| Product photo | The product and the relevant details visible in that view | Side view of a cobalt blue ceramic mug with a wide loop handle. |
| Screenshot | The control, state or detail the reader needs to find | Image settings panel with the Alternative text field open. |
| Image of text | The words in the graphic when it is the only place they appear | Leave room for better questions. |
| Decorative image or CSS background | Empty alt for a decorative HTML image. Visible page text for meaningful CSS backgrounds. | `alt=""` for a decorative divider |
| Image for SEO | An accurate description with relevant terms used naturally | Carrots and mixed-color tomatoes at a farmers market stall. |

## FAQ

### What is a good example of alt text?

“Carrots and mixed-color tomatoes at a farmers market stall” is useful in a market guide because it tells readers what is visible and where the produce is displayed. A guide to market photography might describe the layout of the crates or the way the produce is arranged.

### How long should alt text be?

A short phrase or sentence often does the job. WCAG does not set a character limit for alt text. The Alt Text Pro checker flags alt text over 150 characters so you can review it. If a chart or infographic needs a longer explanation, keep the key point in the alt text and put the details on the page.

### What alt text should a logo have?

Use the company name when a standalone logo identifies the company. If it is the only content of a home link, use wording like “Mallowmere Studio home.” When visible text already identifies an unlinked logo, or names the same link, the redundant image can use empty alt.

### Do icons need alt text?

An icon that supplies the name of a button or link needs a text alternative that communicates the action or destination. For an HTML image icon that sits inside a control with a clear text label, use `alt=""`. A purely decorative image icon also uses empty alt.

### What is the alt text for a decorative image?

Use `alt=""` on a decorative HTML image. The attribute is present and its value is empty, which tells assistive technology it can skip the image. Check that it really is decorative in the context where you use it.

### Should alt text include keywords?

Use a phrase people search for when it also describes what the image shows and makes sense on the page. A description can mention the product type or subject in ordinary wording. Read the finished line as a sentence someone might hear, and remove repetitions that add no information.

## Check your page

[Check a page for missing or weak alt text](/alt-text-checker) with the free Alt Text Pro checker. Look at each result in context before deciding whether an empty value is intentional or a description needs an edit.

On WordPress, Alt Text Pro can [draft an image description in the media editor](/ai-alt-text-generator-for-wordpress) or [draft descriptions across a media library](/bulk-generate-alt-text-wordpress). Review each draft against the image and the page before saving it.

## Sources

- [W3C WAI Images Tutorial](https://www.w3.org/WAI/tutorials/images/)
- [W3C WAI alt decision tree](https://www.w3.org/WAI/tutorials/images/decision-tree/)
- [W3C WAI complex images tutorial](https://www.w3.org/WAI/tutorials/images/complex/)
- [WCAG 2.2 Success Criterion 1.1.1, Non-text Content](https://www.w3.org/TR/WCAG22/#non-text-content)
- [HTML Standard requirements for text alternatives](https://html.spec.whatwg.org/multipage/images.html#alt)
- [Google Search Central image SEO guidance](https://developers.google.com/search/docs/appearance/google-images#use-descriptive-alt-text)

---

## Quality editor notes

- Checked the how-to article, checker and WooCommerce copy against the manuscript. Clarified that the redundant icon label is inside the same control, that an image submit needs a nonempty label, and that the checker’s 150-character review flag is separate from WCAG. The FAQ answers are ready to use as the single source for visible copy and structured data.
- Compared the screenshot field and value, fictional wordmark, bar labels and values, and quote with the current SVG artwork. Matched every HTML snippet to its Better value and the intrinsic file dimensions. No planned artwork labels or numbers changed. The CSS background uses visible page text.
- Checked primary guidance on complex images, text alternatives, image submit controls and Google image SEO. The chart table stays navigable. Kept the illustrative examples clearly fictional where they involve news, retail reporting or invented data.
