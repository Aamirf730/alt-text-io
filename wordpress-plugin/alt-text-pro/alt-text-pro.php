<?php
/**
 * Plugin Name: Alt Text Pro
 * Plugin URI: https://www.alt-text.pro
 * Description: Draft AI alt text for WordPress images, review it, and fill missing Media Library alt attributes in small batches.
 * Version:           1.7.28
 * Author: Alt Text Pro
 * Author URI: https://www.alt-text.pro/about
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: alt-text-pro
 * Requires at least: 5.0
 * Tested up to: 7.0
 * Requires PHP: 7.4
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('ALT_TEXT_PRO_VERSION', '1.7.28');
// Version 1.7.28 - Fill empty alt text inside post content, alt text language setting, upgrade links, resumable bulk runs and clearer service errors.
// Version 1.7.27 - Clearer WordPress.org listing and an optional review request after 50 descriptions.
// Version 1.7.26 - Fix: keep post content intact when syncing alt text, one bulk run per site without the 1,000-image cap, downscale large images, and show real account state on the dashboard.
// Version 1.7.24 - Maintenance: fix context generation, timezone-aware stats, safe writes, cleanup, and dead admin bindings.
// Version 1.7.23 - Security: remove duplicate connection requests and escape dynamic bulk activity output.
// Version 1.7.22 - Reliability: persist active bulk-process state in the options table for transient recovery.
// Version 1.7.21 - Maintenance: remove the obsolete bulk-processing AJAX stub and hook.
// Version 1.7.20 - Fix: report post images excluded by per-media permissions instead of presenting incomplete generation as success.
// Version 1.7.19 - Fix: keep Gutenberg block metadata aligned with rendered image markup during post-level alt-text regeneration.
// Version 1.7.18 - Security: enforce per-media authorization and bind bulk jobs to their owners.
// Version 1.7.17 - Security: authenticate connect callbacks and fail closed when API-key encryption is unavailable.
// Version 1.7.15 - Branding: align the plugin UI, logo, and distribution artwork with the white, yellow, and black brand palette.
// Version 1.7.14 - UX: restore the polished shared onboarding modal and stable responsive action layout.
// Version 1.7.13 - Fix: preserve validated encrypted API keys when WordPress sanitizes plugin settings.
// Version 1.7.12 - UX: distinguish confirmed acknowledgement success from legacy key delivery and normalize connect-handler formatting.
// Version 1.7.11 - Security/UX: confirm popup delivery after the API key is saved and provide manual recovery when the opener is unavailable.
// Version 1.7.10 - Fix: preserve bulk-process state when Redis or another persistent object cache is enabled.
// Version 1.7.9 - Release: bundle oversized-image recovery and bulk-header cleanup into the next public package.
// Version 1.7.8 - Reliability: skip oversized images with a clear error and end failed bulk requests visibly.
// Version 1.7.7 - Branding: use the public display name Alt Text Pro while preserving the alt-text-pro slug and text domain.
// Version 1.7.6 - Docs: document current bulk-processing behavior and user-facing status feedback.
// Version 1.7.5 - UX: show genuine bulk-processing warnings as compact, dismissible bottom-right notifications.
// Version 1.7.4 - UX: remove redundant pre-run image summary cards from bulk generation.
// Version 1.7.3 - UX: clarify live bulk processing with current-work, progress, outcome, and remaining-work details.
// Version 1.7.2 - Fix: reconcile in-flight bulk results before reporting cancellation so visible generations match credits used.
// Version 1.7.1 - Performance: use adaptive bulk pacing instead of a fixed 15-second pause between successful images.
// Version 1.7.0 - UX: redesigned the account onboarding and fixed automatic verified-key saving.
// Version 1.6.0 - UX: refine dashboard credits meta sizing for cleaner visual hierarchy.
// Version 1.5.9 - UX: simplify plugin dashboard stats and track plugin version in SaaS admin views.
// Version 1.5.8 - Fix: show and enforce monthly remaining credits instead of hidden annual balance.
// Version 1.5.7 - UX: clarify account-level credit usage versus site-level generated stats.
// Version 1.5.6 - UX: split dashboard generated stats into lifetime and this-month counts.
// Version 1.5.5 - UX: remove internal queue count from bulk progress messaging.
// Version 1.5.4 - Fix: cap bulk progress and processing by remaining plan credits for the current cycle.
// Version 1.5.3 - UX: correct dashboard credit stats for annual plans and rollover balances.
// Version 1.5.2 - UX: clarify annual-plan bulk credit messaging and show credit-limited bulk totals.
// Version 1.5.1 - Maintenance: satisfy WordPress.org plugin check and compatibility metadata requirements.
// Version 1.5.0 - Fix: bulk processing now respects AI provider rate limits and retries instead of marking images failed.
// Version 1.4.99 - Privacy: remove non-essential WordPress admin marketing event tracking.
// Version 1.4.98 - Growth tracking: attach validated account identity to WordPress plugin funnel events.
// Version 1.4.97 - Fix: make bulk cancellation credit-accurate by processing one billable image per request and preserving cancelled state server-side.
// Version 1.4.96 - Fix: prevent duplicate manual generation requests and make bulk cancel stop before billable batches start.
// Version 1.4.95 - Growth tracking: add connect, plugin download, and bulk-processing funnel events for onboarding automation.
// Version 1.4.94 - Brand refresh: align plugin admin colors with the Alt Text Pro logo palette.
// Version 1.4.93 - Security: stop exposing saved API keys in the admin UI, remove debug/test artifacts from release builds, and reduce production logging.
// Version 1.4.92 - Fixed: OAuth/popup onboarding can now fall back cleanly and verifies API key persistence after save.
// Version 1.4.91 - Fixed: API client was using encrypted key from DB without decrypting it, causing all API calls to fail after save.
// Version 1.4.90 - Fixed: API key not saving on form submission. Added explicit empty key handling and debug logging.
// Version 1.4.89 - Fixed: JavaScript syntax error in formatFileSize function.
// Version 1.4.85 - Fix: Onboarding modal now appears on Dashboard page for first-time users.
// Version 1.4.84 - Fix: Bulletproof admin notice suppression on plugin pages (PHP + CSS + JS three-layer approach).
// Version 1.4.83 - Fix: Onboarding modal now auto-opens on first install when no API key is set.
// Version 1.4.82 - Fix: Suppress global admin notices on plugin pages and redirect them to a custom container.
// Version 1.4.81 - Fix: Critical syntax errors in PHP and JavaScript that prevented plugin functionality.
// Version 1.4.80 - Added: OAuth-style "Connect to Alt Text Pro" button for easier onboarding.
// Version 1.4.79 - Fix: update alt attributes in post content HTML for content images
define('ALT_TEXT_PRO_PLUGIN_URL', plugin_dir_url(__FILE__));
define('ALT_TEXT_PRO_PLUGIN_PATH', plugin_dir_path(__FILE__));
define('ALT_TEXT_PRO_PLUGIN_BASENAME', plugin_basename(__FILE__));

// API Configuration
define('ALT_TEXT_PRO_API_BASE', 'https://www.alt-text.pro/.netlify/functions');

// Where customers buy credits or change plan.
define('ALT_TEXT_PRO_PRICING_URL', 'https://www.alt-text.pro/#pricing');
define('ALT_TEXT_PRO_DASHBOARD_URL', 'https://www.alt-text.pro/dashboard');

/**
 * Main Plugin Class
 */
class AltTextPro
{

    private static $instance = null;

    // Bump when create_tables() changes so existing sites run dbDelta again.
    private const DB_VERSION = '1.7.26';

    // Post-level generation calls the service at most this many times per
    // admin-ajax request so posts with many images do not time out.
    private const POST_GENERATIONS_PER_REQUEST = 3;

