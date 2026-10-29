=== Alt Text Pro – AI Alt Text Generator ===
Contributors: aamirfaiz
Tags: alt text, ai alt text, image alt text, accessibility, image seo
Requires at least: 5.0
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 1.7.28
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Alt Text Pro writes AI alt text for your WordPress images. Review each draft, generate on upload, or bulk fix missing alt text in your media library.

== Description ==
Alt Text Pro is an AI alt text generator for WordPress. It looks at each image, writes a short, specific description, and saves it as the image's alt text in your media library. You review the draft, add details the AI cannot know (such as a product name), and decide what appears on your site.

Use it to fix missing alt text across an older media library, describe WooCommerce product and gallery images, or write alt text for new images as you upload them.

### What Alt Text Pro does

* Generates alt text for one image in the media editor, so you can review it before saving
* Optionally writes alt text automatically when you upload new images
* Bulk fixes missing alt text across your media library, up to your newest 20,000 images per run
* Adds alt text from the Posts and Pages list, including empty alt attributes inside the post content, without replacing alt text you already wrote
* Fills empty alt attributes of images inside posts on your pages from the Media Library (optional, on by default), so images already placed in posts benefit from new alt text
* Writes alt text in your site's language, or in a language you choose
* Uses optional page and site context for more relevant descriptions
* Works with WooCommerce product and gallery images, because they live in the media library
* Shows credit usage and generation history, with CSV export
* Connects to your Alt Text Pro account in one click and stores your API key encrypted

AI descriptions are a strong starting point, not a final answer. Check the images that matter most and edit where the page needs more context.

### Bulk processing experience

Bulk processing is designed to keep credit usage and cancellation behavior predictable. The plugin processes one billable image at a time, starts the next image shortly after a successful result, and honors provider rate-limit retry windows when needed.

During a run, the live panel shows the current image state, overall progress, generated results, issues, remaining images, and recent activity. Choosing "Stop after current image" prevents the next image from starting while allowing an image already being generated to finish and be counted accurately.

If a run ends with an error, Alt Text Pro shows a compact, dismissible warning in the bottom-right corner and keeps the details in the activity list. A zero-error run does not show an attention warning.

### Why better alt text matters

Alt text gives images a useful text alternative. Good alt text helps screen-reader users understand important visuals, gives search engines more context, and makes your media library easier to maintain.

Alt Text Pro is designed to speed up the repetitive work while still keeping you in control. The generated text is a strong starting point, and you can edit it whenever your page context needs a more specific description.

### Useful for

* Bloggers and publishers with large image libraries
* WooCommerce stores with product images missing alt text
* Agencies preparing accessibility and SEO cleanups for client sites
* Site owners migrating old content into WordPress
* Editors who want a faster workflow for image descriptions

### How setup works

1. Install and activate the plugin.
2. Open Alt Text Pro in your WordPress admin.
3. Connect your Alt Text Pro account or paste your API key.
4. Generate alt text for one image, a post, or a bulk media-library batch.
5. Review the generated text and edit where needed.

### Credits and plans

New accounts include 150 free signup credits plus 15 free credits every month. Each successful alt text generation uses 1 credit. Paid plans and credit packs are available from the Alt Text Pro dashboard.

### Technical Requirements

* WordPress 5.0 or higher
* PHP 7.4 or higher
* Active internet connection for API calls
* Alt Text Pro account with available credits

== Installation ==

### Automatic Installation

1. Go to your WordPress admin dashboard
2. Navigate to Plugins -> Add New
3. Search for "Alt Text Pro"
4. Click "Install Now" and then "Activate"

### Manual Installation

1. Download the plugin zip file
2. Go to Plugins -> Add New -> Upload Plugin
3. Choose the zip file and click "Install Now"
4. Activate the plugin

### Setup

1. Go to Alt Text Pro -> Settings in your WordPress admin
2. Click "Connect to Alt Text Pro"
3. Sign in or create a free account
4. The plugin saves your API key automatically
5. Test the connection to ensure everything works
6. Generate alt text for a test image before running a larger batch.

