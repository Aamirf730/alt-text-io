=== AI Alt Text Pro ===
Contributors: aamirfaiz
Tags: alt text, accessibility, image seo, ai, media library
Requires at least: 5.0
Tested up to: 6.9
Requires PHP: 7.4
Stable tag: 1.4.99
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Generate accurate AI alt text for WordPress images, improve accessibility, and bulk-fix missing media-library alt text for SEO.

== Description ==
Alt Text Pro helps WordPress site owners write useful image alt text faster. It uses AI vision models to describe images, then saves the result into the WordPress media library so your content is easier to understand for visitors, screen readers, and search engines.

Use it when you are launching a new site, cleaning up an old media library, managing WooCommerce product images, or fixing missing alt text across blog posts and pages.

### What Alt Text Pro does

* Generates AI alt text for individual images from the WordPress admin
* Bulk-generates alt text for existing media-library images
* Adds alt text to images used inside posts and pages
* Lets you review and edit generated alt text before relying on it
* Shows credit usage and generation history inside WordPress
* Connects to your Alt Text Pro account with a guided setup flow
* Helps improve accessibility basics for content and product images
* Supports image SEO workflows by filling missing alt attributes

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

New accounts include free credits for testing. Each successful alt text generation uses 1 credit. Paid plans and credit packs are available from the Alt Text Pro dashboard.

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

Alt Text Pro supports standard WordPress web image formats such as JPEG, PNG, GIF, and WebP.

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

= 1.4.60 =
Bug fix: Fixed settings page initialization for new installations. Recommended update for all users.

== Support ==

Need help with alt text generation? We're here for you!

* **Documentation**: Visit our [knowledge base](https://www.alt-text.pro/docs)
* **Support**: Contact us at [support](https://www.alt-text.pro/support)
* **Feature Requests**: We love hearing your ideas!

== Privacy Policy ==

Alt Text Pro is committed to protecting your privacy:

* Images are processed securely via encrypted HTTPS connections
* Images are not stored on our servers after alt text generation
* Only necessary metadata is logged for service improvement
* We comply with GDPR and other privacy regulations
* You can delete your account and data at any time

For full details, see our [Privacy Policy](https://www.alt-text.pro/privacy).

== About Alt Text Pro ==

Alt Text Pro is the leading AI alt text generator dedicated to making the web more accessible for everyone. Our mission is to provide powerful, easy-to-use tools that help website owners create better alt text descriptions for their images, improving both accessibility and image SEO.

Founded by accessibility advocates and AI experts, we understand the importance of inclusive design and the challenges of creating quality alt text at scale. Our automatic alt text generator combines cutting-edge AI technology with human insight to deliver the best possible image optimization results.

Join thousands of websites already using Alt Text Pro - the #1 AI alt text generator - to improve their accessibility and image SEO!

**Get started today**: [Sign up for free](https://www.alt-text.pro) and get credits to try our alt text generator risk-free.
