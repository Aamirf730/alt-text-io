=== Alt Text Pro – AI Alt Text Generator ===
Contributors: aamirfaiz
Tags: alt text, ai alt text, image alt text, accessibility, image seo
Requires at least: 5.0
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.7.29
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Alt Text Pro is an AI alt text generator for WordPress. Add alt text to every blog image in bulk or on upload, for image SEO and accessibility.

== Description ==

**Alt Text Pro is an AI alt text generator for WordPress.** It looks at each image on your blog, writes a short, specific description of what it shows, and saves it as the image's alt text. Fix your whole media library in one bulk run, describe new photos as you upload them, and fill the empty alt text in posts you published years ago.

Alt text is what screen readers read aloud to people who can't see your photos, and it helps search engines like Google understand what your images show. Most of your images need it, but few bloggers have time to write it for hundreds of photos. Alt Text Pro writes it in seconds, and you decide what gets published.

**Free to start:** 150 credits when you sign up (they never expire), plus 15 free credits every month. One image uses one credit. No credit card needed.

### What Alt Text Pro does for your blog

* **Saves you hours.** No more typing a description for every photo in every post.
* **Helps your images get found.** Descriptive alt text helps search engines match your photos to what people search for, including in Google Images.
* **Makes your blog accessible.** Screen-reader users hear "Red fox standing in tall dune grass", not silence or a file name.
* **Fixes old posts without editing them.** Images with empty alt text inside your posts pick up their new alt text automatically.
* **Keeps you in control.** Alt text you wrote is never replaced unless you ask, and you can review, edit or undo anything.

### Real examples from Alt Text Pro

Alt text it wrote for photos on a travel and food blog:

* "Snow-capped mountain peaks glowing pink at sunrise, mirrored in a still lake ringed by pine forest."
* "Wooden crate of red and yellow heirloom tomatoes beside bunches of orange and purple carrots."
* "Red fox standing in tall dune grass, with the sea and a hazy sky behind it."

Specific, natural and written for people, not stuffed with keywords. AI can still miss details only you know, like the name of a dish or where a photo was taken, so check the images that matter most.

### Alt Text Pro features

**Fix your whole media library**

* Bulk generate alt text for every image that is missing it, up to 20,000 images per run.
* See how many credits and how much time a run needs before you start.
* Stop at any time, or let the run keep going in the background after you close the tab.
* Narrow a run by upload date, by post category, or to images uploaded to posts, pages or WooCommerce products.
* "Undo this run" restores the alt text your images had before, free of charge.

**Add alt text as you work**

* Turn on "Auto-generate on upload" and every new image gets alt text as soon as you add it.
* Generate alt text for one image from the Media Library, the media popup, or the Image block in the editor.
* Add alt text to every image in a post, featured image included, from your Posts and Pages lists.

**Fix images inside published posts**

* Images in your posts with empty alt text are shown with the alt text from your Media Library, without editing the post (WordPress 6.0 and later).
* Works with the block editor, the Classic Editor, Elementor and Divi.
* Want it saved in the post itself? "Copy alt text into post" does that without using credits.

**Alt text that fits your blog**

* Writes in your site's language, or in any of 40 languages you choose. Works with WPML and Polylang.
* Uses your post titles, the image's file name and a short description of your blog to write more relevant alt text.
* Optional review step: approve, edit or reject suggested alt text before it goes live.
* Mark decorative images, such as dividers, so they keep an empty alt on purpose.
* Optionally copy new alt text into image titles, captions and descriptions, without replacing anything you wrote.

**Works with your site**

* WooCommerce product and gallery images.
* JPEG, PNG, GIF, WebP and AVIF images, plus HEIC when your server supports it.
* Images offloaded to S3 or a CDN.
* Saves alt text in the standard WordPress alt text field, where your theme and WooCommerce already look for it. It stays there if you stop using the plugin.
* Keeps a history of every alt text it writes, with the credits used and CSV export.

### Get started in minutes

1. Install and activate Alt Text Pro.
2. Click **Connect Account** and sign in, or create your free account. The plugin saves your API key for you.
3. Open any image in the Media Library and click **Generate Alt-Text** to see the result.
4. Go to **Alt Text Pro > Bulk Process** to fix every image that is missing alt text.
5. Turn on **Auto-generate on upload** in the plugin's Settings so new images are covered too.

### Pricing

The plugin is free. Writing alt text uses credits from your Alt Text Pro account, one credit per image:

* **Free:** 150 credits when you sign up, plus 15 credits every month.
* **Paid plans:** from $5 a month for 500 credits. Cancel anytime.
* **Credit packs:** one-time top-ups that never expire, from $12 for 1,000 credits.

