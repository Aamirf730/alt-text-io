<?php
/**
 * Plugin Name: Alt Text Pro
 * Plugin URI: https://www.alt-text.pro
 * Description: Automatically generate professional alt-text for your images using AI. Improve accessibility and SEO with our powerful SaaS integration.
 * Version: 1.0.5
 * Author: Alt Text Pro
 * Author URI: https://www.alt-text.pro
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: alt-text-ai
 * Domain Path: /languages
 * Requires at least: 5.0
 * Tested up to: 6.4
 * Requires PHP: 7.4
 * Network: false
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('ALT_TEXT_AI_VERSION', '1.0.5'); // Updated: UI refresh with teal color scheme and logo
define('ALT_TEXT_AI_PLUGIN_URL', plugin_dir_url(__FILE__));
define('ALT_TEXT_AI_PLUGIN_PATH', plugin_dir_path(__FILE__));
define('ALT_TEXT_AI_PLUGIN_BASENAME', plugin_basename(__FILE__));

// API Configuration
define('ALT_TEXT_AI_API_BASE', 'https://www.alt-text.pro/.netlify/functions');

/**
 * Main Plugin Class
 */
class AltTextAI {
    
    private static $instance = null;
    
    /**
     * Get singleton instance
     */
    public static function get_instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * Constructor
     */
    private function __construct() {
        add_action('init', array($this, 'init'));
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
    }
    
    /**
     * Initialize plugin
     */
    public function init() {
        // Load text domain
        load_plugin_textdomain('alt-text-ai', false, dirname(ALT_TEXT_AI_PLUGIN_BASENAME) . '/languages');
        
        // Initialize components
        $this->load_dependencies();
        $this->init_hooks();
    }
    
    /**
     * Load plugin dependencies
     */
    private function load_dependencies() {
        require_once ALT_TEXT_AI_PLUGIN_PATH . 'includes/class-api-client.php';
        require_once ALT_TEXT_AI_PLUGIN_PATH . 'includes/class-admin.php';
        require_once ALT_TEXT_AI_PLUGIN_PATH . 'includes/class-media-handler.php';
        require_once ALT_TEXT_AI_PLUGIN_PATH . 'includes/class-bulk-processor.php';
        require_once ALT_TEXT_AI_PLUGIN_PATH . 'includes/class-settings.php';
    }
    