    /**
     * Get singleton instance
     */
    public static function get_instance()
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Constructor
     */
    private function __construct()
    {
        add_action('init', array($this, 'init'));
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));

        // Multisite: set up sites created while the plugin is network active,
        // and drop the logs table when a site is deleted.
        add_action('wp_initialize_site', array($this, 'initialize_new_site'), 200);
        add_filter('wpmu_drop_tables', array($this, 'drop_site_tables'));
    }

    /**
     * Answer an AJAX request the current user may not make with JSON (HTTP
     * 403) instead of the plain-text page wp_die() prints.
     */
    public static function send_permission_error($message = '')
    {
        wp_send_json_error(
            $message !== '' ? $message : __('You do not have permission to perform this action.', 'alt-text-pro'),
            403
        );
    }

    /**
     * Initialize plugin
     */
    public function init()
    {
        // Load plugin text domain - handled automatically by WordPress 4.6+
        load_plugin_textdomain('alt-text-pro', false, dirname(ALT_TEXT_PRO_PLUGIN_BASENAME) . '/languages');

        // Initialize components
        $this->load_dependencies();
        $this->init_hooks();
    }

    /**
     * Load plugin dependencies
     */
    private function load_dependencies()
    {
        require_once ALT_TEXT_PRO_PLUGIN_PATH . 'includes/class-api-client.php';
        require_once ALT_TEXT_PRO_PLUGIN_PATH . 'includes/class-admin.php';
        require_once ALT_TEXT_PRO_PLUGIN_PATH . 'includes/class-media-handler.php';
        require_once ALT_TEXT_PRO_PLUGIN_PATH . 'includes/class-bulk-processor.php';
        require_once ALT_TEXT_PRO_PLUGIN_PATH . 'includes/class-settings.php';
        require_once ALT_TEXT_PRO_PLUGIN_PATH . 'includes/class-review.php';
    }

    /**
     * Initialize hooks
     */
    private function init_hooks()
    {
        // Admin hooks
        if (is_admin()) {
            new AltTextPro_Admin();
            new AltTextPro_Settings();
            new AltTextPro_Review();

            // Posts list columns
            add_filter('manage_posts_columns', array($this, 'add_alt_text_column'));
            add_filter('manage_pages_columns', array($this, 'add_alt_text_column'));
            add_action('manage_posts_custom_column', array($this, 'render_alt_text_column'), 10, 2);
            add_action('manage_pages_custom_column', array($this, 'render_alt_text_column'), 10, 2);
        }

        // Front end: fill empty alt attributes of images in post content from
        // the Media Library. wp_content_img_tag exists since WordPress 6.0.
        if (!is_admin() && self::supports_content_img_tag_filter()) {
            add_filter('wp_content_img_tag', array($this, 'fill_content_image_alt'), 10, 3);
        }

        // Media hooks
        new AltTextPro_Media_Handler();
        new AltTextPro_Bulk_Processor();

        // AJAX hooks
        add_action('wp_ajax_alt_text_pro_generate', array($this, 'ajax_generate_alt_text'));
        add_action('wp_ajax_alt_text_pro_get_usage', array($this, 'ajax_get_usage'));
        add_action('wp_ajax_alt_text_pro_validate_key', array($this, 'ajax_validate_key'));
        add_action('wp_ajax_alt_text_pro_generate_post', array($this, 'ajax_generate_post_alt_text'));

        // Enqueue scripts
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));

        // Daily cleanup of abandoned bulk-run state (scheduled on activation).
        add_action('alt_text_pro_cleanup', array('AltTextPro_Bulk_Processor', 'cleanup_stale_bulk_states'));

        // Create missing tables and cron events on sites that never ran the
        // activation hook (plugin updates, multisite sites added later).
        add_action('admin_init', array($this, 'maybe_upgrade'));

        // Redirect to dashboard after activation
        add_action('admin_init', array($this, 'activation_redirect'));
    }

    /**
     * Redirect to plugin dashboard after activation
     */
    public function activation_redirect()
    {
        // Only a normal admin page load by someone who can open the dashboard
        // may use (and consume) the one-time redirect flag.
        if (
            wp_doing_ajax()
            || wp_doing_cron()
            || (defined('REST_REQUEST') && REST_REQUEST)
            || (defined('WP_CLI') && WP_CLI)
            || !current_user_can('manage_options')
        ) {
            return;
        }

        // Check if we should redirect
        if (!get_transient('alt_text_pro_activation_redirect')) {
            return;
        }

        // Delete the transient so we don't redirect again
        delete_transient('alt_text_pro_activation_redirect');

        // Don't redirect on multisite bulk activation
        $alt_text_pro_bulk_activation = filter_input(INPUT_GET, 'activate-multi', FILTER_SANITIZE_FULL_SPECIAL_CHARS);
        if (is_network_admin() || null !== $alt_text_pro_bulk_activation) {
            return;
        }

        // Redirect to the plugin dashboard
        wp_safe_redirect(admin_url('admin.php?page=alt-text-pro'));
        exit;
    }

    /**
     * Plugin activation
     *
     * @param bool $network_wide True when network-activated on multisite.
     */
    public function activate($network_wide = false)
    {
        if (is_multisite() && $network_wide) {
            // Set up every existing site. Sites this loop does not reach are
            // set up by maybe_upgrade() on their first admin page load.
            $site_ids = get_sites(array(
                'fields' => 'ids',
                'number' => 0,
            ));

            foreach ($site_ids as $site_id) {
                switch_to_blog($site_id);
                $this->activate_site();
                restore_current_blog();
            }

            return;
        }

        $this->activate_site();

        // Set redirect flag so we redirect to the dashboard on first load
        set_transient('alt_text_pro_activation_redirect', true, 30);
    }

    /**
     * Create tables, default options and scheduled events for the current site.
     */
    private function activate_site()
    {
        require_once ALT_TEXT_PRO_PLUGIN_PATH . 'includes/class-settings.php';

        // Create database tables if needed
        $this->create_tables();
        update_option('alt_text_pro_db_version', self::DB_VERSION, true);

        // Bulk-run log columns (separate, additive upgrade step).
        require_once ALT_TEXT_PRO_PLUGIN_PATH . 'includes/class-bulk-processor.php';
        AltTextPro_Bulk_Processor::upgrade_log_table();

        // Set default options
        if (!get_option('alt_text_pro_settings')) {
            add_option('alt_text_pro_settings', AltTextPro_Settings::defaults());
        }

        // Clear any scheduled events for bulk processing
        wp_clear_scheduled_hook('alt_text_pro_bulk_process_batch');
        wp_unschedule_hook('alt_text_pro_generate_background');

        if (!wp_next_scheduled('alt_text_pro_cleanup')) {
            wp_schedule_event(time() + HOUR_IN_SECONDS, 'daily', 'alt_text_pro_cleanup');
        }
    }

    /**
     * Set up a site created while the plugin is network active.
     *
     * @param WP_Site $site The new site.
     */
    public function initialize_new_site($site)
    {
        if (!is_object($site) || empty($site->blog_id)) {
            return;
        }

        if (!function_exists('is_plugin_active_for_network')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        if (!is_plugin_active_for_network(ALT_TEXT_PRO_PLUGIN_BASENAME)) {
            return;
        }

        switch_to_blog((int) $site->blog_id);
        $this->activate_site();
        restore_current_blog();
    }

    /**
     * Drop the site's logs table when WordPress deletes a site.
     *
     * @param string[] $tables Tables WordPress is about to drop.
     * @return string[]
     */
    public function drop_site_tables($tables)
    {
        global $wpdb;

        $tables = is_array($tables) ? $tables : array();
        $tables[] = $wpdb->prefix . 'alt_text_pro_logs';

        return $tables;
    }

    /**
     * Cheap per-request check: create the logs table and the cleanup event
     * when this site has not been set up for the current schema.
     */
    public function maybe_upgrade()
    {
        if (get_option('alt_text_pro_db_version') !== self::DB_VERSION) {
            $this->create_tables();
            update_option('alt_text_pro_db_version', self::DB_VERSION, true);
        }

        // Bulk-run log columns: their own version, so this step and changes
        // to create_tables() stay independent.
        if (!AltTextPro_Bulk_Processor::log_columns_ready()) {
            AltTextPro_Bulk_Processor::upgrade_log_table();
        }

        if (!wp_next_scheduled('alt_text_pro_cleanup')) {
            wp_schedule_event(time() + HOUR_IN_SECONDS, 'daily', 'alt_text_pro_cleanup');
        }
    }

    /**
     * Plugin deactivation
     *
     * @param bool $network_wide True when network-deactivated on multisite.
     */
    public function deactivate($network_wide = false)
    {
        if (is_multisite() && $network_wide) {
            $site_ids = get_sites(array(
                'fields' => 'ids',
                'number' => 0,
            ));

            foreach ($site_ids as $site_id) {
                switch_to_blog($site_id);
                $this->clear_scheduled_events();
                restore_current_blog();
            }

            return;
        }

        $this->clear_scheduled_events();
    }

    /**
     * Clear the plugin's scheduled events on the current site.
     */
    private function clear_scheduled_events()
    {
        wp_clear_scheduled_hook('alt_text_pro_cleanup');
        wp_clear_scheduled_hook('alt_text_pro_bulk_process_batch');
        wp_unschedule_hook('alt_text_pro_generate_background');
        wp_clear_scheduled_hook('alt_text_pro_bulk_background_tick');
    }

    /**
     * Create database tables
     */
    private function create_tables()
    {
        global $wpdb;

        $table_name = $wpdb->prefix . 'alt_text_pro_logs';

        $charset_collate = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            attachment_id bigint(20) NOT NULL,
            alt_text text NOT NULL,
            credits_used int(11) DEFAULT 1,
            processing_time float DEFAULT NULL,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY attachment_id (attachment_id)
        ) $charset_collate;";

        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
    }

    /**
     * Enqueue admin scripts and styles
     */
    public function enqueue_admin_scripts($hook)
    {
        // Only load on relevant admin pages
        $allowed_pages = array(
            'upload.php',
            'edit.php',
            'post.php',
            'post-new.php',
            'media-upload-popup',
            'media-new.php',
            'toplevel_page_alt-text-pro',
            'alt-text-pro_page_alt-text-pro-settings',
            'alt-text-pro_page_alt-text-pro-bulk',
            'alt-text-pro_page_alt-text-pro-logs'
        );

        // Check if it's one of our plugin pages
        if (!in_array($hook, $allowed_pages) && strpos($hook, 'alt-text-pro') === false) {
            return;
        }

        // Enqueue styles
        wp_enqueue_style(
            'alt-text-pro-admin',
            ALT_TEXT_PRO_PLUGIN_URL . 'assets/css/admin.css',
            array(),
            ALT_TEXT_PRO_VERSION
        );

        // Enqueue scripts
        wp_enqueue_script(
            'alt-text-pro-admin',
            ALT_TEXT_PRO_PLUGIN_URL . 'assets/js/admin.js',
            array('jquery'),
            ALT_TEXT_PRO_VERSION,
            true
        );

        // Bulk, Review and Logs pages: run estimate, filters, background
        // runs, recent runs with undo, and the review actions.
        if (preg_match('/_page_alt-text-pro-(bulk|review|logs)$/', (string) $hook)) {
            AltTextPro_Bulk_Processor::enqueue_page_assets();
        }

        // Localize script
        $settings_handler = new AltTextPro_Settings();
        $settings = $settings_handler->get_settings();
        $has_valid_key = !empty($settings['api_key'])
            && AltTextPro_API_Client::validate_api_key_format($settings['api_key']);
        // "I'll do this later" is remembered per user; the settings page
        // button still opens the modal.
        $show_onboarding = !$has_valid_key
            && !get_user_meta(get_current_user_id(), AltTextPro_Admin::ONBOARDING_DISMISSED_META, true);

        wp_localize_script('alt-text-pro-admin', 'altTextAI', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'adminUrl' => admin_url(),
            'nonce' => wp_create_nonce('alt_text_pro_nonce'),
            'version' => ALT_TEXT_PRO_VERSION,
            'pricingUrl' => ALT_TEXT_PRO_PRICING_URL,
            'onboarding' => array(
                'show' => (bool)$show_onboarding,
                'modalId' => 'alt-text-pro-onboarding-modal',
                'dashboardUrl' => ALT_TEXT_PRO_DASHBOARD_URL,
                'connectUrl' => 'https://www.alt-text.pro/connect',
                'settingsUrl' => admin_url('admin.php?page=alt-text-pro-settings'),
            ),
            'bulk' => $hook === 'alt-text-pro_page_alt-text-pro-bulk' ? AltTextPro_Bulk_Processor::get_active_run_for_page() : null,
            'strings' => array(
                'generating' => __('Generating alt-text...', 'alt-text-pro'),
                'success' => __('Alt-text generated successfully!', 'alt-text-pro'),
                'error' => __('Failed to generate alt-text. Please try again.', 'alt-text-pro'),
                'noCredits' => __('No credits remaining. Buy a credit pack or upgrade your plan at alt-text.pro.', 'alt-text-pro'),
                'noCreditsStopped' => __('The run stopped because there are no credits remaining. Buy a credit pack or upgrade your plan at alt-text.pro.', 'alt-text-pro'),
                'invalidKey' => __('Invalid API key. Please check your settings.', 'alt-text-pro'),
                'processing' => __('Processing images...', 'alt-text-pro'),
                'completed' => __('Bulk processing completed!', 'alt-text-pro'),
                'connectionTestFailed' => __('Connection test failed', 'alt-text-pro'),
                'test' => __('Test', 'alt-text-pro'),
                'pleaseSelectImage' => __('Please select at least one image.', 'alt-text-pro'),
                'starting' => __('Starting...', 'alt-text-pro'),
                'settingsImported' => __('Settings imported! Please save to apply.', 'alt-text-pro'),
                'invalidFile' => __('Invalid file.', 'alt-text-pro'),
                'onboardingTitle' => __('Connect your Alt Text Pro account', 'alt-text-pro'),
                'onboardingSubtitle' => __('Connect automatically, or paste your API key manually if your browser blocks the popup.', 'alt-text-pro'),
                'onboardingCta' => __('Connect Account', 'alt-text-pro'),
                'onboardingSave' => __('Save API Key', 'alt-text-pro'),
                'onboardingSkip' => __('Maybe later', 'alt-text-pro'),
                'onboardingInvalidFormat' => __('Invalid API key format. Keys should start with "alt_" or "altai_".', 'alt-text-pro'),
                'onboardingSaved' => __('API key saved successfully!', 'alt-text-pro'),
                'postGenerating' => __('Generating...', 'alt-text-pro'),
                // translators: 1: images finished so far, 2: images in this run.
                'postProgress' => __('Generating %1$d/%2$d...', 'alt-text-pro'),
                // translators: %d: number of images that could not be processed.
                'postErrors' => __('%d error(s)', 'alt-text-pro'),
                'postNoCredits' => __('No credits remaining. Buy a credit pack or upgrade your plan at alt-text.pro.', 'alt-text-pro'),
                'postNoImages' => __('No images found in this post.', 'alt-text-pro'),
                'postAllDone' => __('All images already have alt-text!', 'alt-text-pro'),
                // translators: %d: Number of images updated with generated alt text.
                'postSuccess' => __('Done! %d image(s) updated.', 'alt-text-pro'),
                'postPermissionWarning' => __('%d image(s) skipped because you do not have permission to edit them.', 'alt-text-pro'),
                'postError' => __('Error generating alt-text.', 'alt-text-pro'),
                'postAddAltText' => __('Add Alt Text', 'alt-text-pro'),
                'postSyncToPost' => __('Copy alt text into post', 'alt-text-pro'),
                // translators: %d: number of images whose alt text was copied into the post.
                'postContentFilled' => __('Done! Alt text copied into the post for %d image(s).', 'alt-text-pro'),
            ) + self::get_admin_js_strings()
        ));

        // Add page-specific inline scripts
        if ($hook === 'alt-text-pro_page_alt-text-pro-settings') {
            $this->add_settings_inline_script();
        }
        elseif ($hook === 'alt-text-pro_page_alt-text-pro-logs') {
            $this->add_logs_inline_script();
        }
        elseif ($hook === 'edit.php') {
            $this->add_posts_list_inline_script();
        }
    }

    /**
     * Translated text for admin.js, passed as altTextAI.strings. admin.js
     * keeps an English fallback for each key.
     *
     * @return array<string, string>
     */
    private static function get_admin_js_strings()
    {
        return array(
            'accountSuspendedTitle' => __('Account suspended', 'alt-text-pro'),
            'altFieldMissing' => __('The WordPress alt-text field could not be found. Copy the draft and paste it manually.', 'alt-text-pro'),
            'analysing' => __('Alt Text Pro AI is analysing this image.', 'alt-text-pro'),
            'bulkAttention' => __('Bulk processing needs attention. Review the activity list for details.', 'alt-text-pro'),
            'bulkCompleted' => __('Bulk optimization completed!', 'alt-text-pro'),
            'bulkProcessingLabel' => __('Bulk processing', 'alt-text-pro'),
            'bulkRequestFailed' => __('Bulk request failed. Please try again.', 'alt-text-pro'),
            'bulkRequestTimeout' => __('Bulk request timed out. Please try again.', 'alt-text-pro'),
            'buyCredits' => __('Buy credits or upgrade', 'alt-text-pro'),
            // translators: %s: name of the user who started the bulk run.
            'cancelOtherConfirm' => __('Stop the bulk run started by %s? Images already done keep their alt text.', 'alt-text-pro'),
            'cancelOwnConfirm' => __('Stop this bulk run? Images already done keep their alt text.', 'alt-text-pro'),
            'cancelled' => __('Cancelled', 'alt-text-pro'),
            'cancelledByUser' => __('Bulk optimization cancelled by user.', 'alt-text-pro'),
            // translators: 1: images processed, 2: images that got alt text, 3: images with errors.
            'cancelledSummary' => __('Processed %1$d images (%2$d successful, %3$d errors) before stopping.', 'alt-text-pro'),
            'completedLabel' => __('Completed', 'alt-text-pro'),
            'connectedSaved' => __('Connected successfully! Your API key has been saved.', 'alt-text-pro'),
            'connectedSuccess' => __('Connected successfully!', 'alt-text-pro'),
            'connecting' => __('Connecting...', 'alt-text-pro'),
            'copied' => __('Copied!', 'alt-text-pro'),
            'creditsExhausted' => __('Credits Exhausted', 'alt-text-pro'),
            // translators: %d: credits the account can still spend.
            'creditsLeft' => __('Credits left: %d', 'alt-text-pro'),
            // translators: %d: number of images processed.
            'creditsRanOutSummary' => __('Processed %d images before available credits ran out.', 'alt-text-pro'),
            'creditsUsedUp' => __('Credits Used Up', 'alt-text-pro'),
            'dismissNotice' => __('Dismiss this notice.', 'alt-text-pro'),
            'draftApplied' => __('Draft placed in the WordPress alt-text field. Save or update the image to keep it.', 'alt-text-pro'),
            'endedEarly' => __('The run ended before all scheduled images completed.', 'alt-text-pro'),
            'endedWithErrors' => __('Process ended with errors or was interrupted.', 'alt-text-pro'),
            'enterKeyFirst' => __('Please enter an API key first.', 'alt-text-pro'),
            'errorLabel' => __('Error', 'alt-text-pro'),
            // translators: %s: error message.
            'errorPrefix' => __('Error: %s', 'alt-text-pro'),
            'everyImageFinished' => __('Every scheduled image has finished.', 'alt-text-pro'),
            'finishingCurrent' => __('Finishing the current image before stopping.', 'alt-text-pro'),
            'firstImageSoon' => __('The first image will begin shortly.', 'alt-text-pro'),
            'generatingState' => __('Generating', 'alt-text-pro'),
            // translators: %d: position of the image in the run.
            'imageN' => __('Image %d', 'alt-text-pro'),
            // translators: %d: attachment ID of an image without a file name.
            'imageIdLabel' => __('Image #%d', 'alt-text-pro'),
            'imageNotProcessed' => __('Image could not be processed.', 'alt-text-pro'),
            'imageTooLarge' => __('Image too large to process.', 'alt-text-pro'),
            // translators: %d: number of images the run can process.
            'initializedProcess' => __('Run started: up to %d images can be processed with the available credits.', 'alt-text-pro'),
            'initializing' => __('Initializing...', 'alt-text-pro'),
            'invalidAttachment' => __('Invalid attachment ID', 'alt-text-pro'),
            'leaveWarning' => __('A bulk run is in progress. Leaving this page pauses it; you can resume it from the Bulk page.', 'alt-text-pro'),
            // translators: %d: number of images the run can process.
            'limitNote' => __('This run can process up to %d images with available plan credits.', 'alt-text-pro'),
            // translators: 1: number of images the run can process, 2: credits at the start.
            'limitNoteCredits' => __('This run can process up to %1$d images with available plan credits (%2$d credits at start).', 'alt-text-pro'),
            // translators: 1: number of images the run can process, 2: plan credits used, 3: monthly plan credits.
            'limitNoteUsed' => __('This run can process up to %1$d images with available plan credits (%2$d used of %3$d).', 'alt-text-pro'),
            'loadImagesFailed' => __('Images could not be loaded.', 'alt-text-pro'),
            'loadingImages' => __('Loading images...', 'alt-text-pro'),
            // translators: %d: number of images with errors.
            'manyImagesAttention' => __('%d images need attention. Review the activity list for details.', 'alt-text-pro'),
            'missingAlt' => __('Missing alt text', 'alt-text-pro'),
            'needsAttentionState' => __('Needs attention', 'alt-text-pro'),
            'noImagesFound' => __('No images match.', 'alt-text-pro'),
            'noMoreImages' => __('No additional images will start. Any active image is included above.', 'alt-text-pro'),
            // translators: %d: number of images with errors (1).
            'oneImageAttention' => __('%d image needs attention. Review the activity list for details.', 'alt-text-pro'),
            // translators: 1: current page, 2: number of pages.
            'pageOf' => __('Page %1$d of %2$d', 'alt-text-pro'),
            // translators: 1: plan name, 2: credits remaining.
            'planCredits' => __('Plan: %1$s | Credits: %2$s', 'alt-text-pro'),
            'popupBlocked' => __('Your browser blocked the sign-in window. Allow popups or use manual entry.', 'alt-text-pro'),
            'popupClosed' => __('Sign-in window closed. Try again or use manual entry.', 'alt-text-pro'),
            'preparing' => __('Preparing', 'alt-text-pro'),
            'processCancelled' => __('Process Cancelled', 'alt-text-pro'),
            // translators: %d: position of the image in the run.
            'processingImage' => __('Processing image %d...', 'alt-text-pro'),
            'processingUpdate' => __('Processing update', 'alt-text-pro'),
            // translators: %d: maximum number of images in one run.
            'queueCapped' => __('This run includes the newest %d images. Start another run when it finishes to continue with older images.', 'alt-text-pro'),
            'queued' => __('Queued', 'alt-text-pro'),
            'ranOutLog' => __('Bulk optimization stopped because the account ran out of credits.', 'alt-text-pro'),
            'readyNext' => __('Ready to start after the latest update.', 'alt-text-pro'),
            'recordingFailed' => __('Recording the failed image and continuing.', 'alt-text-pro'),
            'resultsFailedHeading' => __('Images that failed', 'alt-text-pro'),
            // translators: %d: number of failed images not listed.
            'resultsMoreFailed' => __('And %d more.', 'alt-text-pro'),
            'resultsRetryHint' => __('Run the bulk process again to retry these images.', 'alt-text-pro'),
            // translators: 1: images processed, 2: images that got alt text, 3: images that failed.
            'resultsSummary' => __('%1$d images processed: %2$d got alt text, %3$d failed.', 'alt-text-pro'),
            'resumeRun' => __('Resuming your bulk run...', 'alt-text-pro'),
            'runCancelled' => __('The bulk run was stopped.', 'alt-text-pro'),
            'runStoppedTitle' => __('Run stopped', 'alt-text-pro'),
            'saveFailedManual' => __('Failed to save. Please try manual entry.', 'alt-text-pro'),
            'saveKeyFailed' => __('WordPress could not save the API key.', 'alt-text-pro'),
            'savingKey' => __('Account connected. Saving your key...', 'alt-text-pro'),
            'secureUnavailable' => __('Secure connection is unavailable in this browser. Use manual API key entry.', 'alt-text-pro'),
            // translators: %d: number of selected images.
            'selectedCount' => __('%d selected', 'alt-text-pro'),
            'serverUnreachable' => __('Failed to connect to server', 'alt-text-pro'),
            'skipping' => __('Skipping', 'alt-text-pro'),
            'skippingFailed' => __('Skipping failed image...', 'alt-text-pro'),
            'startFailed' => __('Failed to start bulk process', 'alt-text-pro'),
            'startingBulk' => __('Starting bulk optimization...', 'alt-text-pro'),
            'statusFailed' => __('Failed', 'alt-text-pro'),
            'statusRetrying' => __('Waiting to retry', 'alt-text-pro'),
            'statusSkipped' => __('Skipped', 'alt-text-pro'),
            'statusStoppedBefore' => __('Stopped before generation', 'alt-text-pro'),
            'statusSuccess' => __('Success', 'alt-text-pro'),
            'stopped' => __('Stopped', 'alt-text-pro'),
            'stoppedAccount' => __('Bulk processing stopped because of an account or service problem.', 'alt-text-pro'),
            'stopping' => __('Stopping', 'alt-text-pro'),
            'stoppingAfterCurrent' => __('Stopping after current image...', 'alt-text-pro'),
            'testing' => __('Testing...', 'alt-text-pro'),
            'testingConnection' => __('Testing connection...', 'alt-text-pro'),
            'testingSaved' => __('Testing saved connection...', 'alt-text-pro'),
            'unableToStop' => __('Unable to stop yet, retrying...', 'alt-text-pro'),
            'validating' => __('Validating...', 'alt-text-pro'),
            'waiting' => __('Waiting', 'alt-text-pro'),
            'waitingFirst' => __('Waiting to begin the first image.', 'alt-text-pro'),
            'waitingRateLimit' => __('Waiting for the service before retrying...', 'alt-text-pro'),
            'waitingRateLimitTask' => __('Waiting before retrying this image.', 'alt-text-pro'),
            'waitingSignIn' => __('Waiting for you to sign in...', 'alt-text-pro'),
            'working' => __('Working', 'alt-text-pro'),
        );
    }

    /**
     * Add inline script for settings page
     */
    private function add_settings_inline_script()
    {
        $inline_script = "jQuery(document).ready(function($) {
            // Export/Import logic
            $('#export-settings').on('click', function() {
                var settings = {
                    version: altTextAI.version,
                    exported_at: new Date().toISOString(),
                    settings: {
                        api_key: $('#api_key').val() ? '[CONFIGURED]' : '[NOT_CONFIGURED]',
                        auto_generate: $('#auto_generate').is(':checked'),
                        overwrite_existing: $('#overwrite_existing').is(':checked'),
                        context_enabled: $('#context_enabled').is(':checked'),
                        fill_post_content_alt: $('#fill_post_content_alt').is(':checked'),
                        email_bulk_complete: $('#email_bulk_complete').is(':checked'),
                        language: $('#language').val() || ''
                    }
                };
                var dataStr = JSON.stringify(settings, null, 2);
                var dataBlob = new Blob([dataStr], {type: 'application/json'});
                var url = URL.createObjectURL(dataBlob);
                var link = document.createElement('a');
                link.href = url;
                link.download = 'alt-text-pro-settings.json';
                link.click();
            });

            $('#import-settings').on('click', function() {
                $('#import-file').click();
            });

            $('#import-file').on('change', function(e) {
                var file = e.target.files[0];
                if (!file) return;
                var reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        var settings = JSON.parse(e.target.result);
                        if (settings.settings) {
                            if (settings.settings.auto_generate !== undefined) $('#auto_generate').prop('checked', settings.settings.auto_generate);
                            if (settings.settings.overwrite_existing !== undefined) $('#overwrite_existing').prop('checked', settings.settings.overwrite_existing);
                            if (settings.settings.context_enabled !== undefined) $('#context_enabled').prop('checked', settings.settings.context_enabled);
                            if (settings.settings.fill_post_content_alt !== undefined) $('#fill_post_content_alt').prop('checked', settings.settings.fill_post_content_alt);
                            if (settings.settings.email_bulk_complete !== undefined) $('#email_bulk_complete').prop('checked', settings.settings.email_bulk_complete);
                            if (typeof settings.settings.language === 'string' && $('#language option').filter(function() { return this.value === settings.settings.language; }).length) $('#language').val(settings.settings.language);
                            alert(altTextAI.strings.settingsImported);
                        }
                    } catch (error) {
                        alert(altTextAI.strings.invalidFile);
                    }
                };
                reader.readAsText(file);
            });
        });";

        wp_add_inline_script('alt-text-pro-admin', $inline_script);
    }

    /**
     * Add inline script for the logs page.
     */
    private function add_logs_inline_script()
    {
        // Search runs on the server (the whole history, not only this page);
        // the export link already carries the same search term.
        $inline_script = "jQuery(document).ready(function($) {
            $('.copy-alt-text').click(function() {
                var text = $(this).data('alt-text');
                navigator.clipboard.writeText(text);
                var \$btn = $(this);
                var orig = \$btn.html();
                \$btn.find('.atp-copy-label').text(altTextAI.strings.copied || 'Copied!');
                setTimeout(function(){ \$btn.html(orig); }, 1500);
            });
        });";

        wp_add_inline_script('alt-text-pro-admin', $inline_script);
    }

    /**
     * AJAX handler for generating alt-text
     */
    public function ajax_generate_alt_text()
    {
        check_ajax_referer('alt_text_pro_nonce', 'nonce');

        if (!current_user_can('upload_files')) {
            self::send_permission_error();
        }

        $attachment_id = isset($_POST['attachment_id']) ? intval($_POST['attachment_id']) : 0;
        $context = isset($_POST['context']) ? sanitize_text_field(wp_unslash($_POST['context'])) : '';

        if (!$attachment_id) {
            wp_send_json_error(esc_html__('Invalid attachment ID.', 'alt-text-pro'));
        }

        if (!current_user_can('edit_post', $attachment_id)) {
            self::send_permission_error(__('You do not have permission to edit this image.', 'alt-text-pro'));
        }

        if (!wp_attachment_is_image($attachment_id)) {
            wp_send_json_error(esc_html__('Alt Text Pro can only describe photos and other raster images (JPEG, PNG, GIF, WebP, AVIF, HEIC). SVG and other file types are not supported.', 'alt-text-pro'));
        }

        // Get blog context from settings
        $settings = get_option('alt_text_pro_settings', array());
        $blog_context = isset($settings['blog_context']) ? $settings['blog_context'] : '';

        // Generating here replaces a queued upload job for this image, so the
        // image is billed once.
        AltTextPro_Media_Handler::claim_pending_upload($attachment_id);

        $api_client = new AltTextPro_API_Client();
        $result = $api_client->generate_alt_text($attachment_id, $context, $blog_context);

        if ($result['success'] && !empty($result['alt_text'])) {
            // Keep single-image output as a reviewable draft. The user applies
            // it to WordPress explicitly from the media field.
            $this->log_generation($attachment_id, $result['alt_text'], $result['credits_used'] ?? 1);

            wp_send_json_success(array(
                'alt_text' => $result['alt_text'],
                'credits_remaining' => $result['credits_remaining'] ?? 0,
                'credits_used' => $result['credits_used'] ?? 1,
                'saved' => false
            ));
        }
        else {
            $message = $result['message'] ?? esc_html__('Failed to generate alt-text. Please check your API key and try again.', 'alt-text-pro');
            // Out of credits or a suspended account: give the browser a code
            // so it can add the buy-credits link or explain the suspension.
            if (!empty($result['no_credits']) || in_array($result['code'] ?? '', array('account_suspended', 'invalid_api_key'), true)) {
                wp_send_json_error(array(
                    'message' => $message,
                    'code' => !empty($result['no_credits']) ? 'no_credits' : sanitize_key($result['code']),
                ));
            }
            wp_send_json_error($message);
        }
    }

    /**
     * AJAX handler for getting usage stats
     */
    public function ajax_get_usage()
    {
        check_ajax_referer('alt_text_pro_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            self::send_permission_error();
        }

        $api_client = new AltTextPro_API_Client();
        $result = $api_client->get_usage_stats();

        if ($result['success']) {
            wp_send_json_success($result['data']);
        }
        else {
            wp_send_json_error($result['message']);
        }
    }

    /**
     * AJAX handler for validating API key
     */
    public function ajax_validate_key()
    {
        check_ajax_referer('alt_text_pro_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            self::send_permission_error();
        }

        $api_key = isset($_POST['api_key']) ? trim(sanitize_text_field(wp_unslash($_POST['api_key']))) : '';

        if (empty($api_key) || !AltTextPro_API_Client::validate_api_key_format($api_key)) {
            wp_send_json_error(esc_html__('Invalid API key format. API keys should start with "alt_" or "altai_".', 'alt-text-pro'));
        }

        $api_client = new AltTextPro_API_Client();
        $result = $api_client->validate_api_key($api_key);

        // The service could not check the key (outage or timeout), which is
        // not a rejection: save the well-formed key and say so.
        $unverified = empty($result['success']) && !empty($result['retryable']) && intval($result['status_code'] ?? 0) !== 401;

        if ($result['success'] || $unverified) {
            // Persist the validated key (encrypted) without altering other settings
            $existing_settings = get_option('alt_text_pro_settings', array());
            if (!is_array($existing_settings)) {
                $existing_settings = array();
            }
            $settings_handler = new AltTextPro_Settings();
            // Store the authenticated key encrypted. sanitize_settings() explicitly
            // recognizes a valid encrypted value here, so the key is not discarded
            // or encrypted again when WordPress applies the option sanitizer.
            $encrypted_key = $settings_handler->encrypt_api_key($api_key);
            if (!is_string($encrypted_key) || strpos($encrypted_key, 'enc2:') !== 0) {
                wp_send_json_error(esc_html__('Your API key was validated, but this WordPress installation could not encrypt it. Check AUTH_KEY and OpenSSL, then try again.', 'alt-text-pro'));
            }
            $existing_settings['api_key'] = $encrypted_key;
            update_option('alt_text_pro_settings', $existing_settings);

            $verified_settings = $settings_handler->get_settings();
            if (($verified_settings['api_key'] ?? '') !== $api_key) {
                // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
                error_log('Alt Text Pro: API key validated but could not be read back after save.');
                wp_send_json_error(esc_html__('Your API key was validated, but WordPress could not save it. Please try again or check your site configuration.', 'alt-text-pro'));
            }

            $response_data = isset($result['data']) && is_array($result['data']) ? $result['data'] : array();
            $response_data['saved'] = true;
            $response_data['verified'] = !$unverified;
            $response_data['message'] = $unverified
                ? esc_html__('API key saved. Alt Text Pro could not confirm it right now; use "Test" on the Settings page in a few minutes.', 'alt-text-pro')
                : esc_html__('API key validated and saved successfully.', 'alt-text-pro');

            wp_send_json_success($response_data);
        }
        else {
            wp_send_json_error($result['message']);
        }
    }

    /**
     * Log alt-text generation
     */
    private function log_generation($attachment_id, $alt_text, $credits_used = 1)
    {
        global $wpdb;

        $table_name = $wpdb->prefix . 'alt_text_pro_logs';

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $wpdb->insert(
            $table_name,
            array(
            'attachment_id' => $attachment_id,
            'alt_text' => $alt_text,
            'credits_used' => $credits_used,
            'created_at' => current_time('mysql')
        ),
            array('%d', '%s', '%d', '%s')
        );
    }

    /**
     * Add "Alt Text" column to posts/pages list table
     */
    public function add_alt_text_column($columns)
    {
        $columns['alt_text_pro'] = __('Alt Text', 'alt-text-pro');
        return $columns;
    }

    /**
     * Render the "Alt Text" column content for each post/page
     */
    public function render_alt_text_column($column, $post_id)
    {
        if ($column !== 'alt_text_pro') {
            return;
        }

        $permission_skipped_ids = array();
        $attachments = $this->get_post_image_attachments($post_id, $permission_skipped_ids);
        $permission_warning = $this->get_attachment_permission_warning($permission_skipped_ids);
        $total = count($attachments) + count($permission_skipped_ids);

        if ($total === 0) {
            echo '<span class="atp-post-status atp-no-images">— ' . esc_html__('No images', 'alt-text-pro') . '</span>';
            return;
        }

        // Count images missing alt-text
        $missing = 0;
        foreach ($attachments as $att_id) {
            $alt = get_post_meta($att_id, '_wp_attachment_image_alt', true);
            if (empty($alt)) {
                $missing++;
            }
        }

        // Images whose Media Library alt is filled but whose <img> in the
        // post still has an empty or missing alt (for example after a bulk
        // run). The same button copies the alt text into the post.
        $content_to_fill = $missing === 0 ? $this->count_post_content_images_to_fill($post_id, $attachments) : 0;

        if ($missing === 0 && $content_to_fill > 0) {
            printf(
                '<span class="atp-post-actions"><button type="button" class="button atp-post-generate-btn" data-post-id="%d" data-nonce="%s" data-mode="sync" title="%s">
                    <span class="dashicons dashicons-images-alt2" aria-hidden="true"></span>
                    <span class="atp-btn-text">%s</span>
                </button></span>',
                intval($post_id),
                esc_attr(wp_create_nonce('alt_text_pro_nonce')),
                /* translators: %d: number of images in the post content with empty alt text */
                esc_attr(sprintf(_n('%d image in the post has empty alt text', '%d images in the post have empty alt text', $content_to_fill, 'alt-text-pro'), $content_to_fill)),
                esc_html__('Copy alt text into post', 'alt-text-pro')
            );
            echo '<span class="atp-post-status atp-post-warning">' . esc_html(sprintf(
                /* translators: %d: number of images in the post content with empty alt text */
                _n('%d image in the post has empty alt text. No credits needed.', '%d images in the post have empty alt text. No credits needed.', $content_to_fill, 'alt-text-pro'),
                $content_to_fill
            )) . '</span>';

            if ($permission_warning) {
                echo '<span class="atp-post-status atp-post-warning">⚠ ' . esc_html($permission_warning['message']) . '</span>';
            }
            return;
        }

        if ($missing === 0) {
            if ($permission_warning) {
                echo '<span class="atp-post-status atp-post-warning">⚠ ' . esc_html($permission_warning['message']) . '</span>';
            }
            else {
                echo '<span class="atp-post-status atp-all-done">✓ ' . esc_html__('All done', 'alt-text-pro') . '</span>';
            }
            return;
        }

        // Show the button
        printf(
            '<span class="atp-post-actions"><button type="button" class="button atp-post-generate-btn" data-post-id="%d" data-nonce="%s" title="%s">
                <span class="dashicons dashicons-images-alt2" aria-hidden="true"></span>
                <span class="atp-btn-text">%s</span>
            </button>
            <span class="atp-post-badge">%d/%d</span></span>',
            intval($post_id),
            esc_attr(wp_create_nonce('alt_text_pro_nonce')),
            /* translators: %d: number of images missing alt-text */
            esc_attr(sprintf(__('%d image(s) missing alt-text', 'alt-text-pro'), $missing)),
            esc_html__('Add Alt Text', 'alt-text-pro'),
            intval($missing),
            intval($total)
        );

        if ($permission_warning) {
            echo '<span class="atp-post-status atp-post-warning">⚠ ' . esc_html($permission_warning['message']) . '</span>';
        }
    }

    /**
     * Get all image attachment IDs used in a post (content images + featured image)
     */
    private function get_post_image_attachments($post_id, &$permission_skipped_ids = null)
    {
        $attachment_ids = array();
        $post = get_post($post_id);

        if (is_array($permission_skipped_ids)) {
            $permission_skipped_ids = array();
        }

        if (!$post) {
            return $attachment_ids;
        }

        // 1. Featured image
        $thumbnail_id = get_post_thumbnail_id($post_id);
        if ($thumbnail_id) {
            $attachment_ids[] = intval($thumbnail_id);
        }

        // WooCommerce product gallery (comma-separated attachment IDs).
        $gallery = get_post_meta($post_id, '_product_image_gallery', true);
        if (is_string($gallery) && $gallery !== '') {
            foreach (explode(',', $gallery) as $gallery_id) {
                $gallery_id = absint($gallery_id);
                if ($gallery_id) {
                    $attachment_ids[] = $gallery_id;
                }
            }
        }

        // 2. Images in post content — match wp-image-{id} class pattern
        if (!empty($post->post_content)) {
            // Match WordPress image classes like wp-image-123
            if (preg_match_all('/wp-image-(\d+)/', $post->post_content, $matches)) {
                foreach ($matches[1] as $id) {
                    $attachment_ids[] = intval($id);
                }
            }

            // Also match <img> tags that reference attachment IDs via data attributes
            if (preg_match_all('/data-id=["\'](\d+)["\']/', $post->post_content, $matches)) {
                foreach ($matches[1] as $id) {
                    $attachment_ids[] = intval($id);
                }
            }
        }

        // 3. Remove duplicates and verify they are valid attachments
        $attachment_ids = array_unique($attachment_ids);
        $valid_ids = array();
        foreach ($attachment_ids as $att_id) {
            // wp_attachment_is_image() is false for SVG and other non-raster
            // files, which cannot be described.
            if (!wp_attachment_is_image($att_id)) {
                continue;
            }

            if (current_user_can('edit_post', $att_id)) {
                $valid_ids[] = intval($att_id);
            }
            elseif (is_array($permission_skipped_ids)) {
                $permission_skipped_ids[] = intval($att_id);
            }
        }

        return $valid_ids;
    }

    /**
     * Build a structured warning for image attachments excluded by the
     * per-media edit permission check.
     */
    private function get_attachment_permission_warning(array $attachment_ids)
    {
        $attachment_ids = array_values(array_unique(array_map('intval', $attachment_ids)));

        if (empty($attachment_ids)) {
            return null;
        }

        return array(
            'code' => 'insufficient_attachment_permissions',
            'message' => sprintf(
                __('%d image(s) skipped because you do not have permission to edit them.', 'alt-text-pro'),
                count($attachment_ids)
            ),
            'attachment_ids' => $attachment_ids,
        );
    }

    /**
     * Fill empty image alt attributes in post content from the Media Library.
     *
     * Only an alt that is missing or empty in the post is filled. An alt the
     * author wrote in the post (block attributes or <img> markup) is kept.
     */
    private function sync_post_content_image_alt_text($post_content, array $content_updates)
    {
        if (empty($post_content) || empty($content_updates)) {
            return $post_content;
        }

        if (
            function_exists('parse_blocks')
            && function_exists('serialize_block')
            && strpos($post_content, '<!-- wp:') !== false
        ) {
            $blocks = parse_blocks($post_content);

            if (is_array($blocks) && !empty($blocks)) {
                $did_update_blocks = false;

                foreach ($blocks as $index => $block) {
                    $blocks[$index] = $this->sync_image_block_alt_text($block, $content_updates, $did_update_blocks);
                }

                // parse_blocks() keeps the HTML between blocks as freeform
                // blocks, so every image was already visited above.
                if (!$did_update_blocks) {
                    return $post_content;
                }

                $serialized = '';
                foreach ($blocks as $block) {
                    $serialized .= serialize_block($block);
                }

                return $serialized;
            }
        }

        return $this->sync_html_image_alt_text($post_content, $content_updates);
    }

    /**
     * True when a block attribute alt value counts as empty.
     */
    private function is_empty_alt_value($value)
    {
        return is_scalar($value) && trim((string) $value) === '';
    }

    /**
     * Recursively fill empty Gutenberg alt attributes and image markup.
     */
    private function sync_image_block_alt_text(array $block, array $content_updates, &$did_update_blocks)
    {
        // Updates that apply to this block's markup and inner blocks. An image
        // whose block attributes carry an author-written alt is removed so its
        // markup is left alone as well.
        $block_updates = $content_updates;

        if (!empty($block['attrs']) && is_array($block['attrs'])) {
            foreach (array('id' => 'alt', 'mediaId' => 'mediaAlt') as $id_key => $alt_key) {
                if (!isset($block['attrs'][$id_key]) || !is_scalar($block['attrs'][$id_key])) {
                    continue;
                }

                $attachment_id = intval($block['attrs'][$id_key]);
                if (!isset($content_updates[$attachment_id])) {
                    continue;
                }

                // Core image blocks read alt from the <img> markup. Only fill a
                // comment attribute that already exists; adding one would
                // re-save every post for no change.
                if (!array_key_exists($alt_key, $block['attrs'])) {
                    continue;
                }

                if ($this->is_empty_alt_value($block['attrs'][$alt_key])) {
                    $block['attrs'][$alt_key] = (string) $content_updates[$attachment_id];
                    $did_update_blocks = true;
                } else {
                    unset($block_updates[$attachment_id]);
                }
            }

            if (!empty($block['attrs']['images']) && is_array($block['attrs']['images'])) {
                foreach ($block['attrs']['images'] as $image_index => $image_attrs) {
                    if (
                        !is_array($image_attrs)
                        || !isset($image_attrs['id'])
                        || !is_scalar($image_attrs['id'])
                        || !array_key_exists('alt', $image_attrs)
                    ) {
                        continue;
                    }

                    $attachment_id = intval($image_attrs['id']);
                    if (!isset($content_updates[$attachment_id])) {
                        continue;
                    }

                    if ($this->is_empty_alt_value($image_attrs['alt'])) {
                        $block['attrs']['images'][$image_index]['alt'] = (string) $content_updates[$attachment_id];
                        $did_update_blocks = true;
                    } else {
                        unset($block_updates[$attachment_id]);
                    }
                }
            }
        }

        if (empty($block_updates)) {
            return $block;
        }

        if (!empty($block['innerBlocks']) && is_array($block['innerBlocks'])) {
            foreach ($block['innerBlocks'] as $index => $inner_block) {
                $block['innerBlocks'][$index] = $this->sync_image_block_alt_text($inner_block, $block_updates, $did_update_blocks);
            }
        }

        if (!empty($block['innerHTML']) && is_string($block['innerHTML'])) {
            $updated_inner_html = $this->sync_html_image_alt_text($block['innerHTML'], $block_updates);
            if ($updated_inner_html !== $block['innerHTML']) {
                $block['innerHTML'] = $updated_inner_html;
                $did_update_blocks = true;
            }
        }

        if (!empty($block['innerContent']) && is_array($block['innerContent'])) {
            foreach ($block['innerContent'] as $index => $inner_content) {
                if (!is_string($inner_content) || stripos($inner_content, '<img') === false) {
                    continue;
                }

                $updated_inner_content = $this->sync_html_image_alt_text($inner_content, $block_updates);
                if ($updated_inner_content !== $inner_content) {
                    $block['innerContent'][$index] = $updated_inner_content;
                    $did_update_blocks = true;
                }
            }
        }

        return $block;
    }

    /**
     * Find the alt attribute of an <img> tag.
     *
     * Attributes are read left to right so text inside another attribute's
     * quoted value (for example title="the alt text") is never mistaken for
     * an alt attribute.
     *
     * @return array|null array('offset' => int, 'length' => int, 'value' => string) or null.
     */
    private function find_img_alt_attribute($image_tag)
    {
        if (!preg_match_all(
            '/\s+([^\s=\/>"\']+)(?:\s*=\s*("[^"]*"|\'[^\']*\'|[^\s"\'>]+))?/',
            $image_tag,
            $attributes,
            PREG_SET_ORDER | PREG_OFFSET_CAPTURE,
            4
        )) {
            return null;
        }

        foreach ($attributes as $attribute) {
            if (strtolower($attribute[1][0]) !== 'alt') {
                continue;
            }

            $value = '';
            if (isset($attribute[2]) && $attribute[2][1] !== -1) {
                $value = $attribute[2][0];
                $first = substr($value, 0, 1);
                if (($first === '"' || $first === "'") && strlen($value) >= 2) {
                    $value = substr($value, 1, -1);
                }
            }

            return array(
                'offset' => $attribute[0][1],
                'length' => strlen($attribute[0][0]),
                'value' => html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8'),
            );
        }

        return null;
    }

    /**
     * Attachment ID an <img> tag refers to (wp-image-{ID} class or data-id),
     * or 0.
     */
    private function get_img_tag_attachment_id($image_tag)
    {
        $id_patterns = array(
            '/\bwp-image-(\d+)\b/i',
            '/\bdata-id\s*=\s*["\'](\d+)["\']/i',
            '/\bdata-attachment-id\s*=\s*["\'](\d+)["\']/i',
        );

        foreach ($id_patterns as $pattern) {
            if (preg_match($pattern, $image_tag, $id_match)) {
                return intval($id_match[1]);
            }
        }

        return 0;
    }

    /**
     * Attachment IDs of <img> tags in the HTML whose alt is missing or empty,
     * one entry per tag.
     *
     * @return int[]
     */
    private function get_content_empty_alt_attachment_ids($html)
    {
        $ids = array();
        if (!is_string($html) || stripos($html, '<img') === false) {
            return $ids;
        }

        if (!preg_match_all('/<img\b[^>]*>/i', $html, $matches)) {
            return $ids;
        }

        foreach ($matches[0] as $image_tag) {
            $attachment_id = $this->get_img_tag_attachment_id($image_tag);
            if (!$attachment_id) {
                continue;
            }

            $alt = $this->find_img_alt_attribute($image_tag);
            if ($alt !== null && trim($alt['value']) !== '') {
                continue;
            }

            $ids[] = $attachment_id;
        }

        return $ids;
    }

    /**
     * Number of <img> tags in the post that have an empty or missing alt
     * while their Media Library image (one the user may edit) has alt text.
     *
     * @param int   $post_id     Post to inspect.
     * @param int[] $attachments Editable image attachments of the post.
     */
    private function count_post_content_images_to_fill($post_id, array $attachments)
    {
        $post = get_post($post_id);
        if (!$post || empty($post->post_content) || empty($attachments)) {
            return 0;
        }

        $editable = array_flip(array_map('intval', $attachments));
        $count = 0;
        foreach ($this->get_content_empty_alt_attachment_ids($post->post_content) as $attachment_id) {
            if (!isset($editable[$attachment_id])) {
                continue;
            }

            $library_alt = (string) get_post_meta($attachment_id, '_wp_attachment_image_alt', true);
            if (trim($library_alt) !== '') {
                $count++;
            }
        }

        return $count;
    }

    /**
     * True when WordPress offers the wp_content_img_tag filter (6.0+).
     */
    public static function supports_content_img_tag_filter()
    {
        global $wp_version;

        return isset($wp_version) && version_compare((string) $wp_version, '6.0', '>=');
    }

    /**
     * Front end (wp_content_img_tag): give an image in post content the alt
     * text of its Media Library attachment when the post's own alt is empty
     * or missing. Alt text written in the post is never replaced, and the
     * stored post is not changed.
     *
     * @param string $filtered_image Full <img> tag.
     * @param string $context        Where the content comes from.
     * @param int    $attachment_id  Attachment from the wp-image-{ID} class, or 0.
     * @return string
     */
    public function fill_content_image_alt($filtered_image, $context = '', $attachment_id = 0)
    {
        $attachment_id = absint($attachment_id);
        if (!$attachment_id || !is_string($filtered_image) || !AltTextPro_Settings::is_enabled('fill_post_content_alt')) {
            return $filtered_image;
        }

        $current = $this->find_img_alt_attribute($filtered_image);
        if ($current !== null && trim($current['value']) !== '') {
            return $filtered_image;
        }

        $library_alt = trim((string) get_post_meta($attachment_id, '_wp_attachment_image_alt', true));
        if ($library_alt === '') {
            return $filtered_image;
        }

        return $this->sync_html_image_alt_text($filtered_image, array($attachment_id => $library_alt));
    }

    /**
     * Fill missing or empty image alt attributes in raw HTML (classic content
     * and block markup). Non-empty alt text is never replaced.
     */
    private function sync_html_image_alt_text($html, array $content_updates)
    {
        if (!is_string($html) || $html === '' || empty($content_updates)) {
            return $html;
        }

        $updated = preg_replace_callback(
            '/<img\b[^>]*>/i',
            function ($matches) use ($content_updates) {
                $image_tag = $matches[0];
                $attachment_id = $this->get_img_tag_attachment_id($image_tag);

                if (!$attachment_id || !isset($content_updates[$attachment_id])) {
                    return $image_tag;
                }

                $new_alt = (string) $content_updates[$attachment_id];
                if (trim($new_alt) === '') {
                    return $image_tag;
                }

                $alt_attribute = ' alt="' . esc_attr($new_alt) . '"';
                $current = $this->find_img_alt_attribute($image_tag);

                if ($current !== null) {
                    // The author's alt text in the post always wins.
                    if (trim($current['value']) !== '') {
                        return $image_tag;
                    }

                    // Replace the empty alt in place, keeping attribute order.
                    return substr($image_tag, 0, $current['offset'])
                        . $alt_attribute
                        . substr($image_tag, $current['offset'] + $current['length']);
                }

                if (!preg_match('/\s*(\/?>)$/', $image_tag, $closing, PREG_OFFSET_CAPTURE)) {
                    return $image_tag;
                }

                return substr($image_tag, 0, $closing[0][1])
                    . $alt_attribute
                    . ($closing[1][0] === '/>' ? ' />' : '>');
            },
            $html
        );

        return is_string($updated) ? $updated : $html;
    }

    /**
     * Fill empty in-post alt attributes for the given images from their Media
     * Library alt text, and save the post only when its content changed.
     *
     * @param int   $post_id     Post to update.
     * @param int[] $attachments Image attachments the current user may edit.
     * @param array $results     Response data; receives content_synced or content_update_error.
     */
    private function sync_post_images_from_library($post_id, array $attachments, array &$results)
    {
        $content_updates = array();
        foreach ($attachments as $attachment_id) {
            $library_alt = (string) get_post_meta($attachment_id, '_wp_attachment_image_alt', true);
            if (trim($library_alt) !== '') {
                $content_updates[intval($attachment_id)] = $library_alt;
            }
        }

        $results['content_synced'] = true;

        if (empty($content_updates)) {
            return;
        }

        $post = get_post($post_id);
        if (!$post || empty($post->post_content)) {
            return;
        }

        $content = $this->sync_post_content_image_alt_text($post->post_content, $content_updates);
        if ($content === $post->post_content) {
            return;
        }

        $filled = max(
            0,
            count($this->get_content_empty_alt_attachment_ids($post->post_content))
                - count($this->get_content_empty_alt_attachment_ids($content))
        );

        // Save the updated content back to the post only when it actually changed.
        // wp_update_post() expects slashed data and unslashes it once;
        // without wp_slash() every backslash in the post (block JSON
        // escapes such as <, code samples) would be stripped.
        $update_result = wp_update_post(wp_slash(array(
            'ID' => $post_id,
            'post_content' => $content,
        )), true);

        if (is_wp_error($update_result) || !$update_result) {
            $results['content_synced'] = false;
            $results['content_update_error'] = __('Alt text was saved to the Media Library, but the post content could not be updated automatically.', 'alt-text-pro');
            return;
        }

        $results['content_filled'] = $filled;
    }

    /**
     * AJAX handler for generating alt-text for the images in a specific post.
     *
     * Each request generates at most POST_GENERATIONS_PER_REQUEST images and
     * reports how many are left; the posts list calls it until "done". The
     * post content is synced on the final request, or on a "sync_only"
     * request the browser sends when a run is interrupted.
     */
    public function ajax_generate_post_alt_text()
    {
        check_ajax_referer('alt_text_pro_nonce', 'nonce');

        if (!current_user_can('upload_files')) {
            wp_send_json_error(__('You do not have permission to perform this action.', 'alt-text-pro'));
        }

        $post_id = isset($_POST['post_id']) ? intval($_POST['post_id']) : 0;

        if (!$post_id || !get_post($post_id)) {
            wp_send_json_error(__('Invalid post.', 'alt-text-pro'));
        }

        if (!current_user_can('edit_post', $post_id)) {
            wp_send_json_error(__('You do not have permission to edit this post.', 'alt-text-pro'));
        }

        $sync_only = !empty($_POST['sync_only']);
        $defer_sync = !empty($_POST['defer_sync']);

        // Images that already failed earlier in this run are not retried, so
        // one broken image cannot keep the browser loop going.
        $failed_ids = array();
        if (isset($_POST['failed_ids']) && is_array($_POST['failed_ids'])) {
            $failed_ids = array_slice(array_values(array_filter(array_map('absint', wp_unslash($_POST['failed_ids'])))), 0, 1000);
        }

        $permission_skipped_ids = array();
        $attachments = $this->get_post_image_attachments($post_id, $permission_skipped_ids);
        $permission_warning = $this->get_attachment_permission_warning($permission_skipped_ids);
        $total_attachments = count($attachments) + count($permission_skipped_ids);

        if ($total_attachments === 0) {
            wp_send_json_error(__('No images found in this post.', 'alt-text-pro'));
        }

        $settings = get_option('alt_text_pro_settings', array());
        $results = array(
            'total' => $total_attachments,
            'processable' => count($attachments),
            'processed' => 0,
            'skipped' => 0,
            'permission_skipped' => count($permission_skipped_ids),
            'skipped_attachment_ids' => $permission_skipped_ids,
            'errors' => 0,
            'remaining' => 0,
            'done' => false,
            'content_synced' => false,
            'details' => array(),
            'warnings' => $permission_warning ? array($permission_warning) : array(),
        );

        if (!$sync_only) {
            $api_client = null;
            $generations = 0;
            $blog_context = isset($settings['blog_context']) ? (string) $settings['blog_context'] : '';
            $context = '';
            if (!empty($settings['context_enabled'])) {
                $context = (string) get_the_title($post_id);
                $context = trim(wp_strip_all_tags(html_entity_decode($context, ENT_QUOTES | ENT_HTML5, 'UTF-8')));
            }

            foreach ($attachments as $attachment_id) {
                // Waiting on the Review page: never generate (or bill) again.
                if (AltTextPro_Review::has_suggestion($attachment_id)) {
                    $results['skipped']++;
                    $results['details'][] = array(
                        'id' => $attachment_id,
                        'status' => 'skipped',
                        'message' => __('Suggested alt text is waiting for review.', 'alt-text-pro')
                    );
                    continue;
                }

                // Check if already has alt-text
                $existing_alt = get_post_meta($attachment_id, '_wp_attachment_image_alt', true);

                if (!empty($existing_alt)) {
                    $results['skipped']++;
                    $results['details'][] = array(
                        'id' => $attachment_id,
                        'status' => 'skipped',
                        'message' => __('Already has alt-text', 'alt-text-pro')
                    );
                    continue;
                }

                if (in_array(intval($attachment_id), $failed_ids, true)) {
                    continue;
                }

                // Leave the rest for the next request (or for a later run once
                // credits are available again).
                if ($generations >= self::POST_GENERATIONS_PER_REQUEST || !empty($results['no_credits']) || !empty($results['stopped'])) {
                    $results['remaining']++;
                    continue;
                }

                $generations++;

                if (!wp_get_attachment_url($attachment_id)) {
                    $results['errors']++;
                    $results['details'][] = array(
                        'id' => $attachment_id,
                        'status' => 'error',
                        'message' => __('Could not get image URL', 'alt-text-pro')
                    );
                    continue;
                }

                if ($api_client === null) {
                    $api_client = new AltTextPro_API_Client();
                }

                // Replaces a queued upload job for this image (billed once).
                AltTextPro_Media_Handler::claim_pending_upload($attachment_id);

                $result = $api_client->generate_alt_text($attachment_id, $context, $blog_context);
                $alt_text = sanitize_text_field((string) ($result['alt_text'] ?? ''));

                if (!empty($result['success']) && $alt_text !== '' && AltTextPro_Review::is_enabled()) {
                    // "Review alt text before it goes live": a suggestion only.
                    AltTextPro_Review::store_suggestion($attachment_id, $alt_text, 'post', '', $result['credits_used'] ?? 1);
                    $results['processed']++;
                    $results['details'][] = array(
                        'id' => $attachment_id,
                        'status' => 'suggested',
                        'alt_text' => $alt_text
                    );
                    continue;
                }

                if (!empty($result['success']) && $alt_text !== '') {
                    update_post_meta($attachment_id, '_wp_attachment_image_alt', $alt_text);
                    $this->log_generation($attachment_id, $alt_text, $result['credits_used'] ?? 1);

                    $results['processed']++;
                    $results['details'][] = array(
                        'id' => $attachment_id,
                        'status' => 'success',
                        'alt_text' => $alt_text
                    );
                    continue;
                }

                $results['errors']++;
                $results['details'][] = array(
                    'id' => $attachment_id,
                    'status' => 'error',
                    'message' => isset($result['message']) ? $result['message'] : __('Failed to generate alt-text', 'alt-text-pro')
                );

                // Out of credits: stop instead of calling the API for every
                // remaining image. Images already done are still synced below.
                if (!empty($result['no_credits']) || (isset($result['status_code']) && intval($result['status_code']) === 402)) {
                    $results['no_credits'] = true;
                    $results['warnings'][] = array(
                        'code' => 'no_credits',
                        'message' => __('You ran out of credits. Buy a credit pack or upgrade your plan at alt-text.pro, then run this again.', 'alt-text-pro'),
                    );
                } elseif (!empty($result['stop_bulk'])) {
                    // Invalid key, suspended or missing account: every other
                    // image would fail the same way.
                    $results['stopped'] = true;
                    $results['warnings'][] = array(
                        'code' => sanitize_key($result['code'] ?? 'account_error'),
                        'message' => (string) ($result['message'] ?? __('Alt Text Pro stopped because of an account problem.', 'alt-text-pro')),
                    );
                }
            }
        }

        $results['done'] = $sync_only || !empty($results['no_credits']) || !empty($results['stopped']) || $results['remaining'] === 0;

        // Say where alt text waiting for approval can be found.
        $pending_review = 0;
        foreach ($attachments as $attachment_id) {
            if (AltTextPro_Review::has_suggestion($attachment_id)) {
                $pending_review++;
            }
        }
        if ($pending_review > 0) {
            $results['warnings'][] = array(
                'code' => 'review',
                'message' => sprintf(
                    /* translators: %d: number of images */
                    _n('%d image in this post has suggested alt text waiting on the Alt Text Pro Review page.', '%d images in this post have suggested alt text waiting on the Alt Text Pro Review page.', $pending_review, 'alt-text-pro'),
                    $pending_review
                ),
            );
        }

        // Keep the post in step with the Media Library: on the final request,
        // on an explicit sync request, or on every request when the caller
        // does not batch.
        if ($results['done'] || !$defer_sync) {
            $this->sync_post_images_from_library($post_id, $attachments, $results);
        }

        wp_send_json_success($results);
    }

    /**
     * Add inline script for posts list page interactions
     */
    private function add_posts_list_inline_script()
    {
        wp_add_inline_script('alt-text-pro-admin', '
            (function($) {
                "use strict";

                function appendPostWarnings($container, data) {
                    var warnings = Array.isArray(data.warnings) ? data.warnings : [];

                    if (!warnings.length && data.permission_skipped > 0 && altTextAI.strings.postPermissionWarning) {
                        warnings = [{
                            "message": altTextAI.strings.postPermissionWarning.replace("%d", data.permission_skipped)
                        }];
                    }

                    $.each(warnings, function(index, warning) {
                        var message = typeof warning === "string" ? warning : (warning && warning.message);
                        if (!message) return;

                        var $warning = $("<div>", {
                            "class": "atp-post-status atp-post-warning",
                            "text": "⚠ " + message
                        }).appendTo($container);

                        if (warning && warning.code === "no_credits" && altTextAI.pricingUrl) {
                            $warning.append(" ").append($("<a>", {
                                "href": altTextAI.pricingUrl,
                                "target": "_blank",
                                "rel": "noopener noreferrer",
                                "text": altTextAI.strings.buyCredits
                            }));
                        }
                    });
                }

                $(document).on("click", ".atp-post-generate-btn", function(e) {
                    e.preventDefault();
                    var $btn = $(this);
                    var postId = $btn.data("post-id");
                    var nonce = $btn.data("nonce");
                    var syncOnly = $btn.data("mode") === "sync";
                    var $cell = $btn.closest("td");
                    var processed = 0;
                    var errors = 0;
                    var failedIds = [];
                    var requests = 0;
                    var runTotal = null;

                    // Prevent double-click
                    if ($btn.prop("disabled")) return;

                    // Show loading state
                    $btn.prop("disabled", true).removeClass("atp-btn-has-error");
                    $btn.find(".atp-btn-text").text(altTextAI.strings.postGenerating);
                    $btn.find(".dashicons").removeClass("dashicons-images-alt2 dashicons-warning").addClass("dashicons-update atp-spin");

                    function resetButton() {
                        $btn.prop("disabled", false);
                        $btn.find(".dashicons").removeClass("dashicons-update atp-spin").addClass("dashicons-images-alt2");
                        $btn.find(".atp-btn-text").text(syncOnly ? altTextAI.strings.postSyncToPost : altTextAI.strings.postAddAltText);
                    }

                    function showProgress() {
                        if (!altTextAI.strings.postProgress || !runTotal) return;
                        $btn.find(".atp-btn-text").text(
                            altTextAI.strings.postProgress
                                .replace("%1$d", Math.min(processed + errors, runTotal))
                                .replace("%2$d", runTotal)
                        );
                    }

                    function showContentUpdateError(data) {
                        if (!data || !data.content_update_error) return;
                        $cell.append(
                            $("<div>", {
                                "class": "atp-post-status atp-post-warning"
                            }).text(data.content_update_error)
                        );
                    }

                    // A request failed part-way through: make sure the images
                    // generated so far still reach the post, then report.
                    function fail(message) {
                        function report(syncData) {
                            resetButton();
                            showContentUpdateError(syncData);
                            alert(message || altTextAI.strings.postError);
                        }

                        if (processed === 0) {
                            report(null);
                            return;
                        }

                        $.ajax({
                            url: altTextAI.ajaxUrl,
                            type: "POST",
                            data: {
                                action: "alt_text_pro_generate_post",
                                nonce: nonce,
                                post_id: postId,
                                sync_only: 1
                            }
                        }).done(function(response) {
                            report(response && response.success ? response.data : null);
                        }).fail(function() {
                            report(null);
                        });
                    }

                    function finish(data) {
                        var permissionSkipped = data.permission_skipped || 0;

                        if (processed === 0 && data.content_filled > 0) {
                            $cell.html("<span class=\"atp-post-status atp-all-done\"></span>");
                            $cell.find(".atp-all-done").text("✓ " + altTextAI.strings.postContentFilled.replace("%d", data.content_filled));
                        } else if (processed > 0) {
                            var msg = altTextAI.strings.postSuccess.replace("%d", processed);
                            $cell.html("<span class=\"atp-post-status atp-all-done\"></span>");
                            $cell.find(".atp-all-done").text("✓ " + msg);
                            if (errors > 0 && altTextAI.strings.postErrors) {
                                appendPostWarnings($cell, { "warnings": [altTextAI.strings.postErrors.replace("%d", errors)] });
                            }
                        } else if (!data.no_credits && errors === 0 && permissionSkipped > 0) {
                            // Do not present a permission-only result as a successful completion.
                            $cell.empty();
                        } else if (!data.no_credits && errors === 0) {
                            $cell.html("<span class=\"atp-post-status atp-all-done\"></span>");
                            $cell.find(".atp-all-done").text("✓ " + altTextAI.strings.postAllDone);
                        } else if (data.no_credits || data.stopped) {
                            resetButton();
                        } else {
                            // Every attempted image failed.
                            $btn.prop("disabled", false);
                            $btn.find(".dashicons").removeClass("dashicons-update atp-spin").addClass("dashicons-warning");
                            $btn.find(".atp-btn-text").text(altTextAI.strings.postErrors ? altTextAI.strings.postErrors.replace("%d", errors) : (errors + " error(s)"));
                            $btn.addClass("atp-btn-has-error");
                        }

                        showContentUpdateError(data);
                        appendPostWarnings($cell, data);
                    }

                    function step() {
                        requests++;
                        $.ajax({
                            url: altTextAI.ajaxUrl,
                            type: "POST",
                            data: {
                                action: "alt_text_pro_generate_post",
                                nonce: nonce,
                                post_id: postId,
                                defer_sync: 1,
                                sync_only: syncOnly ? 1 : 0,
                                failed_ids: failedIds
                            },
                            success: function(response) {
                                if (!response || !response.success) {
                                    fail(response && typeof response.data === "string" ? response.data : altTextAI.strings.postError);
                                    return;
                                }

                                var data = response.data || {};
                                var stepProcessed = data.processed || 0;
                                var stepErrors = data.errors || 0;
                                processed += stepProcessed;
                                errors += stepErrors;

                                $.each(data.details || [], function(index, detail) {
                                    if (detail && detail.status === "error" && failedIds.indexOf(detail.id) === -1) {
                                        failedIds.push(detail.id);
                                    }
                                });

                                if (runTotal === null) {
                                    runTotal = processed + errors + (data.remaining || 0);
                                }

                                if (data.done) {
                                    finish(data);
                                    return;
                                }

                                // Guard against a loop that makes no progress.
                                if (stepProcessed + stepErrors === 0 || requests >= 500) {
                                    fail(altTextAI.strings.postError);
                                    return;
                                }

                                showProgress();
                                step();
                            },
                            error: function(xhr) {
                                var json = xhr && xhr.responseJSON;
                                fail(json && typeof json.data === "string" ? json.data : altTextAI.strings.postError);
                            }
                        });
                    }

                    step();
                });
            })(jQuery);
        ');
    }
}

// Initialize the plugin
AltTextPro::get_instance();
