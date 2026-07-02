<?php
/**
 * Plugin Name: AI Alt Text Pro
 * Plugin URI: https://www.alt-text.pro
 * Description: Generate accurate AI alt text for WordPress images, improve accessibility, and bulk-fix missing media-library alt text for SEO.
 * Version:           1.5.0
 * Author: Alt Text Pro
 * Author URI: https://www.alt-text.pro/about
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: alt-text-pro
 * Requires at least: 5.0
 * Tested up to: 6.9
 * Requires PHP: 7.4
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('ALT_TEXT_PRO_VERSION', '1.5.0');
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
        if (is_network_admin() || isset($_GET['activate-multi'])) {
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

        // Clear any cached data
        wp_cache_flush();
    }

    /**
     * Plugin deactivation
     */
    public function deactivate()
    {
        // Clear scheduled events
        wp_clear_scheduled_hook('alt_text_pro_cleanup');
        wp_clear_scheduled_hook('alt_text_pro_bulk_process_batch');

        // Clear cache
        wp_cache_flush();
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
        // Diagnostic logging: uncomment to see original hook names in error log
        // error_log('Alt Text Pro Hook: ' . $hook);

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
        $settings = get_option('alt_text_pro_settings', array());

        // Check if we have a VALID, usable API key (not just any non-empty value)
        // The raw value might be a corrupted encrypted string from a previous install
        $has_valid_key = false;
        if (!empty($settings['api_key'])) {
            $settings_handler = new AltTextPro_Settings();
            $decrypted = $settings_handler->decrypt_api_key($settings['api_key']);
            // Check if decrypted key has valid format (starts with alt_ or altai_)
            if ($decrypted !== false && AltTextPro_API_Client::validate_api_key_format($decrypted)) {
                $has_valid_key = true;
            }
            elseif ($decrypted === false && AltTextPro_API_Client::validate_api_key_format($settings['api_key'])) {
                // Plain text key with valid format (pre-encryption migration)
                $has_valid_key = true;
            }
        }
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
                'regenerateConfirm' => __('Regenerate alt text? Costs 1 credit.', 'alt-text-pro'),
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
                'postSuccess' => __('Done! %d image(s) updated.', 'alt-text-pro'),
                'postError' => __('Error generating alt-text.', 'alt-text-pro'),
                'postAddAltText' => __('Add Alt Text', 'alt-text-pro')
            )
        ));

        // Add page-specific inline scripts
        // Debug: Log the hook to verify page detection
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log('Alt Text Pro: enqueue_admin_scripts hook = ' . $hook);
        }

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
     console.log('Alt Text Pro: jQuery version:', $.fn.jquery);
     console.log('Alt Text Pro: bulkProcessor object:', typeof bulkProcessor);
     }
     // Ensure Cancel button is hidden on page load - use !important to override inline styles
     $('#cancel-bulk-process').css('display', 'none').hide().attr('style', 'display: none !important;');
     // Prevent form submission with jQuery
     $('#bulk-process-form').off('submit').on('submit', function(e) {
     console.log('Alt Text Pro: Form submit prevented (jQuery)');
     e.preventDefault();
     e.stopPropagation();
     e.stopImmediatePropagation();
     return false;
     });
     this.bindEvents();
     },
     bindEvents: function() {
     var self = this;
     console.log('Alt Text Pro: bindEvents() called');
     $('input[name="process_type"]').on('change', function() {
     if ($(this).val() === 'selected') {
     $('#image-selection-sidebar').slideDown();
     } else {
     $('#image-selection-sidebar').slideUp();
     }
     });
     // Start button handler - bind directly since we're in document.ready
     var $startBtn = $('#start-bulk-process');
     console.log('Alt Text Pro: Attempting to bind start button, button found:', $startBtn.length);
     if ($startBtn.length === 0) {
     console.error('Alt Text Pro: ERROR - Start button not found in DOM!');
     if (typeof console !== 'undefined') {
     console.error('Alt Text Pro: Available buttons:', $('button').map(function() { return this.id || this.className;
     }).get());
     }
     } else {
     $startBtn.off('click.bulkProcessor').on('click.bulkProcessor', function(e) {
     console.log('Alt Text Pro: Start button clicked (inline script)');
     e.preventDefault();
     e.stopPropagation();
     e.stopImmediatePropagation();
     try {
     bulkProcessor.startProcessing();
     } catch(err) {
     console.error('Alt Text Pro: Error in startProcessing:', err);
     console.error('Alt Text Pro: Error stack:', err.stack);
     }
     return false;
     });
     console.log('Alt Text Pro: Start button handler bound successfully');
     }
     // Cancel button handler - bind directly since we're in document.ready
     var $cancelBtn = $('#cancel-bulk-process');
     console.log('Alt Text Pro: Attempting to bind cancel button, button found:', $cancelBtn.length);
     if ($cancelBtn.length === 0) {
     console.error('Alt Text Pro: ERROR - Cancel button not found in DOM!');
     } else {
     $cancelBtn.off('click.bulkProcessor').on('click.bulkProcessor', function(e) {
     console.log('Alt Text Pro: Cancel button clicked (inline script)');
     e.preventDefault();
     e.stopPropagation();
     e.stopImmediatePropagation();
     try {
     bulkProcessor.cancelProcessing();
     } catch(err) {
     console.error('Alt Text Pro: Error in cancelProcessing:', err);
     console.error('Alt Text Pro: Error stack:', err.stack);
     }
     return false;
     });
     console.log('Alt Text Pro: Cancel button handler bound successfully');
     }
     $('#select-all-images').on('click', function() {
     $('#image-list input[type="checkbox"]').prop('checked', true);
     });
     $('#deselect-all-images').on('click', function() {
     $('#image-list input[type="checkbox"]').prop('checked', false);
     });
     console.log('Alt Text Pro: Event handlers bound');
     },
     startProcessing: function() {
     var self = this;
     console.log('Alt Text Pro: startProcessing() called');
     console.log('Alt Text Pro: isProcessing:', this.isProcessing);
     // Prevent double-clicking or starting if already processing
     if (this.isProcessing) {
     console.log('Alt Text Pro: Already processing, ignoring click');
     return;
     }
     var processType = $('input[name="process_type"]:checked').val();
     var batchSize = altTextAI.settings.batch_size || 2;
     var overwriteExisting = $('#overwrite_existing').is(':checked');
     var selectedImages = [];
     // Validate process type
     if (!processType) {
     alert('Please select a processing option.');
     return;
     }
     if (processType === 'selected') {
     selectedImages = $('#image-list input[type="checkbox"]:checked').map(function() {
     return parseInt($(this).val());
     }).get();
     if (selectedImages.length === 0) {
     alert(altTextAI.strings.pleaseSelectImage);
     return;
     }
     }
     console.log('Alt Text Pro: Starting bulk process', {
     processType: processType,
     batchSize: batchSize,
     overwriteExisting: overwriteExisting,
     selectedImages: selectedImages
     });
     // Reset state for new run
     this.pendingCancel = false;
     this.cancelRequested = false;
     this.startRequest = null;
     $('#progress-card').slideDown();
     $('#results-card').hide();
     this.isProcessing = true;
     this.notificationsShown = {};
     $('#start-bulk-process').hide();
     // Show cancel button with !important
     $('#cancel-bulk-process').attr('style', 'display: inline-block !important; color: var(--danger-color) !important;
     border-color: var(--danger-color) !important;').show();
     $('#progress-status').text(altTextAI.strings.starting).removeClass('warning error success').addClass('warning');
     this.startRequest = $.ajax({
     url: altTextAI.ajaxUrl,
     type: 'POST',
     data: {
     action: 'alt_text_pro_bulk_start',
     process_type: processType,
     batch_size: batchSize,
     overwrite_existing: overwriteExisting,
     selected_images: selectedImages,
     nonce: altTextAI.nonce
     },
     success: function(response) {
     console.log('Alt Text Pro: Bulk start response', response);
     // CRITICAL: Check cancelRequested FIRST, before doing anything else
     if (self.cancelRequested) {
     console.log('Alt Text Pro: Cancel was requested during start - aborting immediately');
     // Still need to set processId so we can cancel on server
     if (response.success && response.data && response.data.process_id) {
     self.processId = response.data.process_id;
     self.sendCancelRequest();
     } else {
     // No processId, just reset UI
     self.resetUI();
     }
     return;
     }
     if (response.success) {
     self.processId = response.data.process_id;
     $('#estimated-time').text(response.data.estimated_time);
     $('#progress-status').text('Processing...').removeClass('error success').addClass('warning');
     // Double-check cancelRequested before starting polling (race condition guard)
     if (!self.cancelRequested) {
     self.startStatusPolling();
     }
     } else {
     console.error('Alt Text Pro: Bulk start failed', response.data);
     alert('Error starting bulk process: ' + (response.data || 'Unknown error'));
     self.showError(response.data || 'Error starting');
     self.resetUI();
     }
     },
     error: function(xhr, status, error) {
     console.error('Alt Text Pro: AJAX error', {status: status, error: error, response: xhr.responseText});
     if (self.cancelRequested && status === 'abort') {
     $('#progress-status').text('Cancelled').removeClass('warning success').addClass('error');
     self.resetUI();
     return;
     }
     alert('Connection error: ' + error);
     self.showError('Connection error');
     self.resetUI();
     },
     complete: function() {
     self.startRequest = null;
     }
     });
     },
     startStatusPolling: function() {
     var self = this;
     // Guard: Don't start polling if cancel was requested
     if (this.cancelRequested || this.pendingCancel) {
     console.log('Alt Text Pro: Polling not started - cancel was requested');
     return;
     }
     // Ensure status badge shows "Processing..." when polling starts
     // This is a safeguard in case the status is still "Starting..." for any reason
     $('#progress-status').text('Processing...').removeClass('error success').addClass('warning');
     this.statusInterval = setInterval(function() {
     // Check cancel state at start of each poll
     if (self.cancelRequested || self.pendingCancel || !self.isProcessing) {
     console.log('Alt Text Pro: Stopping poll - cancel or not processing');
     clearInterval(self.statusInterval);
     self.statusInterval = null;
     return;
     }
     $.ajax({
     url: altTextAI.ajaxUrl,
     type: 'POST',
     data: {
     action: 'alt_text_pro_bulk_status',
     process_id: self.processId,
     nonce: altTextAI.nonce
     },
     success: function(response) {
     if (response.success && response.data) {
     var status = response.data.status || 'running';
     // Check if process is complete first - stop polling immediately
     if (['completed', 'cancelled', 'stopped_no_credits'].includes(status)) {
     self.isProcessing = false; // Stop polling
     clearInterval(self.statusInterval);
     // Update progress one last time to show final status
     self.updateProgress(response.data);
     // Then complete the process
     self.completeProcessing(response.data);
     return; // Exit polling loop
     }
     // Update progress for any active (non-terminal) status
     if (!['completed', 'cancelled', 'stopped_no_credits'].includes(status)) {
     self.updateProgress(response.data);
     // Process next batch if needed
     if (response.data.needs_next_batch && response.data.next_batch_offset !== null) {
     var batchKey = response.data.process_id + '_' + response.data.next_batch_offset;
     if (!self.processingBatches[batchKey]) {
     self.processNextBatch(response.data.process_id, response.data.next_batch_offset);
     }
     }
     }
     } else {
     console.error('Alt Text Pro: Status poll failed', response);
     }
     },
     error: function(xhr, status, error) {
     console.error('Alt Text Pro: Status poll error', {status: status, error: error, response: xhr.responseText});
     }
     });
     }, 1000);
     },
     processNextBatch: function(processId, batchOffset) {
     var self = this;
     var batchKey = processId + '_' + batchOffset;
     // CANCEL CHECK: Don't start new batch if cancelled
     if (self.cancelRequested || self.pendingCancel || !self.isProcessing) {
     return;
     }
     if (self.processingBatches[batchKey]) return;
     self.processingBatches[batchKey] = true;
     var batchRequest = $.ajax({
     url: altTextAI.ajaxUrl,
     type: 'POST',
     data: {
     action: 'alt_text_pro_bulk_process_batch',
     process_id: processId,
     batch_offset: batchOffset,
     nonce: altTextAI.nonce
     },
     success: function(response) {
     // Remove from pending requests
     var idx = self.pendingBatchRequests.indexOf(batchRequest);
     if (idx > -1) self.pendingBatchRequests.splice(idx, 1);
     delete self.processingBatches[batchKey];
     // CANCEL CHECK: Don't process response if cancelled
     if (self.cancelRequested || self.pendingCancel) {
     return;
     }
     if (response.success) {
     // Check if process is complete
     if (['completed', 'cancelled', 'stopped_no_credits'].includes(response.data.status)) {
     self.completeProcessing(response.data);
     return; // Stop processing
     }
     // Update progress for running processes
     self.updateProgress(response.data);
     // Process next batch if needed (with cancel check)
     if (response.data.needs_next_batch && response.data.next_batch_offset !== null && !self.cancelRequested) {
     setTimeout(function() {
     self.processNextBatch(processId, response.data.next_batch_offset);
     }, 500);
     }
     }
     },
     error: function(xhr, status, error) {
     // Remove from pending requests
     var idx = self.pendingBatchRequests.indexOf(batchRequest);
     if (idx > -1) self.pendingBatchRequests.splice(idx, 1);
     delete self.processingBatches[batchKey];
     // Don't log error if it was an abort
     if (status !== 'abort') {
     console.error('Alt Text Pro: Batch processing error', error);
     }
     }
     });
     // Track this request for potential abort
     self.pendingBatchRequests.push(batchRequest);
     },
     updateProgress: function(data) {
     var percentage = data.total_images > 0 ? Math.round((data.processed / data.total_images) * 100) : 0;
     $('#progress-fill').css('width', percentage + '%');
     $('#progress-text').text(percentage + '%');
     $('#processed-count').text(data.processed + ' / ' + data.total_images);
     $('#successful-count').text(data.successful || 0);
     $('#error-count').text(data.errors ? data.errors.length : 0);
     // Update status badge - ALWAYS update for any status
     var status = data.status || 'running';
     var $statusBadge = $('#progress-status');
     // Check terminal states first
     if (status === 'completed') {
     $statusBadge.text('Completed').removeClass('warning error').addClass('success');
     } else if (status === 'cancelled') {
     $statusBadge.text('Cancelled').removeClass('warning success').addClass('error');
     } else if (status === 'stopped_no_credits') {
     $statusBadge.text('Stopped - No Credits').removeClass('warning success').addClass('error');
     } else {
     // For ANY other status (running, starting, pending, etc.), show Processing...
     // This ensures status badge updates from "Starting..." to "Processing..." as soon as polling starts
     $statusBadge.text('Processing...').removeClass('error success').addClass('warning');
     }
     },
     completeProcessing: function(data) {
     console.log('Alt Text Pro: completeProcessing called with data:', data);
     var self = this;
     this.isProcessing = false;
     clearInterval(this.statusInterval);
     // Ensure we have the data
     if (!data) {
     console.error('Alt Text Pro: No data provided to completeProcessing');
     return;
     }
     // Update progress to 100%
     $('#progress-fill').css('width', '100%');
     $('#progress-text').text('100%');
     // Update counters with final data
     $('#processed-count').text(data.processed + ' / ' + data.total_images);
     $('#successful-count').text(data.successful || 0);
     $('#error-count').text(data.errors ? data.errors.length : 0);
     // Update status badge - ensure it shows Completed
     var status = data.status || 'completed';
     var statusText = 'Completed';
     var statusClass = 'success';
     if (status === 'stopped_no_credits') {
     statusText = 'Stopped - No Credits';
     statusClass = 'error';
     } else if (status === 'cancelled') {
     statusText = 'Cancelled';
     statusClass = 'error';
     }
     console.log('Alt Text Pro: Setting status to:', statusText);
     $('#progress-status').text(statusText).removeClass('warning error success').addClass(statusClass);
     // Show results card
     $('#results-card').slideDown();
     // Build summary
     var summary = '<p><strong>Processed ' + data.processed + ' of ' + data.total_images + ' images.</strong></p>';
     if (data.successful > 0) {
     summary += '<p style="color: var(--success-color); margin: 8px 0;">✓ ' + data.successful + ' images processed
     successfully</p>';
     }
     if (data.errors && data.errors.length > 0) {
     summary += '<p style="color: var(--danger-color); margin: 8px 0;">✗ ' + data.errors.length + ' errors occurred</p>';
     var errorHtml = '<ul style="color: var(--danger-color); font-size: 12px; margin: 8px 0; padding-left: 20px;">';
     data.errors.forEach(function(e) {
     errorHtml += '<li style="margin: 4px 0;">Image ID ' + e.image_id + ': ' + (e.error || 'Unknown error') + '</li>';
     });
     errorHtml += '</ul>';
     $('#results-errors').html(errorHtml);
     } else {
     summary += '<p style="color: var(--success-color);">All images processed successfully!</p>';
     $('#results-errors').html('');
     }
     $('#results-summary').html(summary);
     // Show notification popup
     var notificationType = 'success';
     var notificationTitle = 'Bulk Processing Completed!';
     var notificationMessage = '<strong>Processed ' + data.processed + ' of ' + data.total_images + ' images</strong><br>';
     notificationMessage += '<br>✓ <strong>' + data.successful + '</strong> images processed successfully';
     if (data.errors && data.errors.length > 0) {
     notificationType = 'warning';
     notificationMessage += '<br>✗ <strong>' + data.errors.length + '</strong> errors occurred';
     notificationMessage += '<br><br><strong>Error Details:</strong>
     <ul style="margin: 8px 0 0 20px; padding-left: 0;">';
     data.errors.slice(0, 5).forEach(function(e) {
     notificationMessage += '<li style="margin: 4px 0;">Image ID ' + e.image_id + ': ' + (e.error || 'Unknown error') + '
     </li>';
     });
     notificationMessage += '</ul>';
     if (data.errors.length > 5) {
     notificationMessage += '<br><em>... and ' + (data.errors.length - 5) + ' more errors (see details below)</em>';
     }
     } else {
     notificationMessage += '<br><br>All images processed successfully!';
     }
     // Show WordPress-style notification
     console.log('Alt Text Pro: Creating notification:', notificationTitle);
     var $notification = $('<div class="notice notice-' + notificationType
     + ' is-dismissible" style="margin: 15px 0; display: block !important; padding: 12px;">').html('<p><strong>'
     +
     notificationTitle + '</strong></p>
     <p>' + notificationMessage + '</p>');
     // Find the main content area and prepend notification
     var $wrap = $('.wrap').first();
     if ($wrap.length === 0) {
     $wrap = $('.alt-text-pro-bulk-process').first();
     }
     if ($wrap.length === 0) {
     $wrap = $('body');
     }
     console.log('Alt Text Pro: Prepending notification to:', $wrap.length > 0 ? 'found container' : 'body');
     $wrap.prepend($notification);
     $notification.css('display', 'block').show(); // Ensure it's visible
     console.log('Alt Text Pro: Notification displayed, visibility:', $notification.is(':visible'));
     // Make dismissible
     $notification.on('click', '.notice-dismiss', function() {
     $notification.slideUp(function() {
     $(this).remove();
     });
     });
     // Auto-hide after 10 seconds (longer for errors)
     setTimeout(function() {
     $notification.slideUp(function() {
     $(this).remove();
     });
     }, data.errors && data.errors.length > 0 ? 15000 : 8000);
     this.resetUI();
     },
     cancelProcessing: function() {
     console.log('Alt Text Pro: Cancel requested, processId:', this.processId);
     this.cancelRequested = true;
     this.pendingCancel = true;
     this.isProcessing = false;
     // Clear any polling interval
     if (this.statusInterval) {
     clearInterval(this.statusInterval);
     this.statusInterval = null;
     }
     // Abort the start request if it's still pending
     if (this.startRequest && this.startRequest.readyState !== 4) {
     this.startRequest.abort();
     }
     // Abort ALL pending batch requests
     if (this.pendingBatchRequests && this.pendingBatchRequests.length > 0) {
     console.log('Alt Text Pro: Aborting', this.pendingBatchRequests.length, 'pending batch requests');
     for (var i = 0; i < this.pendingBatchRequests.length; i++) { if (this.pendingBatchRequests[i] &&
     this.pendingBatchRequests[i].readyState !==4) { this.pendingBatchRequests[i].abort(); } }
     this.pendingBatchRequests=[]; } // Clear batch tracking this.processingBatches={}; // If we already have a
     process id, send cancel now if (this.processId) { this.sendCancelRequest(); return; } // Otherwise, wait for
     start to finish and mark cancelling
     $('#progress-status').text('Cancelling...').removeClass('success').addClass('warning'); }, sendCancelRequest:
     function() { var self=this; // If no processId yet, the cancel will be handled when start AJAX completes // (it
     checks cancelRequested flag) if (!this.processId) { console.log('Alt Text Pro: No processId yet - cancel will be
     sent when start completes');
     $('#progress-status').text('Cancelling...').removeClass('success').addClass('warning'); return; }
     this.isProcessing=false; if (this.statusInterval) { clearInterval(this.statusInterval);
     this.statusInterval=null; }
     $('#progress-status').text('Cancelling...').removeClass('success').addClass('warning'); $.ajax({ url:
     altTextAI.ajaxUrl, type: 'POST' , data: { action: 'alt_text_pro_bulk_cancel' , process_id: this.processId,
     nonce: altTextAI.nonce }, success: function() { console.log('Alt Text Pro: Cancel request sent successfully');
     self.resetUI(); $('#progress-status').text('Cancelled').removeClass('warning success').addClass('error'); },
     error: function(xhr, status, error) { console.error('Alt Text Pro: Cancel request failed', error);
     self.resetUI(); $('#progress-status').text('Cancel failed').removeClass('success warning').addClass('error'); }
     }); }, resetUI: function() { $('#start-bulk-process').show(); // Hide cancel button with !important to override
     any inline styles $('#cancel-bulk-process').attr('style', 'display: none !important;' ).hide();
     this.isProcessing=false; this.pendingCancel=false; this.cancelRequested=false; this.processId=null;
     this.pendingBatchRequests=[]; this.processingBatches={}; }, showError: function(msg) {
     $('#progress-log').append('<div>Error: ' + msg + '
     </div>');
     }
     };
     try {
     bulkProcessor.init();
     console.log('Alt Text Pro: bulkProcessor.init() completed');
     } catch(err) {
     console.error('Alt Text Pro: ERROR in bulkProcessor.init():', err);
     console.error('Alt Text Pro: Error stack:', err.stack);
     }
     });
     <?php
     $inline_script = ob_get_clean();
     // Add inline script - ensure it's added after the script is enqueued
     // Use 'after' position to ensure it runs after the main script loads
     wp_add_inline_script('alt-text-pro-admin', $inline_script, 'after');
     }
     /**
     * Add inline script for logs page
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

            $('.regenerate-alt-text').on('click', function() {
                if (!confirm(altTextAI.strings.regenerateConfirm)) return;
                var \$btn = $(this);
                var id = \$btn.data('attachment-id');
                \$btn.prop('disabled', true);
                $.post(altTextAI.ajaxUrl, {
                    action: 'alt_text_pro_generate',
                    attachment_id: id,
                    nonce: altTextAI.nonce
                }, function(res) {
                    if(res.success) location.reload();
                    else alert('Error: ' + (res.data || 'Unknown'));
                    \$btn.prop('disabled', false);
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

        // Get blog context from settings
        $settings = get_option('alt_text_pro_settings', array());
        $blog_context = isset($settings['blog_context']) ? $settings['blog_context'] : '';

        $api_client = new AltTextPro_API_Client();
        $result = $api_client->generate_alt_text($attachment_id, $context, $blog_context);

        if ($result['success'] && !empty($result['alt_text'])) {
            // Update attachment alt text
            update_post_meta($attachment_id, '_wp_attachment_image_alt', $result['alt_text']);

            // Log the generation (only if alt_text exists)
            if (!empty($result['alt_text'])) {
                $this->log_generation($attachment_id, $result['alt_text'], $result['credits_used'] ?? 1);
            }

            wp_send_json_success(array(
                'alt_text' => $result['alt_text'],
                'credits_remaining' => $result['credits_remaining'] ?? 0,
                'credits_used' => $result['credits_used'] ?? 1
            ));
        }
        else {
            // Log the error for debugging
            if (defined('WP_DEBUG') && WP_DEBUG) {
                // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
                error_log('Alt Text Pro: Generation failed - ' . ($result['message'] ?? 'Unknown error'));
            }
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

        $api_key = isset($_POST['api_key']) ? sanitize_text_field(wp_unslash($_POST['api_key'])) : '';

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
            $existing_settings['api_key'] = $settings_handler->encrypt_api_key($api_key);
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
            if (wp_attachment_is_image($att_id)) {
                $valid_ids[] = $att_id;
            }
        }

        return $valid_ids;
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

        $attachments = $this->get_post_image_attachments($post_id);

        if (defined('WP_DEBUG') && WP_DEBUG) {
            // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log, WordPress.PHP.DevelopmentFunctions.error_log_print_r
            error_log('Alt Text Pro DEBUG: Post ID ' . $post_id . ' - Found attachments: ' . print_r($attachments, true));

            $post_obj = get_post($post_id);
            if ($post_obj && !empty($post_obj->post_content)) {
                // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
                error_log('Alt Text Pro DEBUG: Post content length: ' . strlen($post_obj->post_content));

                if (preg_match_all('/wp-image-(\d+)/', $post_obj->post_content, $debug_matches)) {
                    // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log, WordPress.PHP.DevelopmentFunctions.error_log_print_r
                    error_log('Alt Text Pro DEBUG: wp-image IDs found in content: ' . print_r($debug_matches[1], true));
                }
                else {
                    // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
                    error_log('Alt Text Pro DEBUG: NO wp-image-{id} patterns found in content');
                }
            }
        }

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

            if (defined('WP_DEBUG') && WP_DEBUG) {
                // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
                error_log('Alt Text Pro DEBUG: Attachment ID ' . $attachment_id . ' - existing alt: "' . ($existing_alt ? $existing_alt : '(empty)') . '"');
            }

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

        // ── Update alt attributes inside the post_content HTML ──
        // WordPress stores content-image alt text in the block markup
        // (<img alt="...">), not in attachment metadata. So we must
        // patch the actual post_content for content images to pick up
        // the newly generated alt text in the block editor.
        // Include BOTH newly generated AND skipped (already had metadata) images,
        // because skipped images may have alt text in metadata but NOT in the HTML.
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
            if (defined('WP_DEBUG') && WP_DEBUG) {
                // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log, WordPress.PHP.DevelopmentFunctions.error_log_print_r
                error_log('Alt Text Pro DEBUG: content_updates to apply: ' . print_r($content_updates, true));
            }

            $post = get_post($post_id);
            if ($post && !empty($post->post_content)) {
                $content = $post->post_content;

                foreach ($content_updates as $att_id => $alt_text) {
                    $escaped_alt = esc_attr($alt_text);
                    $pattern = '/<img\b([^>]*\bwp-image-' . intval($att_id) . '\b[^>]*?)(\/?>)/i';

                    if (defined('WP_DEBUG') && WP_DEBUG) {
                        $match_count = preg_match_all($pattern, $content, $debug_img_matches);
                        // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
                        error_log('Alt Text Pro DEBUG: Regex for wp-image-' . $att_id . ' found ' . $match_count . ' match(es)');
                        if ($match_count > 0) {
                            // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
                            error_log('Alt Text Pro DEBUG: Matched img tag: ' . $debug_img_matches[0][0]);
                        }
                    }

                    // Match <img> tags that reference wp-image-{id}
                    $content = preg_replace_callback(
                        $pattern,
                        function ($matches) use ($escaped_alt) {
                        $attrs = $matches[1];
                        $close = $matches[2];

                        // Strip any existing alt attribute (empty or otherwise)
                        $attrs = preg_replace('/\s+alt\s*=\s*"[^"]*"/i', '', $attrs);

                        // Insert the new alt attribute
                        return '<img' . $attrs . ' alt="' . $escaped_alt . '"' . $close;
                    },
                        $content
                    );
                }

                // Save the updated content back to the post
                $update_result = wp_update_post(array(
                    'ID' => $post_id,
                    'post_content' => $content,
                ));

                if (defined('WP_DEBUG') && WP_DEBUG) {
                    // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
                    error_log('Alt Text Pro DEBUG: wp_update_post result: ' . ($update_result ? 'success (ID: ' . $update_result . ')' : 'FAILED'));
                }
            }
        }
        else {
            if (defined('WP_DEBUG') && WP_DEBUG) {
                // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
                error_log('Alt Text Pro DEBUG: No content_updates to apply');
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