Manual API key setup is still available from the settings page if your browser blocks the connect popup.

== Frequently Asked Questions ==

= What is alt text and why do I need it? =

Alt text is the text alternative saved in an image's alt attribute. It helps screen-reader users understand important visuals and gives search engines more context about the image.

= Does this guarantee accessibility compliance? =

No plugin can guarantee compliance by itself. Alt Text Pro helps you fill missing image descriptions faster, but you should still review generated alt text for accuracy, context, and accessibility quality.

= Can it process my existing media library? =

Yes. The bulk processor can generate alt text for existing media-library images that are missing alt text.

= Can I generate alt text for images inside posts and pages? =

Yes. Alt Text Pro includes post and page workflows that find images in content and help add alt text where it is missing.

= Does it work for WooCommerce product images? =

Yes. Product images are a common use case. You should still review the generated text to make sure it matches the product and page context.

= Do I need an Alt Text Pro account? =

Yes. The plugin connects to the Alt Text Pro API, so you need an account and available credits. Free credits are available for testing.

= How accurate is the AI-generated alt text? =

AI-generated alt text is usually a strong starting point, but you should review it. The best alt text depends on the page context and the purpose of the image.

= Can I edit the generated alt text? =

Yes. Generated alt text is saved into WordPress and can be edited from the plugin interface, media library, or normal WordPress fields.

= What happens if I run out of credits? =

New generations stop until you add credits or upgrade your plan. Existing alt text remains in your WordPress site.

= Is my data secure? =

Images are sent securely to the Alt Text Pro service for AI processing. The plugin is designed for service calls such as API key validation, generation, credit checks, and subscription-related requests.

= Does the plugin send marketing tracking from wp-admin? =

No. The plugin does not send non-essential wp-admin marketing or funnel events. When an API key validates successfully, the Alt Text Pro service may record that the account connected the plugin so onboarding can work correctly.

= What image formats are supported? =

Alt Text Pro supports JPEG, PNG, GIF, WebP and AVIF, and HEIC when your server's image editor can read it. SVG and other vector files are skipped.

= Does it write alt text in my language? =

Yes. By default alt text is written in your site's language. Choose another language under Alt Text Pro > Settings > Alt text language. Languages the service does not support yet fall back to English.

= Will images already inside my posts get the new alt text? =

Yes. With "Fill empty alt text in post content" on (the default), images in posts whose alt attribute is empty or missing are shown with the alt text saved in the Media Library. Alt text written in the post is never replaced. The Posts list also offers "Copy alt text into post" to save it into the post itself, which uses no credits.

= Does the plugin send emails? =

Only one: when a bulk run finishes or stops, WordPress emails a short summary to the user who started it. Turn it off under Alt Text Pro > Settings > "Email me when a bulk run finishes". The email is sent by your site through wp_mail(), not by Alt Text Pro.

= Can I cancel my subscription anytime? =

Yes, you can cancel your subscription at any time from your Alt Text Pro dashboard. You'll continue to have access until the end of your billing period.

== Screenshots ==

1. Alt Text Pro dashboard with credits, usage, and generation shortcuts.
2. Settings screen for connecting your Alt Text Pro account and validating your API key.
3. Bulk processor for generating alt text across missing media-library images.
4. Media-library integration for generating alt text on individual images.
5. Generation history showing recent alt text activity and credit usage.
6. Responsive admin interface for managing alt text from different screen sizes.

