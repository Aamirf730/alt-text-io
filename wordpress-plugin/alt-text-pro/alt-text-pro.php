<?php
/**
 * Plugin Name: Alt Text Pro
 * Plugin URI: https://www.alt-text.pro
 * Description: Draft AI alt text for WordPress images, review it, and fill missing Media Library alt attributes in small batches.
 * Version:           1.7.27
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
define('ALT_TEXT_PRO_VERSION', '1.7.27');
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

            // Posts list columns
            add_filter('manage_posts_columns', array($this, 'add_alt_text_column'));
            add_filter('manage_pages_columns', array($this, 'add_alt_text_column'));
            add_action('manage_posts_custom_column', array($this, 'render_alt_text_column'), 10, 2);
            add_action('manage_pages_custom_column', array($this, 'render_alt_text_column'), 10, 2);
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
        // Create database tables if needed
        $this->create_tables();
        update_option('alt_text_pro_db_version', self::DB_VERSION, true);

        // Set default options
        if (!get_option('alt_text_pro_settings')) {
            add_option('alt_text_pro_settings', array(
                'api_key' => '',
                'auto_generate' => false,
                'overwrite_existing' => false,
                'context_enabled' => true,
                'batch_size' => 1
            ));
        }

        // Clear any scheduled events for bulk processing
        wp_clear_scheduled_hook('alt_text_pro_bulk_process_batch');
        wp_clear_scheduled_hook('alt_text_pro_generate_background');

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
        wp_clear_scheduled_hook('alt_text_pro_generate_background');
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

        // Localize script
        $settings_handler = new AltTextPro_Settings();
        $settings = $settings_handler->get_settings();
        $has_valid_key = !empty($settings['api_key'])
            && AltTextPro_API_Client::validate_api_key_format($settings['api_key']);
        $show_onboarding = !$has_valid_key;

        wp_localize_script('alt-text-pro-admin', 'altTextAI', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('alt_text_pro_nonce'),
            'version' => ALT_TEXT_PRO_VERSION,
            'settings' => array(
                'batch_size' => 1
            ),
            'onboarding' => array(
                'show' => (bool)$show_onboarding,
                'modalId' => 'alt-text-pro-onboarding-modal',
                'dashboardUrl' => 'https://www.alt-text.pro/dashboard',
                'connectUrl' => 'https://www.alt-text.pro/connect',
                'settingsUrl' => admin_url('admin.php?page=alt-text-pro-settings'),
            ),
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
                'postAddAltText' => __('Add Alt Text', 'alt-text-pro')
            )
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
                        batch_size: parseInt($('#batch_size').val())
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
                            if (settings.settings.batch_size !== undefined) $('#batch_size').val(settings.settings.batch_size);
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
        $inline_script = "jQuery(document).ready(function($) {
            var \$export = $('#export-logs');
            var exportBase = \$export.attr('href') || '';

            $('#search-logs').on('input', function() {
                var raw = $(this).val();
                var term = raw.toLowerCase();
                $('.log-row').each(function() {
                    $(this).toggle(String($(this).data('alt-text')).includes(term));
                });

                // Export the same entries the search shows.
                if (exportBase) {
                    \$export.attr('href', raw ? exportBase + '&s=' + encodeURIComponent(raw) : exportBase);
                }
            });

            $('.copy-alt-text').click(function() {
                var text = $(this).data('alt-text');
                navigator.clipboard.writeText(text);
                var \$btn = $(this);
                var orig = \$btn.html();
                \$btn.find('.atp-copy-label').text('Copied!');
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
            wp_die(esc_html__('You do not have permission to perform this action.', 'alt-text-pro'));
        }

        $attachment_id = isset($_POST['attachment_id']) ? intval($_POST['attachment_id']) : 0;
        $context = isset($_POST['context']) ? sanitize_text_field(wp_unslash($_POST['context'])) : '';

        if (!$attachment_id) {
            wp_send_json_error(esc_html__('Invalid attachment ID.', 'alt-text-pro'));
        }

        if (!wp_attachment_is_image($attachment_id) || !current_user_can('edit_post', $attachment_id)) {
            wp_send_json_error(esc_html__('You do not have permission to edit this image.', 'alt-text-pro'));
        }

        // Get blog context from settings
        $settings = get_option('alt_text_pro_settings', array());
        $blog_context = isset($settings['blog_context']) ? $settings['blog_context'] : '';

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
            wp_send_json_error($result['message'] ?? esc_html__('Failed to generate alt-text. Please check your API key and try again.', 'alt-text-pro'));
        }
    }

    /**
     * AJAX handler for getting usage stats
     */
    public function ajax_get_usage()
    {
        check_ajax_referer('alt_text_pro_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have permission to perform this action.', 'alt-text-pro'));
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
            wp_die(esc_html__('You do not have permission to perform this action.', 'alt-text-pro'));
        }

        $api_key = isset($_POST['api_key']) ? trim(sanitize_text_field(wp_unslash($_POST['api_key']))) : '';

        if (empty($api_key) || !AltTextPro_API_Client::validate_api_key_format($api_key)) {
            wp_send_json_error(esc_html__('Invalid API key format. API keys should start with "alt_" or "altai_".', 'alt-text-pro'));
        }

        $api_client = new AltTextPro_API_Client();
        $result = $api_client->validate_api_key($api_key);

        if ($result['success']) {
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

            $response_data = is_array($result['data']) ? $result['data'] : array();
            $response_data['saved'] = true;
            $response_data['message'] = esc_html__('API key validated and saved successfully.', 'alt-text-pro');

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
                $attachment_id = 0;
                $id_patterns = array(
                    '/\bwp-image-(\d+)\b/i',
                    '/\bdata-id\s*=\s*["\'](\d+)["\']/i',
                    '/\bdata-attachment-id\s*=\s*["\'](\d+)["\']/i',
                );

                foreach ($id_patterns as $pattern) {
                    if (preg_match($pattern, $image_tag, $id_match)) {
                        $attachment_id = intval($id_match[1]);
                        break;
                    }
                }

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
        }
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
            $context = '';
            if (!empty($settings['context_enabled'])) {
                $context = (string) get_the_title($post_id);
                $context = trim(wp_strip_all_tags(html_entity_decode($context, ENT_QUOTES | ENT_HTML5, 'UTF-8')));
            }

            foreach ($attachments as $attachment_id) {
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
                if ($generations >= self::POST_GENERATIONS_PER_REQUEST || !empty($results['no_credits'])) {
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

                $result = $api_client->generate_alt_text($attachment_id, $context);
                $alt_text = sanitize_text_field((string) ($result['alt_text'] ?? ''));

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
                }
            }
        }

        $results['done'] = $sync_only || !empty($results['no_credits']) || $results['remaining'] === 0;

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

                        $("<div>", {
                            "class": "atp-post-status atp-post-warning",
                            "text": "⚠ " + message
                        }).appendTo($container);
                    });
                }

                $(document).on("click", ".atp-post-generate-btn", function(e) {
                    e.preventDefault();
                    var $btn = $(this);
                    var postId = $btn.data("post-id");
                    var nonce = $btn.data("nonce");
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
                        $btn.find(".atp-btn-text").text(altTextAI.strings.postAddAltText);
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

                        if (processed > 0) {
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
                        } else if (data.no_credits) {
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
                            error: function() {
                                fail(altTextAI.strings.postError);
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