    /**
     * Initialize hooks
     */
    private function init_hooks() {
        // Admin hooks
        if (is_admin()) {
            new AltTextAI_Admin();
            new AltTextAI_Settings();
        }
        
        // Media hooks
        new AltTextAI_Media_Handler();
        new AltTextAI_Bulk_Processor();
        
        // AJAX hooks
        add_action('wp_ajax_alt_text_ai_generate', array($this, 'ajax_generate_alt_text'));
        add_action('wp_ajax_alt_text_ai_bulk_process', array($this, 'ajax_bulk_process'));
        add_action('wp_ajax_alt_text_ai_get_usage', array($this, 'ajax_get_usage'));
        add_action('wp_ajax_alt_text_ai_validate_key', array($this, 'ajax_validate_key'));
        
        // Enqueue scripts
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));
    }
    
    /**
     * Plugin activation
     */
    public function activate() {
        // Create database tables if needed
        $this->create_tables();
        
        // Set default options
        if (!get_option('alt_text_ai_settings')) {
            add_option('alt_text_ai_settings', array(
                'api_key' => '',
                'auto_generate' => false,
                'overwrite_existing' => false,
                'context_enabled' => true,
                'batch_size' => 10
            ));
        }
        
        // Clear any cached data
        wp_cache_flush();
    }
    
    /**
     * Plugin deactivation
     */
    public function deactivate() {
        // Clear scheduled events
        wp_clear_scheduled_hook('alt_text_ai_cleanup');
        
        // Clear cache
        wp_cache_flush();
    }
    
    /**
     * Create database tables
     */
    private function create_tables() {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'alt_text_ai_logs';
        
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
    public function enqueue_admin_scripts($hook) {
        // Only load on relevant admin pages
        $allowed_pages = array(
            'upload.php',
            'post.php',
            'post-new.php',
            'media-upload-popup',
            'media-new.php',
            'toplevel_page_alt-text-ai',
            'alt-text-ai_page_alt-text-ai-settings',
            'alt-text-ai_page_alt-text-ai-bulk',
            'alt-text-ai_page_alt-text-ai-logs'
        );
        
        // Check if it's one of our plugin pages
        if (!in_array($hook, $allowed_pages) && strpos($hook, 'alt-text-ai') === false) {
            return;
        }
        
        // Enqueue styles
        wp_enqueue_style(
            'alt-text-ai-admin',
            ALT_TEXT_AI_PLUGIN_URL . 'assets/css/admin.css',
            array(),
            ALT_TEXT_AI_VERSION
        );
        
        // Enqueue scripts
        wp_enqueue_script(
            'alt-text-ai-admin',
            ALT_TEXT_AI_PLUGIN_URL . 'assets/js/admin.js',
            array('jquery', 'wp-util'),
            ALT_TEXT_AI_VERSION,
            true
        );
        
        // Localize script
        wp_localize_script('alt-text-ai-admin', 'altTextAI', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('alt_text_ai_nonce'),
            'strings' => array(
                'generating' => __('Generating alt-text...', 'alt-text-ai'),
                'success' => __('Alt-text generated successfully!', 'alt-text-ai'),
                'error' => __('Failed to generate alt-text. Please try again.', 'alt-text-ai'),
                'noCredits' => __('No credits remaining. Please upgrade your plan.', 'alt-text-ai'),
                'invalidKey' => __('Invalid API key. Please check your settings.', 'alt-text-ai'),
                'processing' => __('Processing images...', 'alt-text-ai'),
                'completed' => __('Bulk processing completed!', 'alt-text-ai')
            )
        ));
    }
    
    /**
     * AJAX handler for generating alt-text
     */
    public function ajax_generate_alt_text() {
        check_ajax_referer('alt_text_ai_nonce', 'nonce');
        
        if (!current_user_can('upload_files')) {
            wp_die(__('You do not have permission to perform this action.', 'alt-text-ai'));
        }
        
        $attachment_id = intval($_POST['attachment_id']);
        $context = sanitize_text_field($_POST['context'] ?? '');
        
        if (!$attachment_id) {
            wp_send_json_error(__('Invalid attachment ID.', 'alt-text-ai'));
        }
        
        $api_client = new AltTextAI_API_Client();
        $result = $api_client->generate_alt_text($attachment_id, $context);
        
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
        } else {
            // Log the error for debugging
            error_log('Alt Text Pro: Generation failed - ' . ($result['message'] ?? 'Unknown error'));
            wp_send_json_error($result['message'] ?? __('Failed to generate alt-text. Please check your API key and try again.', 'alt-text-ai'));
        }
    }
    
    /**
     * AJAX handler for bulk processing
     */
    public function ajax_bulk_process() {
        check_ajax_referer('alt_text_ai_nonce', 'nonce');
        
        if (!current_user_can('upload_files')) {
            wp_die(__('You do not have permission to perform this action.', 'alt-text-ai'));
        }
        
        $batch_size = intval($_POST['batch_size'] ?? 10);
        $offset = intval($_POST['offset'] ?? 0);
        $overwrite = (bool) $_POST['overwrite'] ?? false;
        
        $bulk_processor = new AltTextAI_Bulk_Processor();
        $result = $bulk_processor->process_batch($batch_size, $offset, $overwrite);
        
        wp_send_json_success($result);
    }
    
    /**
     * AJAX handler for getting usage stats
     */
    public function ajax_get_usage() {
        check_ajax_referer('alt_text_ai_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die(__('You do not have permission to perform this action.', 'alt-text-ai'));
        }
        
        $api_client = new AltTextAI_API_Client();
        $result = $api_client->get_usage_stats();
        
        if ($result['success']) {
            wp_send_json_success($result['data']);
        } else {
            wp_send_json_error($result['message']);
        }
    }
    
    /**
     * AJAX handler for validating API key
     */
    public function ajax_validate_key() {
        check_ajax_referer('alt_text_ai_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die(__('You do not have permission to perform this action.', 'alt-text-ai'));
        }
        
        $api_key = sanitize_text_field($_POST['api_key']);
        
        $api_client = new AltTextAI_API_Client();
        $result = $api_client->validate_api_key($api_key);
        
        if ($result['success']) {
            wp_send_json_success($result['data']);
        } else {
            wp_send_json_error($result['message']);
        }
    }
    
    /**
     * Log alt-text generation
     */
    private function log_generation($attachment_id, $alt_text, $credits_used = 1) {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'alt_text_ai_logs';
        
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
}

// Initialize the plugin
AltTextAI::get_instance();