== Changelog ==
= 1.7.28 =
* New: "Fill empty alt text in post content" (on by default). On WordPress 6.0 and later, images inside posts whose alt is empty or missing are shown with their Media Library alt text. Alt text written in the post is never overwritten.
* New: the Posts list counts images in the post content that still have empty alt text and offers "Copy alt text into post" (no credits) instead of "All done". WooCommerce product gallery images are included.
* New: "Alt text language" setting. Alt text follows the site language by default, or a language you choose.
* New: "Buy credits or upgrade" links on the dashboard, the Bulk page and every out-of-credits message. Bulk "Start" is disabled at 0 credits, with an explanation.
* New: a Generate button in the media modal and the Media Library grid.
* New: a bulk run survives a page reload. The Bulk page shows the running run so its owner can resume it and any administrator can stop it, and the browser warns before leaving a running run.
* New: "Selected" mode lets you search and page through all images, including ones that already have alt text, to regenerate them.
* New: "Email me when a bulk run finishes" setting (on by default). The email is now proper plain text.
* New: the "Send image context" setting is shown on the Settings page. The unused batch-size field was removed.
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

= 1.7.28 =
Images inside posts get their Media Library alt text, alt text in your language, faster uploads, resumable bulk runs and clearer account errors. Recommended for all users.

= 1.7.27 =
Clearer plugin description and an optional, dismissible review request. No changes to how alt text is generated.

= 1.7.26 =
Fixes post content being altered when generating alt text for a post, lifts the 1,000-image bulk limit, and downscales large images. Recommended for all users.

= 1.4.60 =
Bug fix: Fixed settings page initialization for new installations. Recommended update for all users.

== Support ==

Need help with alt text generation? We're here for you!

* **Documentation**: Visit our [knowledge base](https://www.alt-text.pro/docs)
* **Support**: Contact us through the [support form](https://www.alt-text.pro/contact)
* **Feature Requests**: We love hearing your ideas!

== External services ==

This plugin needs an Alt Text Pro account and connects to the Alt Text Pro service at `https://www.alt-text.pro` to work.

* **Generating alt text** (single image, post, bulk, or automatic on upload): the image (downscaled when large), the optional context you enable (post title, related text, and your blog context setting), the alt text language, your API key, and the plugin version are sent to `https://www.alt-text.pro/.netlify/functions/generate-alt-text`. Alt Text Pro sends the image and context to its AI provider (Google Gemini) to produce the description.
* **Showing your credits and plan, and validating a key**: your API key and the plugin version are sent to `https://www.alt-text.pro/.netlify/functions/get-usage` and `https://www.alt-text.pro/.netlify/functions/auth-validate` when you open the plugin's pages, start a bulk run, or save a key.
* **Connected sites**: every request above also sends this site's address (home URL) and WordPress language, so your Alt Text Pro account can list the sites that use your API key. When you disconnect the account or uninstall the plugin, the site address is sent to `https://www.alt-text.pro/.netlify/functions/site-disconnect` so the site stops counting as connected.
* **Connecting your account**: "Connect Account" opens `https://www.alt-text.pro/connect` with this site's settings page address so the API key can be returned to WordPress after you sign in.

WordPress also sends its standard user agent, which includes your site address, with these requests. Nothing is sent until you connect an account.

When a bulk run finishes, WordPress (not Alt Text Pro) emails a summary to the user who started it, unless "Email me when a bulk run finishes" is turned off in Settings.

Terms of Service: https://www.alt-text.pro/terms
Privacy Policy: https://www.alt-text.pro/privacy

== Privacy Policy ==

Alt Text Pro uses encrypted HTTPS connections. Images and optional page context are sent to the configured AI provider to generate a description. Account, usage, and operational records are retained as described in the Privacy Policy. API keys saved by the WordPress plugin are encrypted on the WordPress installation.

Uninstalling the plugin removes its settings, temporary bulk-job records, and local generation-history table. Alt text already saved to WordPress attachments is retained as site content.

You can contact support to request access, correction, or deletion where applicable.

For full details, see our [Privacy Policy](https://www.alt-text.pro/privacy).

== About Alt Text Pro ==

Alt Text Pro helps WordPress site owners draft alt text for Media Library images, review the result, and save it into WordPress. It supports single-image generation, bulk runs for missing alt text, usage tracking, and optional page context.

AI output can be incomplete or incorrect, so review important descriptions before publishing.

**Get started today**: [Sign up for free](https://www.alt-text.pro) and try the workflow with included free credits.