Compare plans on the [pricing page](https://www.alt-text.pro/#pricing).

### Help and support

* Read the [setup guide and docs](https://www.alt-text.pro/docs).
* Ask in the [support forum](https://wordpress.org/support/plugin/alt-text-pro/) or [contact us](https://www.alt-text.pro/contact).
* Does Alt Text Pro save you time? A [review](https://wordpress.org/support/plugin/alt-text-pro/reviews/#new-post) helps other bloggers find it.

== External services ==

Alt Text Pro needs an Alt Text Pro account. To write alt text, the plugin connects to the Alt Text Pro service at [www.alt-text.pro](https://www.alt-text.pro), which is run by the makers of this plugin. Nothing is sent until you connect an account.

* **Writing alt text** (one image, a post, a bulk run, or on upload): the plugin sends the image (resized if it is large), the alt text language, and any context you add, such as your Blog Context. Unless you turn off "Send image context", it also sends the image's file name and the titles of the posts that use it. Alt Text Pro uses Google Gemini to write the description.
* **Checking your account:** your API key is checked and your credits are loaded when you open the plugin's pages, start a bulk run or save a key. While administrators use the Media Library or the plugin's pages, the credit balance is also refreshed in the background, at most every 6 hours, for the low-credit notice.
* **Every request** includes your API key, the plugin version, this site's address and its WordPress language, so your account can list the sites that use your key. When you disconnect the account or uninstall the plugin, the site's address is sent once more so the site is no longer listed.
* **Connecting your account:** "Connect Account" opens https://www.alt-text.pro/connect with the address of this site's settings page, so your API key can be returned to WordPress after you sign in.

WordPress also sends its standard user agent, which includes your site address, with these requests.

Read the Alt Text Pro [Terms of Service](https://www.alt-text.pro/terms) and [Privacy Policy](https://www.alt-text.pro/privacy).

== Installation ==

1. In your WordPress admin, go to **Plugins > Add New Plugin** and search for **Alt Text Pro**.
2. Click **Install Now**, then **Activate**.
3. Open **Alt Text Pro** in the admin menu. In the setup window, click **Connect Account**, then sign in or create a free account. The plugin saves your API key for you.
4. Open any image in the Media Library and click **Generate Alt-Text** to check the result, then **Apply Alt-Text** to save it.
5. Go to **Alt Text Pro > Bulk Process** to fix the images that are missing alt text.
6. Optional: turn on **Auto-generate on upload** under **Alt Text Pro > Settings**.

If your browser blocks the setup window, copy the API key from your Alt Text Pro dashboard, paste it under **Alt Text Pro > Settings**, then click **Save Settings**.

To install from a ZIP file instead, go to **Plugins > Add New Plugin > Upload Plugin**, choose the file, click **Install Now** and activate the plugin.

== Frequently Asked Questions ==

= What is Alt Text Pro? =

Alt Text Pro is an AI alt text generator for WordPress. It describes the images in your Media Library and posts in plain language and saves each description as the image's alt text. You can use it on one image, one post, your whole media library, or every new upload.

= Is Alt Text Pro free? =

The plugin is free, and so is the starter allowance: 150 credits when you sign up, which never expire, plus 15 credits every month, with no credit card needed. Each image uses one credit. When you need more, paid plans start at $5 a month for 500 credits, and one-time credit packs start at $12 for 1,000 credits.

= Do I need an Alt Text Pro account? =

Yes. The AI runs on the Alt Text Pro service, so the plugin needs a free account to connect to. Click **Connect Account** in the plugin, sign in or sign up, and the plugin saves your API key for you. If the popup is blocked, you can paste the key under **Alt Text Pro > Settings**.

= Why does my blog need alt text? =

Alt text is the short description stored in an image's alt attribute. Screen readers read it aloud to visitors who can't see the image, and search engines use it to understand what the image shows. Missing alt text is also a common issue in SEO and accessibility audits.

= Will Alt Text Pro help my SEO? =

Alt text is one of the ways search engines understand images, so describing every image clearly can help your photos appear in image search, and it helps clear the "images missing alt text" warnings that site audits report. No plugin can promise higher rankings, but it closes a common gap in image SEO.

= Will it overwrite alt text I already wrote? =

No. The plugin only fills images that are missing alt text, unless you turn on "Overwrite existing", and a bulk run asks you to confirm before it replaces anything. Alt text you wrote inside a post is never replaced. If a bulk run replaced something you liked, "Undo this run" puts it back without using credits.

= Can I review alt text before it is published? =

Yes. When you generate alt text for a single image, you see a draft first and choose whether to apply it. For bulk runs, uploads and the Posts list, turn on "Review alt text before it goes live" in Settings: suggestions then wait on a Review page where you approve, edit or reject them.

= How accurate is the alt text? =

It is usually a strong first draft that describes what is actually in the photo. The AI cannot know things that aren't visible, such as a person's name, a recipe's name or where a photo was taken, so add those details to your most important images. Adding a short Blog Context in Settings makes descriptions fit your blog better.

= Can it fix images in posts I already published? =

Yes, in three ways. With "Fill empty alt text in post content" on (the default, on WordPress 6.0 and later), images in your posts with empty alt text are shown with the alt text from your Media Library, without editing the posts. The Posts and Pages lists show how many images in each post still need alt text, with a button to add it. And "Copy alt text into post" saves Media Library alt text into the post itself, without using credits.

= Does it work with Elementor, Divi and other page builders? =

Mostly. Elementor's image widgets use the alt text from your Media Library, so they pick up the alt text the plugin saves. With "Fill empty alt text in post content" on, empty alt text is also filled when pages are shown for Divi layouts, Elementor pages, Elementor and Divi Theme Builder templates, and Elementor popups. Alt text you typed in the builder is never replaced. Not covered: images added by URL, CSS background images, and builders that skip WordPress's content filters, such as Bricks and Oxygen.

= Does it work with WooCommerce? =

Yes. Product and gallery images are stored in the Media Library, so they can be described one at a time or in a bulk run, and you can limit a run to images uploaded to products. The AI cannot know your exact product names, so review the descriptions of your most important products.

= Which languages does Alt Text Pro support? =

By default, alt text is written in your site's language, or in English if that language isn't supported yet. To use a different one, choose from 40 languages under **Alt Text Pro > Settings > Alt text language**. On WPML and Polylang sites, each image is described in its own language (with Polylang, turn on "Media" under **Languages > Settings**). Each translated copy of an image is a separate Media Library item, so it uses its own credit.

= Which image formats are supported? =

JPEG, PNG, GIF, WebP and AVIF, plus HEIC when your server's image editor can read it. Large photos are resized before they are sent. SVG and other vector files are skipped.

= How do I keep an image's alt text empty on purpose? =

For decorative images, such as dividers or background patterns, open the image in the Media Library and tick "Decorative image (empty alt on purpose)". If the image already has alt text, clear that field too. The plugin then skips the image everywhere, never uses a credit on it, and keeps its empty alt text in your posts.

= Can it also fill the image title, caption or description? =

Yes, if you want it to. Under **Alt Text Pro > Settings > Image title, caption and description**, choose which fields to fill (all are off by default). The title is only replaced while it is still the file name, such as "IMG_1234", and the caption and description only while they are empty.

= What happens when I run out of credits? =

Generating stops until you add credits or upgrade, and all the alt text already saved stays on your site. When 10 or fewer credits are left, administrators see a notice in the Media Library and on the Alt Text Pro pages.

= What happens to my alt text if I uninstall Alt Text Pro? =

Alt text saved to your Media Library stays, because it is ordinary WordPress content. Uninstalling removes the plugin's settings and generation history. Alt text that is only filled in when a post is shown (see "Fill empty alt text in post content") stops appearing, so use "Copy alt text into post" first if you want it saved in your posts.

= Is my data safe? =

Nothing is sent until you connect an account. After that, images are sent over an encrypted connection to the Alt Text Pro service to write their alt text, and your API key is stored encrypted in WordPress. The plugin sends no marketing or tracking events from your admin. The External services section of the plugin description lists exactly what is sent and when.

= Does Alt Text Pro send emails? =

Only one, and it comes from your own site: when a bulk run finishes or stops, WordPress emails a short summary to the person who started it. Turn it off under **Alt Text Pro > Settings > Email me when a bulk run finishes**.

= Does it guarantee accessibility compliance? =

No plugin can do that on its own. Alt Text Pro fills in missing image descriptions quickly, but you should still review important images for accuracy and context.

= Can I cancel my subscription anytime? =

Yes. Cancel from your Alt Text Pro dashboard and your plan stays active until the end of the billing period. Signup credits and credit packs never expire.

== Screenshots ==

1. The Alt Text Pro dashboard: your credits, the alt text written on this site, and how many images still need it.
2. Settings: connect your account, turn on Auto-generate on upload, and describe your blog for more relevant alt text.
3. Bulk Process writes alt text for every image that is missing it, with live progress and a Stop button.
4. Generate alt text for one image, review the draft, then apply it.
5. Usage & Logs: every alt text written, the credits used, search and CSV export.
6. The Alt Text Pro dashboard on a phone.

== Changelog ==
= 1.7.29 =
* Fix: an image is billed once when a bulk run, the Generate buttons or the Posts list reach it while its automatic upload generation is running. The image is skipped or the button says it is already being described.
* Fix: a timeout, rate limit or service error during a bulk run or a Generate button no longer cancels the upload's own automatic alt text; it runs again a few minutes later.
* Fix: a bulk run cancelled while an image is being described stays cancelled, even on sites whose object cache drops the run's saved state.
* Fix: photos whose camera orientation says "rotate" are sent upright, so they are not described sideways.
* Fix: images uploaded just before the plugin is deactivated and activated again still get their automatic alt text.

= 1.7.28 =
* New: "Fill empty alt text in post content" (on by default). On WordPress 6.0 and later, images inside posts whose alt is empty or missing are shown with their Media Library alt text. Alt text written in the post is never overwritten.
* New: the Posts list counts images in the post content that still have empty alt text and offers "Copy alt text into post" (no credits) instead of "All done". WooCommerce product gallery images are included.
* New: "Alt text language" setting. Alt text follows the site language by default, or a language you choose.
* New: "Buy credits or upgrade" links on the dashboard, the Bulk page and every out-of-credits message. Bulk "Start" is disabled at 0 credits, with an explanation.
* New: a Generate button in the media modal and the Media Library grid.
* New: a bulk run survives a page reload. The Bulk page shows the running run so its owner can resume it and any administrator can stop it, and the browser warns before leaving a running run.
* New: the Bulk page compares the images missing alt text with your credits and says how many more credits you need, or that you have enough.
* New: the plugin dashboard and Settings show which Alt Text Pro account the site is connected to.
* New: "Connect a different account" in Settings switches the site to another account without disconnecting first.
* New: the plugin dashboard has a Connect Account button when the site is not connected yet.
* New: the plugin dashboard warns when a renewal payment failed, with a link to update the card.
* New: when the saved API key stops working (rotated key or deleted account), Settings says so and offers Reconnect account.
* New: "Fill empty alt text in post content" also covers Elementor and Divi content shown outside the post content, such as Theme Builder headers, footers, templates and Elementor popups. Alt text typed in the builder is never replaced.
* New: optional settings to also fill the image title (while it is still the file name), caption and description (while empty) with new alt text. All off by default. Text someone wrote is never replaced.
* New: on WPML and Polylang sites, each image is described in its own language when Alt text language is "Same as the site language".
* New: "Decorative image (empty alt on purpose)" checkbox on each image. Decorative images are never described or billed, keep alt="" in posts, and are not counted as missing alt text.
* New: a dismissible "Only N credits left" or "You are out of credits" notice on the Media Library screens and Alt Text Pro pages, using the last known balance, so it adds no request to the service on page loads.
* New: the connect window checks first that this site can store the API key (OpenSSL and a unique AUTH_KEY), and explains what to fix before you sign in.
* New: "Selected" mode lets you search and page through all images, including ones that already have alt text, to regenerate them.
* New: "Email me when a bulk run finishes" setting (on by default). The email is now proper plain text.
* New: the "Send image context" setting is shown on the Settings page. The unused batch-size field was removed.
* New: "Generate alt text" in the Media Library list view. Each image row has a link that generates in place and shows the result there, and the bulk action "Generate alt text (Alt Text Pro)" opens the Bulk page with the chosen images selected. Existing alt text is only replaced when "Overwrite existing" is on.
* New: a "Generate alt text" button for the image block in the block editor sidebar. It fills the block's alternative text and also saves it to the Media Library when the image has none there.
* New: the Logs show whether generated text was saved to the image or is a draft that was never applied, and Generate says that a draft uses 1 credit even if you do not apply it.
* Fix: generate-on-upload no longer slows uploads, imports or WooCommerce CSV imports. Generation runs right after the upload in the background and still uses one credit per image. It never replaces alt text written after the upload, and an image that a bulk run or a Generate button already described is not billed again.
* Fix: failed automatic generation (for example no credits or a rejected key) is shown as an admin notice.
* Fix: bulk runs stop on an invalid key, a suspended or deleted account, or a service that keeps failing, instead of failing every remaining image.
* Fix: a temporary service outage no longer looks like an invalid API key. The key is kept, saving a key still works, and bulk runs wait and retry, honouring Retry-After.
* Fix: a suspended Alt Text Pro account is explained clearly.
* Fix: SVG and other non-raster files no longer show Generate and are not counted or queued by bulk runs. On older WordPress versions, WebP (before 5.8), AVIF (before 6.5) and HEIC (before 6.7) images are not counted either, because WordPress cannot process them there.
* Fix: a bulk run that was stopping when you left the page can be stopped from the Bulk page instead of being resumed.
* Fix: Posts list generation uses your blog context.
* Fix: the Logs search covers the whole history, not only the visible page.
* Fix: "I'll do this later" in the setup window is remembered.
* Fix: the "configure your API key" notice on other admin pages has a "Don't show again" link that is remembered.
* Fix: after generating alt text for one image, the credits left are shown under the draft.
* Fix: a finished, stopped or cancelled bulk run shows a Results card with the totals and the images that failed, linked to each image.
* Fix: Disconnect and uninstall tell Alt Text Pro this site stopped using the key. The key itself stays valid for your other sites. Uninstall does not wait for the answer, so large multisite networks uninstall quickly.
* Fix: permission errors in admin requests return JSON, and most interface text can now be translated.
* Fix: "Invalid API key" and deleted-account messages link to Settings, where you can reconnect, when generating one image, a post's images or a bulk run.
* New: before you start a bulk run, the Bulk page says how many credits it will use and how long it will take. If you do not have enough credits for every image, it says where the run will stop and asks you to confirm.
* New: a bulk run interrupted by closing the tab stays paused and resumable for 7 days ("Paused: X of Y done"). It still keeps the site's one run slot, and any administrator can stop it.
* New: "Keep going in the background" lets a bulk run finish after you close the tab, a few images at a time through WP-Cron. It stops on no credits, a rejected key or Stop, and sends the "bulk run finished" email. WP-Cron needs site visits or a server cron job to run.
* Fix: a background bulk run that WP-Cron stopped moving is queued again when the Bulk page or another admin page loads, and the Bulk page shows it as paused with "Run in this tab instead".
* New: failed and skipped bulk images are saved with the reason. "Recent runs" on the Bulk page lists them after a reload, and they appear in Logs with a result filter.
* New: the Bulk page asks for confirmation, with the number of images, before a run replaces existing alt text, including in "Selected" mode.
* New: "Undo this run" on the Bulk page puts back the alt text images had before a run, only where the alt text is still what the run wrote, and reports how many were restored or kept. No credits are used.
* New: narrow a bulk run by upload date, by what the image is attached to (posts, pages or WooCommerce products) and by the category of that post. Counts, the estimate, the "Selected" list and the run all follow the filters.
* New: the Logs CSV export includes failed and skipped images with their result and reason.
* New: "Review alt text before it goes live" setting (off by default). Alt text from bulk runs, generate-on-upload and the Posts list waits on a new Review page, where you approve it (as written or edited), reject it, or approve all. Images waiting for review are not generated or billed again.
* Fix: images waiting on the Review page are left out when you send a Media Library selection to the Bulk page, with a note saying so.
* Compatibility: tested with WordPress 7.1. On WordPress 7, the image block's Alt Text Pro panel sits on the Content tab next to Alternative text.

= 1.7.27 =
* Readme: clearer plugin name, short description, tags and feature list.
* New: after 50 alt text descriptions on a site, plugin pages ask once for a WordPress.org review. Choose "Maybe later" (asks again in 30 days) or "Don't ask again". Shown only to administrators, only on Alt Text Pro pages.

= 1.7.26 =
* Design: yellow and white interface with consistent buttons and aligned icons.
* Fix: the settings page shows its own results again ("Settings saved.", invalid or rejected API key, encryption problems); plugin pages hid them.
* Fix: a finished bulk run logs its completion summary once.
* Fix: generating alt text for a post no longer strips backslashes from the post content (block data and code samples stay intact), and posts are only re-saved when an image's alt text actually changes.
* Fix: post-level generation stops when credits run out instead of calling the service for every remaining image.
* Fix: only one bulk run can be active on a site at a time, so two tabs or two admins can no longer pay twice for the same image. An abandoned run stops blocking after 15 minutes.
* Fix: bulk runs are no longer limited to the newest 1,000 images; one run now covers up to 20,000 images, and the Bulk page counts the whole library quickly.
* Fix: large photos are downscaled before upload, and formats such as HEIC, BMP and TIFF are converted when the server's image editor supports them, so they no longer fail as "too large".
* Fix: the dashboard shows an error with "Try again" and "Reconnect account" when your account cannot be loaded, instead of placeholder credits, and loads with one request.
* Fix: the dashboard shows plan names and credits that match your Alt Text Pro account, including bonus and credit-pack credits.
* Fix: the settings page keeps your working API key when Alt Text Pro rejects a newly pasted one.
* Fix: generating alt text for a post only fills images whose alt is empty or missing in the post; alt text you wrote in the post is never replaced.
* Fix: posts with many images are processed a few images per request with progress shown in the posts list, so large posts no longer time out. Images generated before an interruption are still written to the post.
* Fix: multisite networks get the logs table on every site, including sites created later, and uninstalling cleans every site.
* New: a "Disconnect account" button on the Settings page removes the saved API key. Resetting settings now removes the key too.
* Fix: long blog context in non-Latin scripts is shortened instead of being erased, and the field is limited to 500 characters.
* Fix: out-of-credits messages mention credit packs as well as plan upgrades.
* Fix: "Used in" context only matches posts that use the exact image (image 12 no longer matches image 120), and context is sent as plain text.
* Fix: images offloaded to S3 or a CDN are downloaded from their public URL when the local file is missing.
* Fix: the Logs page Export button downloads a CSV of the history (matching your search), and an empty log no longer shows PHP notices.
* Fix: the post-activation redirect only runs for administrators on a normal page load, never during AJAX, REST or cron requests.
* Fix: a deleted Alt Text Pro account now asks you to reconnect instead of suggesting a plugin update, and bulk runs wait and retry when the service is temporarily busy (503).
* Fix: saved state of finished or abandoned bulk runs is cleaned up daily; an active run is never touched.
* Fix: "Connect Account" returns the key to the admin address you are actually using, so www/non-www or proxy differences no longer drop the connection.
* Docs: list the external service the plugin uses and what it sends.

= 1.7.25 =
* Fix automatic account connection by opening each attempt in a fresh popup and avoiding stale opener state.

= 1.7.24 =
* Fix: honor the context-enabled setting during post-level generation and restore the authenticated context-suggestions request.
* Fix: sanitize generated alt text, align dashboard statistics with the WordPress site timezone, and safely handle missing attachment paths.
* Maintenance: remove dead admin bindings, load the translation file, and remove durable bulk/API-key state during uninstall.

= 1.7.23 =
* Security: remove the duplicate settings-page connection handler so one click sends one validation request.
* Security: render bulk activity filenames and errors as text instead of interpolating them into HTML.

= 1.7.22 =
* Reliability: persist active bulk-process state in the options table so transient eviction can recover a running job.

= 1.7.21 =
* Maintenance: remove the obsolete bulk-processing AJAX stub and hook; the batch processor remains active through its current actions.

= 1.7.20 =
* Fix: report image attachments excluded by per-media permissions with skipped IDs and a visible warning instead of presenting incomplete post generation as success.

= 1.7.19 =
* Fix: Post-level alt-text regeneration now updates both Gutenberg block attributes and rendered image markup, preventing block validation errors and editor reverts.

= 1.7.18 =
* Security: Require edit permission for every image and post before generating or saving alt text.
* Security: Bind opaque bulk jobs to the user who created them and reject duplicate batch execution.
* Privacy: Remove detailed API, file-path, content, and process diagnostics from WordPress debug logs.
* Fix: Prevent automatic upload generation from scheduling a second billable request after a successful run.

= 1.7.17 =
* Security: Require an exact origin, popup source, and cryptographic state for automatic connection callbacks.
* Security: Store new API keys with authenticated encryption and never fall back to plain-text storage.
* Fix: Align the batch-size field with the enforced 1-10 range and harden external dashboard links.

= 1.7.16 =
* Pricing: Added Agency plan support and aligned the free allowance copy with 150 signup credits plus 15 monthly credits.

= 1.7.15 =
* Branding: align the plugin UI, logo, and WordPress.org artwork with the white, yellow, and black brand palette.

= 1.7.14 =
* UX: Restored the polished shared connection modal with consistent icons, balanced cards, card-local actions, and responsive layouts that do not compress controls.
* UX: Improved automatic-connection loading, popup-blocked, success, and error feedback without changing the connection flow.
* Fix: Preserved the default context-aware generation setting during partial connection saves.

= 1.7.13 =
* Fix: Validated API keys now persist correctly when WordPress applies the plugin settings sanitizer during automatic or manual connection.

= 1.7.12 =
* UX: Distinguish confirmed popup connections from legacy key delivery and normalize the connect-handler formatting.

= 1.7.11 =
* Security/UX: Confirm that the WordPress plugin saved the API key before reporting a successful popup connection, and provide a manual copy fallback when the popup opener is unavailable.

= 1.7.10 =
* Fix: Preserve bulk-process state on sites using Redis or another persistent object cache so each batch can continue normally.

= 1.7.9 =
* Reliability: Bundle the oversized-image recovery path so failed image requests are recorded and skipped while the remaining bulk queue continues.
* UX: Keep stray bulk-processing counters out of the shared plugin header.

= 1.7.8 =
* Reliability: Show a short "Image too large to process." message for oversized image requests and surface failed bulk requests instead of leaving the run stuck on "Generating."
* Reliability: Treat oversized images as per-image errors, skip them without retrying, and continue processing the remaining images.

= 1.7.7 =
* Branding: Updated the public plugin display name to "Alt Text Pro" while preserving the existing plugin slug and text domain.

= 1.7.6 =
* Documentation: Updated the plugin readme with the current bulk-processing behavior, credit-accurate stopping guidance, live progress details, and warning notifications.

= 1.7.5 =
* UX: Bulk-processing warnings now appear as compact, dismissible bottom-right notifications only when a process actually needs attention.

= 1.7.4 =
* UX: Removed the redundant total, missing-alt-text, and optimized summary cards from the bulk-generation page.

= 1.7.3 =
* UX: Redesigned the live bulk-processing view with the current task, overall progress, generated/error/remaining totals, activity feed, and clear stop-state information.

= 1.7.2 =
* Fix: Stopping a bulk process now waits for any already-running image to settle and includes a charged result in the final successful count.
* UX: The stop action clearly states that it stops after the current image, and no later image is scheduled.

= 1.7.1 =
* Performance: Bulk processing now starts the next image shortly after a successful generation instead of waiting a fixed 15 seconds.
* Reliability: Bulk processing remains one image at a time for safe cancellation and credit accounting, and honors the AI provider's retry window when rate-limited.

= 1.7.0 =
* UX: Redesigned the account onboarding into a compact, branded automatic/manual connection flow.
* UX: Improved onboarding button alignment and removed unnecessary icon clutter.
* Fix: Email-verification and automatic account connections now retain the validated encrypted API key when WordPress saves plugin settings.

= 1.6.0 =
* UX: Reduced and softened the credits allowance text so the remaining number stays visually primary.

= 1.5.9 =
* UX: Simplified the WordPress dashboard credits card to show a compact remaining-versus-allowance value.
* UX: Removed the duplicate this-month generated line from the WordPress dashboard generated card.
* Admin: Added last-seen WordPress plugin version visibility to the SaaS admin dashboard and lifecycle view.

= 1.5.8 =
* Fix: Annual subscriptions now display monthly credits remaining instead of the hidden annual balance.
* Fix: Bulk and single-image generation now use monthly allowance remaining for subscription plans.
* Fix: Current-cycle usage is calculated from usage logs since the last credit renewal.

= 1.5.7 =
* UX: Clarified that credit usage is account-level for the billing cycle.
* UX: Clarified that generated stats are local to the current WordPress site.

= 1.5.6 =
* UX: Dashboard generated stats now show lifetime generations as the main number.
* UX: Added a secondary this-month generation count below the lifetime total.

= 1.5.5 =
* UX: Removed the internal bulk queue count from progress messaging to avoid confusing it with billable processing.
* UX: Bulk progress now focuses on the number of images that can run with available plan credits.

= 1.5.4 =
* Fix: Bulk progress now uses the remaining plan credits for the current cycle instead of the full queued image count.
* Fix: Bulk processing stops at that same plan-credit limit so the visible progress target matches actual processing.

= 1.5.3 =
* UX: Corrected dashboard credit labels for annual plans with rollover balances.
* UX: Dashboard now separates available credits from monthly allowance to avoid misleading "this month" totals.
* Fix: Usage API now returns billing cycle, monthly allowance, and total processed data for consistent dashboard stats.

= 1.5.2 =
* UX: Clarified annual-plan bulk credit messaging so available balance and monthly allowance are not confused.
* UX: Bulk progress now shows the credit-limited processable total instead of implying the full queued cap can run immediately.

= 1.5.1 =
* Compatibility: Updated "Tested up to" metadata for current WordPress release.
* Compliance: Removed unexpected root markdown file from the production plugin package.
* Compliance: Added missing translators comments and tightened admin/settings sanitization.

= 1.5.0 =
* Fix: Bulk processing now respects AI provider rate limits and retries the same image instead of marking the remaining queue as failed.
* Fix: API quota responses now show a clear temporary rate-limit message instead of an empty or blocked response warning.

= 1.4.99 =
* Privacy: Removed non-essential WordPress admin marketing event tracking.
* Privacy: The plugin no longer sends connect or bulk-processing funnel events from wp-admin.

= 1.4.98 =
* Growth: WordPress plugin funnel events now include the validated Alt Text Pro account identity after connection.
* Growth: Plugin-originated connect and bulk-processing events can now join lifecycle email automation when an account is connected.

= 1.4.97 =
* Fix: Bulk cancellation now processes one billable image per request so the visible success count and credits used stay aligned.
* Fix: Cancelled bulk jobs can no longer be overwritten back to running by an already-open batch request.
* Fix: The browser now waits before scheduling the next billable bulk request and clears that scheduled request immediately on cancel.

= 1.4.96 =
* Fix: Prevent duplicate admin JavaScript initialization that could send two generation requests from one click.
* Fix: Bulk processing now creates a cancellable process before starting billable image batches.
* Fix: Bulk jobs now mark themselves completed after the final batch instead of continuing to poll.

= 1.4.95 =
* Growth: Added privacy-conscious funnel events for connect and bulk-processing automation.
* Docs: Updated WordPress.org setup and pricing copy to match current Lite, Standard, Pro, and pay-as-you-go plans.

= 1.4.94 =
* Brand refresh: Plugin admin colors now align with the Alt Text Pro logo palette.

= 1.4.93 =
* Security: Saved API keys are no longer exposed in admin HTML, browser logs, or settings sanitization logs.
* Fix: Release packaging now excludes standalone test PHP files and reduces production API response logging.

= 1.4.92 =
* Fix: /connect now restores callback state after OAuth and always keeps a redirect fallback for WordPress.
* Fix: API key onboarding now verifies the key can be read back after save before reporting success.

= 1.4.91 =
* Fix: Decrypt API key before use in API client (resolved "Invalid Key" after setup).
* Fix: Documentation cleanup and non-ASCII character removal.

= 1.4.90 =
* Fix: Improved credit balance display logic in dashboard.
* Fix: Performance optimizations for media library integration.

= 1.4.89 =
* Added: Better error handling for API connection timeouts.

= 1.4.85 =
* Fix: Onboarding modal now appears on Dashboard page for first-time users.
* Fix: Bulletproof admin notice suppression on plugin pages (PHP + CSS + JS).


= 1.4.83 =
* Fix: Onboarding modal now auto-opens on first install when no API key is set.
* Fix: Ensured admin interface initialization when DOM is ready.

= 1.4.82 =
* Fix: Suppress global WordPress admin notices from cluttering the plugin UI.
* Added: Dedicated notices container for redirected admin messages.

= 1.4.81 =
* Fix: Resolved critical syntax errors in PHP and JavaScript modules.

= 1.4.80 =
* Added: Seamless "Connect to Alt Text Pro" button for easier account linking.
* Added: New `/connect` onboarding flow.

= 1.4.79 =
* Fix: Alt text for content images now updates the post HTML, not just attachment metadata.
* Content images in the block editor will now correctly show generated alt text.

= 1.4.78 =
* Fixed AJAX handler argument mismatch (passing attachment ID instead of URL).
* Corrected JavaScript variable mismatch in posts list view.

= 1.4.77 =
* New: Per-post "Add Alt Text" button in the Posts & Pages list tables
* New: Generate alt-text for all images in a specific post with one click
* New: "Alt Text" column shows image status (missing count, all done, no images)
* Automatically finds images in post content (wp-image classes, data attributes) and featured image
* Skips images that already have alt-text to save credits

= 1.4.73 =
* Fix: "Overwrite Existing" option visibility logic in bulk processor.
* Fix: "Process selected images" error and improved selection handling.
* Add: Selection count display to bulk processing UI.

= 1.4.72 =
* Fix: Prevent cancellation UI from disappearing immediately.
* UI: Improved result summary accuracy on cancellation.

= 1.4.71 =
* UI: Show result summary on cancellation instead of hiding everything.
* UI: Improved cancellation status visibility.

= 1.4.70 =
* UI: Hide progress bar immediately when "Cancel" is clicked.
* UI: Improved UI reset logic for better professional feel.

= 1.4.69 =
* Bug Fix: Refactored bulk processor to be entirely browser-driven.
* Security: Removed WordPress Cron dependency for bulk processing to ensure images are only processed while the dashboard is open.
* Improvement: Fixed "Initialization" stall by aligning frontend and backend data keys.

= 1.4.68 =
* Fix: Resolved "stuck" initialization in bulk processor by fixing data key mismatches between PHP and JavaScript.
* Fix: Added frontend-triggered batching as a backup for WordPress cron.
* Fix: Corrected cron hook registration to support multiple arguments.
* Fix: Synchronized status strings between server and client.

= 1.4.67 =
* Fixed bug where plugin settings page would break for new installations
* Added missing default values for blog_context and show_context_field settings

= 1.4.59 =
* Added Context Awareness feature - blog-wide context for improved alt-text generation
* New "Context Settings" in settings page with blog context textarea
* Added "Show Context Field" toggle to control per-image context visibility
* Fixed short description length for WordPress.org compliance

= 1.4.58 =
* Improved onboarding modal design - removed hero section and moved key icon inline with title
* Fixed modal positioning to prevent cutting at top of screen
* Reduced modal padding to eliminate scrolling
* Enhanced modal centering for better user experience

= 1.4.57 =
* Fixed modal positioning issue where form was cutting at the top
* Added automatic scroll to top when onboarding modal opens
* Improved modal container CSS for better centering
* Enhanced modal content overflow handling

= 1.4.56 =
* Moved bulk batch size setting to Settings page only
* Removed batch size input from bulk process page
* Set default batch size to 2 images per batch
* Updated JavaScript to read batch size from settings

= 1.4.55 =
* Fixed JavaScript syntax errors in bulk processing script
* Removed escaped quotes that were causing syntax errors
* Fixed line break issues in JavaScript strings
* Improved code formatting and readability

= 1.4.54 =
* Fixed additional JavaScript syntax errors
* Corrected quote escaping in HTML strings within JavaScript
* Improved error handling and debugging

= 1.4.53 =
* Reformatted minified JavaScript code that was causing syntax errors
* Fixed cancelProcessing, sendCancelRequest, resetUI, and showError functions
* Improved code structure and readability

= 1.4.52 =
* Added fallback script output for bulk processing
* Enhanced debugging with comprehensive console logging
* Fixed JavaScript WP_DEBUG references (PHP constant used in JS)
* Added inline onclick handlers as fallback for button clicks

= 1.4.51 =
* Added extensive debugging to diagnose bulk processing button issues
* Enhanced console logging throughout bulk processing flow
* Added try-catch blocks for error handling
* Improved error reporting

= 1.4.50 =
* Fixed JavaScript errors where WP_DEBUG was referenced incorrectly
* Removed all WP_DEBUG checks from JavaScript code
* Enhanced debugging output

= 1.4.49 =
* Added comprehensive debugging for bulk processing button
* Enhanced console logging for initialization and event binding
* Added PHP error logging for script loading

= 1.4.48 =
* Changed event binding to use namespaced events
* Added stopImmediatePropagation to prevent event conflicts
* Improved button handler reliability

= 1.4.47 =
* Changed to document-level event delegation for better reliability
* Added namespaced events to prevent conflicts
* Improved event handler attachment

= 1.4.46 =
* Removed conflicting bulk processing implementation from admin.js
* Consolidated to single inline script implementation
* Fixed status badge updates

= 1.4.45 =
* Fixed status badge updates in fallback bulk processing
* Added status updates in startBulkStatusPolling
* Enhanced status badge logic

= 1.4.44 =
* Added safeguard to set status to "Processing..." when polling starts
* Improved status badge update logic

= 1.4.43 =
* Simplified status badge update logic
* Fixed status badge to show "Processing..." for all non-terminal states
* Improved status display accuracy

= 1.4.42 =
* Enhanced cancel functionality with pendingCancel flag
* Improved early cancellation handling
* Added sendCancelRequest function for explicit cancel requests
* Fixed status updates during cancellation

= 1.4.41 =
* Fixed cancel button functionality
* Added support for canceling before processId is set
* Improved cancel request handling
* Enhanced UI updates during cancellation

= 1.4.40 =
* Improved bulk processing status updates
* Enhanced status badge display logic
* Fixed status polling interval

= 1.4.39 =
* Fixed status badge not updating during processing
* Improved status update logic
* Enhanced progress tracking

= 1.4.38 =
* Fixed bulk processing status display
* Improved status badge updates
* Enhanced error handling

= 1.4.37 =
* Fixed bulk processing completion detection
* Improved status polling
* Enhanced notification display

= 1.4.36 =
* Fixed bulk processing status updates
* Improved progress tracking
* Enhanced error reporting

= 1.4.35 =
* Fixed status badge display issues
* Improved bulk processing flow
* Enhanced UI updates

= 1.4.34 =
* Fixed bulk processing button handlers
* Improved event binding
* Enhanced error handling

= 1.4.33 =
* Fixed bulk processing initialization
* Improved script loading
* Enhanced compatibility

= 1.4.32 =
* Fixed Cancel button not responding to clicks
* Fixed Cancel button visibility (override !important styles)
* Removed conflicting inline script cancel handler
* All button handlers now consistently in admin.js

= 1.4.27 =
* Improved plugin title and description for better discoverability
* Optimized tags for image SEO and alt text searches
* Enhanced FAQ section with additional helpful questions
* Updated screenshot captions for clarity
* Tested compatibility with WordPress 6.9

= 1.4.24 =
* Added onboarding modal for API key setup
* Improved user experience with guided API key entry
* Enhanced modal UI with better accessibility
* Automatic modal display when API key is missing

= 1.4.21 =
* Fixed code analysis warnings for discouraged functions and syntax


= 1.4.20 =
* Temporarily hid context input field from media sidebar


= 1.4.19 =
* Fixed issue where context was not being sent to the API during generation
* Improved JavaScript selectors for better compatibility with different admin views


= 1.4.18 =
* Fixed missing context input field in media edit sidebar


= 1.4.17 =
* Fixed bulk process progress counters showing incorrect numbers after completion
* Ensured processed count and successful count match final results


= 1.4.16 =
* Fixed bulk process completion status bug where status was overwritten with "running"
* Ensured success notification appears correctly after bulk processing completes


= 1.4.15 =
* Fixed status badge stuck on "Processing..." after completion
* Fixed completion detection - now properly stops polling and shows completion
* Added comprehensive console logging for debugging completion flow
* Improved status update logic to prevent overriding completed status
* Enhanced notification display to ensure it's visible

= 1.4.14 =
* Fixed success notification not appearing after bulk process completion
* Fixed cancel button visibility - now properly hidden when process hasn't started
* Improved notification display with better selector and visibility handling
* Enhanced cancel button show/hide logic with proper !important styles

= 1.4.13 =
* Fixed JavaScript syntax error that was preventing script from loading
* Removed problematic button cloning that caused DOM issues
* Simplified event handler attachment for better reliability
* Fixed typeof checks in event handlers

= 1.4.12 =
* Fixed "Start Processing" button - removed button cloning that was breaking event handlers
* Added dual event handlers (jQuery + native DOM) for maximum compatibility
* Enhanced form submission prevention with capture phase listeners
* Improved event handler binding to ensure button works reliably

= 1.4.11 =
* Fixed "Start Processing" button click handler - improved event binding and prevention
* Added immediate DOM event handlers to prevent form submission before jQuery loads
* Enhanced event handler cleanup to prevent duplicate bindings
* Added comprehensive console logging for debugging

= 1.4.10 =
* Fixed "Start Processing" button not working - added form submission prevention
* Fixed Cancel button showing when process hasn't started - now properly hidden
* Added validation to prevent double-clicking start button
* Added console logging for debugging bulk process issues

= 1.4.9 =
* Fixed bulk process status badge not updating to "Completed" when process finishes
* Added completion notification popup showing process results and error details
* Improved status polling to stop immediately when process completes
* Enhanced error reporting in completion notification

= 1.4.8 =
* Updated "Generate Alt-Text" button icon to show "SEO+" text instead of image icon
* Improved button visual design for better relevance

= 1.4.7 =
* Fixed automatic alt-text generation appearing on image edit page
* Loading state now only appears when user clicks "Generate Alt-Text" button
* Automatic generation only occurs per plugin settings (on upload) or bulk process

= 1.4.6 =
* Fixed escaping of all variables when echoed
* Added wp_kses_post() for HTML output from get_media_field_html()
* Ensured all output follows WordPress escaping best practices

= 1.4.5 =
* Fixed text domain to match plugin slug (alt-text-pro)
* Added load_plugin_textdomain() for proper translation loading
* Ensured all 250+ translation functions use correct text domain

= 1.4.4 =
* Fixed JavaScript and CSS enqueuing to use WordPress built-in functions
* Moved all inline scripts to wp_add_inline_script() for proper WordPress compliance
* Removed inline script tags from template files

= 1.4.3 =
* Fixed Contributors field to include correct WordPress.org username

= 1.4.2 =
* Version update

= 1.4.1 =
* Renamed plugin slug and folder to match Text Domain
* UI overhaul with modern design
* Improved navigation and dashboard layout
* Enhanced user experience for settings and logs
* Added real-time completion notifications for bulk processing
* Added immediate credit exhaustion alerts during processing
* Improved error notifications with visual feedback
* Enhanced status updates during bulk processing
* Fixed notification display for all completion statuses
* Fixed critical bug: Processing now stops immediately when credits are exhausted
* Fixed dashboard credit calculation - now correctly displays credits used vs total
* Improved error messages when credits run out during bulk processing
* Added proper handling for credit exhaustion across all subscription plans
* Fixed edge cases in credit display (negative values, exceeding totals)
* Fixed processing options - "Process images missing alt-text", "Process all images", and "Process selected images" now work correctly
* Fixed overwrite existing alt-text checkbox logic
* Improved batch size handling
* Better separation of process type and overwrite settings
* Fixed successful count tracking in bulk processing
* Improved progress tracking accuracy across batches
* Enhanced data persistence for bulk process status
* Added automatic verification of successful count vs actual processed images
* Better error handling and debug logging for bulk operations
* Fixed API endpoint from auth/validate to auth-validate
* Enhanced debug logging to show exact URLs
* Better error handling for 404 responses
* AI-powered alt-text generation using advanced AI technology
* Automatic processing on image upload
* Bulk processing for existing images
* Beautiful admin dashboard
* Usage tracking and logs
* Context-aware generation
* Media library integration
* Mobile-responsive design
* Comprehensive settings panel

== Upgrade Notice ==

= 1.7.29 =
Each image is billed once when bulk, manual and automatic generation meet, failed attempts no longer cancel automatic alt text, and rotated photos are described upright. Recommended for all users.

= 1.7.28 =
Images inside posts get their Media Library alt text, alt text in your language, faster uploads, resumable bulk runs and clearer account errors. Recommended for all users.

= 1.7.27 =
Clearer plugin description and an optional, dismissible review request. No changes to how alt text is generated.

= 1.7.26 =
Fixes post content being altered when generating alt text for a post, lifts the 1,000-image bulk limit, and downscales large images. Recommended for all users.

= 1.4.60 =
Bug fix: Fixed settings page initialization for new installations. Recommended update for all users.
