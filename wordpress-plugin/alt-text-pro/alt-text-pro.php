<?php
/**
 * Plugin Name: Alt Text Pro
 * Plugin URI: https://www.alt-text.pro
 * Description: Draft AI alt text for WordPress images, review it, and fill missing Media Library alt attributes in small batches.
 * Version:           1.7.19
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
define('ALT_TEXT_PRO_VERSION', '1.7.19');
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
    }

    /**
     * Initialize plugin
     */
    public function init()
    {
        // Load plugin text domain - handled automatically by WordPress 4.6+
        // load_plugin_textdomain('alt-text-pro', false, dirname(ALT_TEXT_PRO_PLUGIN_BASENAME) . '/languages');

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
        add_action('wp_ajax_alt_text_pro_bulk_process', array($this, 'ajax_bulk_process'));
        add_action('wp_ajax_alt_text_pro_get_usage', array($this, 'ajax_get_usage'));
        add_action('wp_ajax_alt_text_pro_validate_key', array($this, 'ajax_validate_key'));
        add_action('wp_ajax_alt_text_pro_generate_post', array($this, 'ajax_generate_post_alt_text'));

        // Enqueue scripts
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));

        // Redirect to dashboard after activation
        add_action('admin_init', array($this, 'activation_redirect'));
    }

    /**
     * Redirect to plugin dashboard after activation
     */
    public function activation_redirect()
    {
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
     */
    public function activate()
    {
        // Create database tables if needed
        $this->create_tables();

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

        // Set redirect flag so we redirect to the dashboard on first load
        set_transient('alt_text_pro_activation_redirect', true, 30);

        // Clear any scheduled events for bulk processing
        wp_clear_scheduled_hook('alt_text_pro_bulk_process_batch');
        wp_clear_scheduled_hook('alt_text_pro_generate_background');
    }

    /**
     * Plugin deactivation
     */
    public function deactivate()
    {
        // Clear scheduled events
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
                'noCredits' => __('No credits remaining. Please upgrade your plan.', 'alt-text-pro'),
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
                'postNoImages' => __('No images found in this post.', 'alt-text-pro'),
                'postAllDone' => __('All images already have alt-text!', 'alt-text-pro'),
                // translators: %d: Number of images updated with generated alt text.
                'postSuccess' => __('Done! %d image(s) updated.', 'alt-text-pro'),
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
            // Test API connection
            $('#test-connection').on('click', function() {
                var \$button = $(this);
                var \$result = $('#connection-test-result');
                var apiKey = $('#api_key').val();
                
                if (!apiKey) {
                    \$result.html('<div class=\"notice notice-error inline\"><p>' + altTextAI.strings.invalidKey + '</p></div>');
                    return;
                }
                
                \$button.prop('disabled', true).text('Testing...');
                \$result.html('<div class=\"notice notice-info inline\"><p>' + altTextAI.strings.generating + '</p></div>');
                
                $.ajax({
                    url: altTextAI.ajaxUrl,
                    type: 'POST',
                    data: {
                        action: 'alt_text_pro_test_connection',
                        api_key: apiKey,
                        nonce: altTextAI.nonce
                    },
                    success: function(response) {
                        if (response.success) {
                            var userInfo = response.data.user_info;
                            var message = '<strong>' + response.data.message + '</strong>';
                            if (userInfo) {
                                message += ' (' + userInfo.plan + ', ' + userInfo.credits_remaining + ' credits)';
                            }
                            \$result.html('<div class=\"notice notice-success inline\"><p>' + message + '</p></div>');
                        } else {
                            \$result.html('<div class=\"notice notice-error inline\"><p>' + response.data + '</p></div>');
                        }
                    },
                    error: function() {
                        \$result.html('<div class=\"notice notice-error inline\"><p>' + altTextAI.strings.connectionTestFailed + '</p></div>');
                    },
                    complete: function() {
                        \$button.prop('disabled', false).text(altTextAI.strings.test);
                    }
                });
            });

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
            $('#search-logs').on('input', function() {
                var term = $(this).val().toLowerCase();
                $('.log-row').each(function() {
                    $(this).toggle($(this).data('alt-text').includes(term));
                });
            });

            $('.copy-alt-text').click(function() {
                var text = $(this).data('alt-text');
                navigator.clipboard.writeText(text);
                var \$btn = $(this);
                var orig = \$btn.html();
                \$btn.html('Copied!');
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
     * AJAX handler for bulk processing
     */
    public function ajax_bulk_process()
    {
        check_ajax_referer('alt_text_pro_nonce', 'nonce');

        if (!current_user_can('upload_files')) {
            wp_die(esc_html__('You do not have permission to perform this action.', 'alt-text-pro'));
        }

        wp_send_json_error(esc_html__('This bulk processing endpoint is no longer used. Please refresh the page and try again.', 'alt-text-pro'));
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

        $attachments = $this->get_post_image_attachments($post_id);
        $total = count($attachments);

        if ($total === 0) {
            echo '<span class="atp-post-status atp-no-images" style="color:#9CA3AF;font-size:12px;">— ' . esc_html__('No images', 'alt-text-pro') . '</span>';
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
            echo '<span class="atp-post-status atp-all-done" style="color:#10B981;font-size:12px;">✓ ' . esc_html__('All done', 'alt-text-pro') . '</span>';
            return;
        }

        // Show the button
        printf(
            '<button type="button" class="button button-small atp-post-generate-btn" data-post-id="%d" data-nonce="%s" title="%s">
                <span class="dashicons dashicons-images-alt2" style="font-size:14px;width:14px;height:14px;vertical-align:middle;margin-right:2px;"></span>
                <span class="atp-btn-text">%s</span>
            </button>
            <span class="atp-post-badge" style="margin-left:4px;font-size:11px;color:#6B7280;">%d/%d</span>',
            intval($post_id),
            esc_attr(wp_create_nonce('alt_text_pro_nonce')),
            /* translators: %d: number of images missing alt-text */
            esc_attr(sprintf(__('%d image(s) missing alt-text', 'alt-text-pro'), $missing)),
            esc_html__('Add Alt Text', 'alt-text-pro'),
            intval($missing),
            intval($total)
        );
    }

    /**
     * Get all image attachment IDs used in a post (content images + featured image)
     */
    private function get_post_image_attachments($post_id)
    {
        $attachment_ids = array();
        $post = get_post($post_id);

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
            if (wp_attachment_is_image($att_id) && current_user_can('edit_post', $att_id)) {
                $valid_ids[] = $att_id;
            }
        }

        return $valid_ids;
    }

    /**
     * Keep block metadata and rendered image HTML aligned after regenerating alt text.
     */
    private function sync_post_content_image_alt_text($post_content, array $content_updates)
    {
        if (empty($post_content) || empty($content_updates)) {
            return $post_content;
        }

        $content = $post_content;

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

                if ($did_update_blocks) {
                    $serialized = '';
                    foreach ($blocks as $block) {
                        $serialized .= serialize_block($block);
                    }
                    $content = $serialized;
                }
            }
        }

        return $this->sync_html_image_alt_text($content, $content_updates);
    }

    /**
     * Recursively update Gutenberg block metadata and inline HTML for attachment alt text.
     */
    private function sync_image_block_alt_text(array $block, array $content_updates, &$did_update_blocks)
    {
        if (!empty($block['attrs']) && is_array($block['attrs'])) {
            if (
                isset($block['attrs']['id'])
                && isset($content_updates[intval($block['attrs']['id'])])
            ) {
                $attachment_id = intval($block['attrs']['id']);
                $new_alt = $content_updates[$attachment_id];

                if (!isset($block['attrs']['alt']) || $block['attrs']['alt'] !== $new_alt) {
                    $block['attrs']['alt'] = $new_alt;
                    $did_update_blocks = true;
                }
            }

            if (
                isset($block['attrs']['mediaId'])
                && isset($content_updates[intval($block['attrs']['mediaId'])])
            ) {
                $attachment_id = intval($block['attrs']['mediaId']);
                $new_alt = $content_updates[$attachment_id];

                if (!isset($block['attrs']['mediaAlt']) || $block['attrs']['mediaAlt'] !== $new_alt) {
                    $block['attrs']['mediaAlt'] = $new_alt;
                    $did_update_blocks = true;
                }
            }

            if (!empty($block['attrs']['images']) && is_array($block['attrs']['images'])) {
                foreach ($block['attrs']['images'] as $image_index => $image_attrs) {
                    if (
                        is_array($image_attrs)
                        && isset($image_attrs['id'])
                        && isset($content_updates[intval($image_attrs['id'])])
                    ) {
                        $attachment_id = intval($image_attrs['id']);
                        $new_alt = $content_updates[$attachment_id];

                        if (!isset($image_attrs['alt']) || $image_attrs['alt'] !== $new_alt) {
                            $block['attrs']['images'][$image_index]['alt'] = $new_alt;
                            $did_update_blocks = true;
                        }
                    }
                }
            }
        }

        if (!empty($block['innerBlocks']) && is_array($block['innerBlocks'])) {
            foreach ($block['innerBlocks'] as $index => $inner_block) {
                $block['innerBlocks'][$index] = $this->sync_image_block_alt_text($inner_block, $content_updates, $did_update_blocks);
            }
        }

        if (!empty($block['innerHTML']) && is_string($block['innerHTML'])) {
            $updated_inner_html = $this->sync_html_image_alt_text($block['innerHTML'], $content_updates);
            if ($updated_inner_html !== $block['innerHTML']) {
                $block['innerHTML'] = $updated_inner_html;
                $did_update_blocks = true;
            }
        }

        if (!empty($block['innerContent']) && is_array($block['innerContent'])) {
            foreach ($block['innerContent'] as $index => $inner_content) {
                if (!is_string($inner_content) || strpos($inner_content, '<img') === false) {
                    continue;
                }

                $updated_inner_content = $this->sync_html_image_alt_text($inner_content, $content_updates);
                if ($updated_inner_content !== $inner_content) {
                    $block['innerContent'][$index] = $updated_inner_content;
                    $did_update_blocks = true;
                }
            }
        }

        return $block;
    }

    /**
     * Update image alt attributes in raw HTML for classic content and block markup.
     */
    private function sync_html_image_alt_text($html, array $content_updates)
    {
        if (!is_string($html) || $html === '' || empty($content_updates)) {
            return $html;
        }

        return preg_replace_callback(
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

                $updated_tag = preg_replace(
                    '/\s+alt\s*=\s*(?:"[^"]*"|\'[^\']*\'|[^\s>]+)/i',
                    '',
                    $image_tag,
                    1
                );

                if (!is_string($updated_tag)) {
                    return $image_tag;
                }

                $updated_tag = preg_replace('/\s*(\/?>)$/', ' $1', $updated_tag, 1);
                if (!is_string($updated_tag)) {
                    return $image_tag;
                }

                $escaped_alt = esc_attr($content_updates[$attachment_id]);
                $closing_offset = strrpos($updated_tag, '/>');

                if ($closing_offset === false) {
                    $closing_offset = strrpos($updated_tag, '>');
                }

                if ($closing_offset === false) {
                    return $image_tag;
                }

                return substr($updated_tag, 0, $closing_offset)
                    . ' alt="' . $escaped_alt . '"'
                    . substr($updated_tag, $closing_offset);
            },
            $html
        );
    }

    /**
     * AJAX handler for generating alt-text for all images in a specific post
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

        $attachments = $this->get_post_image_attachments($post_id);

        if (empty($attachments)) {
            wp_send_json_error(__('No images found in this post.', 'alt-text-pro'));
        }

        $api_client = new AltTextPro_API_Client();
        $settings = get_option('alt_text_pro_settings', array());
        $results = array(
            'total' => count($attachments),
            'processed' => 0,
            'skipped' => 0,
            'errors' => 0,
            'details' => array()
        );

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

            // Get image URL
            $image_url = wp_get_attachment_url($attachment_id);
            if (!$image_url) {
                $results['errors']++;
                $results['details'][] = array(
                    'id' => $attachment_id,
                    'status' => 'error',
                    'message' => __('Could not get image URL', 'alt-text-pro')
                );
                continue;
            }

            // Generate alt-text via API
            $context = '';
            if (!empty($settings['use_context'])) {
                $post = get_post($post_id);
                if ($post) {
                    $context = $post->post_title;
                }
            }

            $result = $api_client->generate_alt_text($attachment_id, $context);

            if ($result['success'] && !empty($result['alt_text'])) {
                // Save alt-text
                update_post_meta($attachment_id, '_wp_attachment_image_alt', sanitize_text_field($result['alt_text']));

                // Log generation
                $this->log_generation($attachment_id, $result['alt_text']);

                $results['processed']++;
                $results['details'][] = array(
                    'id' => $attachment_id,
                    'status' => 'success',
                    'alt_text' => $result['alt_text']
                );
            }
            else {
                $results['errors']++;
                $results['details'][] = array(
                    'id' => $attachment_id,
                    'status' => 'error',
                    'message' => isset($result['message']) ? $result['message'] : __('Failed to generate alt-text', 'alt-text-pro')
                );
            }
        }

        // Keep both Gutenberg block attributes and rendered HTML in sync.
        // Include BOTH newly generated AND skipped (already had metadata) images,
        // because skipped images may have alt text in metadata but NOT in the post content yet.
        $content_updates = array();
        foreach ($results['details'] as $detail) {
            if ($detail['status'] === 'success' && !empty($detail['alt_text'])) {
                $content_updates[$detail['id']] = $detail['alt_text'];
            }
            elseif ($detail['status'] === 'skipped') {
                // Image already has alt text in metadata — ensure it's also in the HTML
                $existing = get_post_meta($detail['id'], '_wp_attachment_image_alt', true);
                if (!empty($existing)) {
                    $content_updates[$detail['id']] = $existing;
                }
            }
        }

        if (!empty($content_updates)) {
            $post = get_post($post_id);
            if ($post && !empty($post->post_content)) {
                $content = $this->sync_post_content_image_alt_text($post->post_content, $content_updates);

                $update_result = true;
                if ($content !== $post->post_content) {
                    // Save the updated content back to the post only when it actually changed.
                    $update_result = wp_update_post(array(
                        'ID' => $post_id,
                        'post_content' => $content,
                    ), true);
                }

                if (is_wp_error($update_result)) {
                    $results['content_update_error'] = __('Alt text was saved to the Media Library, but the post content could not be updated automatically.', 'alt-text-pro');
                }
            }
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

                $(document).on("click", ".atp-post-generate-btn", function(e) {
                    e.preventDefault();
                    var $btn = $(this);
                    var postId = $btn.data("post-id");
                    var nonce = $btn.data("nonce");
                    var $badge = $btn.siblings(".atp-post-badge");
                    var $cell = $btn.closest("td");

                    // Prevent double-click
                    if ($btn.prop("disabled")) return;

                    // Show loading state
                    $btn.prop("disabled", true);
                    $btn.find(".atp-btn-text").text(altTextAI.strings.postGenerating);
                    $btn.find(".dashicons").removeClass("dashicons-images-alt2").addClass("dashicons-update atp-spin");

                    $.ajax({
                        url: altTextAI.ajaxUrl,
                        type: "POST",
                        data: {
                            action: "alt_text_pro_generate_post",
                            nonce: nonce,
                            post_id: postId
                        },
                        success: function(response) {
                            if (response.success) {
                                var data = response.data;
                                var processed = data.processed || 0;

                                if (processed > 0) {
                                    // Show success
                                    var msg = altTextAI.strings.postSuccess.replace("%d", processed);
                                    $cell.html("<span class=\"atp-post-status atp-all-done\" style=\"color:#10B981;font-size:12px;\">✓ " + msg + "</span>");
                                } else if (data.skipped === data.total) {
                                    $cell.html("<span class=\"atp-post-status atp-all-done\" style=\"color:#10B981;font-size:12px;\">✓ " + altTextAI.strings.postAllDone + "</span>");
                                } else {
                                    // Partial — some errors
                                    $btn.prop("disabled", false);
                                    $btn.find(".dashicons").removeClass("dashicons-update atp-spin").addClass("dashicons-warning");
                                    $btn.find(".atp-btn-text").text(data.errors + " error(s)");
                                    $btn.css("color", "#EF4444");
                                }

                                if (data.content_update_error) {
                                    $cell.append(
                                        $("<div>", {
                                            "class": "atp-post-status",
                                            "css": { "color": "#B45309", "font-size": "12px", "margin-top": "6px" }
                                        }).text(data.content_update_error)
                                    );
                                }
                            } else {
                                // Error
                                $btn.prop("disabled", false);
                                $btn.find(".dashicons").removeClass("dashicons-update atp-spin").addClass("dashicons-images-alt2");
                                $btn.find(".atp-btn-text").text(altTextAI.strings.postAddAltText);
                                alert(response.data || altTextAI.strings.postError);
                            }
                        },
                        error: function() {
                            $btn.prop("disabled", false);
                            $btn.find(".dashicons").removeClass("dashicons-update atp-spin").addClass("dashicons-images-alt2");
                            $btn.find(".atp-btn-text").text(altTextAI.strings.postAddAltText);
                            alert(altTextAI.strings.postError);
                        }
                    });
                });
            })(jQuery);
        ');
    }
}

// Initialize the plugin
AltTextPro::get_instance();
