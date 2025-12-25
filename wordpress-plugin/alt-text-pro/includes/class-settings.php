<?php
/**
 * Settings Handler for Alt-Text AI
 * 
 * Handles plugin settings and configuration
 */

if (!defined('ABSPATH')) {
    exit;
}

class AltTextPro_Settings {
    
    private $settings_group = 'alt_text_pro_settings';
    private $settings_section = 'alt_text_pro_main_section';
    
    /**
     * Constructor
     */
    public function __construct() {
        add_action('admin_init', array($this, 'register_settings'));
        add_action('wp_ajax_alt_text_pro_test_connection', array($this, 'ajax_test_connection'));
        add_action('wp_ajax_alt_text_pro_reset_settings', array($this, 'ajax_reset_settings'));
    }
    
    /**
     * Register settings
     */
    public function register_settings() {
        register_setting(
            $this->settings_group,
            'alt_text_pro_settings',
            array(
                'sanitize_callback' => array($this, 'sanitize_settings'),
                'default' => $this->get_default_settings()
            )
        );
        
        add_settings_section(
            $this->settings_section,
            __('Alt Text Pro Configuration', 'alt-text-pro'),
            array($this, 'settings_section_callback'),
            'alt-text-pro-settings'
        );
        
        // API Configuration
        add_settings_field(
            'api_key',
            __('API Key', 'alt-text-pro'),
            array($this, 'api_key_field_callback'),
            'alt-text-pro-settings',
            $this->settings_section
        );
        
        // Auto Generation Settings
        add_settings_field(
            'auto_generate',
            __('Auto Generation', 'alt-text-pro'),
            array($this, 'auto_generate_field_callback'),
            'alt-text-pro-settings',
            $this->settings_section
        );
        
        // Overwrite Settings
        add_settings_field(
            'overwrite_existing',
            __('Overwrite Existing', 'alt-text-pro'),
            array($this, 'overwrite_existing_field_callback'),
            'alt-text-pro-settings',
            $this->settings_section
        );
        
        // Context Settings
        add_settings_field(
            'context_enabled',
            __('Context Enhancement', 'alt-text-pro'),
            array($this, 'context_enabled_field_callback'),
            'alt-text-pro-settings',
            $this->settings_section
        );
        
        // Batch Size Settings
        add_settings_field(
            'batch_size',
            __('Batch Processing', 'alt-text-pro'),
            array($this, 'batch_size_field_callback'),
            'alt-text-pro-settings',
            $this->settings_section
        );
    }
    
    /**
     * Get default settings
     */
    private function get_default_settings() {
        return array(
            'api_key' => '',
            'auto_generate' => false,
            'overwrite_existing' => false,
            'context_enabled' => true,
            'batch_size' => 2
        );
    }
    
    /**
     * Sanitize settings
     */
    public function sanitize_settings($input) {
        // Get existing settings to preserve values not being updated
        $existing_settings = get_option('alt_text_pro_settings', $this->get_default_settings());
        
        // Start with existing settings to preserve any fields not in the input
        $sanitized = $existing_settings;
        
        // Ensure we have defaults for all fields
        $defaults = $this->get_default_settings();
        $sanitized = wp_parse_args($sanitized, $defaults);
        
        // Sanitize API key if provided
        if (isset($input['api_key'])) {
            $api_key = sanitize_text_field($input['api_key']);
            
            // Validate API key format only if it's not empty
            if (!empty($api_key) && !AltTextPro_API_Client::validate_api_key_format($api_key)) {
                add_settings_error(
                    'alt_text_pro_settings',
                    'invalid_api_key_format',
                    esc_html__('Invalid API key format. API keys should start with "alt_" or "altai_".', 'alt-text-pro'),
                    'error'
                );
                // Don't save invalid API key - keep existing one
                // $sanitized['api_key'] = $existing_settings['api_key'];
            } else {
                // Save the API key (even if empty, as user may want to clear it)
                $sanitized['api_key'] = $api_key;
            }
        }
        
        // Sanitize boolean settings
        if (isset($input['auto_generate'])) {
            $sanitized['auto_generate'] = !empty($input['auto_generate']);
        }
        
        if (isset($input['overwrite_existing'])) {
            $sanitized['overwrite_existing'] = !empty($input['overwrite_existing']);
        }
        
        if (isset($input['context_enabled'])) {
            $sanitized['context_enabled'] = !empty($input['context_enabled']);
        }
        
        // Sanitize batch size
        if (isset($input['batch_size'])) {
            $sanitized['batch_size'] = min(50, max(1, intval($input['batch_size'] ?? 2)));
        }
        
        return $sanitized;
    }
    
    /**
     * Settings section callback
     */
    public function settings_section_callback() {
        echo '<p>' . esc_html__('Configure your Alt Text Pro settings below. You can get your API key from your Alt Text Pro dashboard.', 'alt-text-pro') . '</p>';
    }
    
    /**
     * API key field callback
     */
    public function api_key_field_callback() {
        $settings = get_option('alt_text_pro_settings', $this->get_default_settings());
        $api_key = $settings['api_key'];
        
        echo '<div class="alt-text-pro-api-key-field">';
        echo '<input type="password" id="api_key" name="alt_text_pro_settings[api_key]" value="' . esc_attr($api_key) . '" class="regular-text" placeholder="alt_... or altai_..." />';
        echo '<button type="button" class="button button-secondary" id="toggle-api-key-visibility">';
        echo '<span class="dashicons dashicons-visibility"></span>';
        echo '</button>';
        echo '<button type="button" class="button button-secondary" id="test-api-connection" style="margin-left: 10px;">';
        echo '<span class="dashicons dashicons-admin-plugins"></span> ' . esc_html__('Test Connection', 'alt-text-pro');
        echo '</button>';
        echo '<div id="api-test-result" style="margin-top: 10px;"></div>';
        echo '</div>';
        
        echo '<p class="description">';
        echo wp_kses_post(
            sprintf(
                // translators: %s: URL to the Alt Text Pro dashboard
                esc_html__('Enter your Alt Text Pro API key. You can find this in your <a href="%1$s" target="_blank">Alt Text Pro dashboard</a>.', 'alt-text-pro'),
                esc_url('https://www.alt-text.pro/dashboard')
            )
        );
        echo '</p>';
    }
    
    /**
     * Auto generate field callback
     */
    public function auto_generate_field_callback() {
        $settings = get_option('alt_text_pro_settings', $this->get_default_settings());
        $auto_generate = $settings['auto_generate'];
        
        echo '<label>';
        echo '<input type="checkbox" id="auto_generate" name="alt_text_pro_settings[auto_generate]" value="1" ' . checked(1, $auto_generate, false) . ' />';
        echo ' ' . esc_html__('Automatically generate alt-text when images are uploaded', 'alt-text-pro');
        echo '</label>';
        
        echo '<p class="description">';
        echo esc_html__('When enabled, alt-text will be automatically generated for new image uploads. This uses your API credits.', 'alt-text-pro');
        echo '</p>';
    }
    
    /**
     * Overwrite existing field callback
     */
    public function overwrite_existing_field_callback() {
        $settings = get_option('alt_text_pro_settings', $this->get_default_settings());
        $overwrite_existing = $settings['overwrite_existing'];
        
        echo '<label>';
        echo '<input type="checkbox" id="overwrite_existing" name="alt_text_pro_settings[overwrite_existing]" value="1" ' . checked(1, $overwrite_existing, false) . ' />';
        echo ' ' . esc_html__('Overwrite existing alt-text when regenerating', 'alt-text-pro');
        echo '</label>';
        
        echo '<p class="description">';
        echo esc_html__('When enabled, existing alt-text will be replaced when generating new alt-text. When disabled, images with existing alt-text will be skipped.', 'alt-text-pro');
        echo '</p>';
    }
    
    /**
     * Context enabled field callback
     */
    public function context_enabled_field_callback() {
        $settings = get_option('alt_text_pro_settings', $this->get_default_settings());
        $context_enabled = $settings['context_enabled'];
        
        echo '<label>';
        echo '<input type="checkbox" id="context_enabled" name="alt_text_pro_settings[context_enabled]" value="1" ' . checked(1, $context_enabled, false) . ' />';
        echo ' ' . esc_html__('Enable context-aware alt-text generation', 'alt-text-pro');
        echo '</label>';
        
        echo '<p class="description">';
        echo esc_html__('When enabled, the plugin will try to provide context information (like page title, filename) to improve alt-text quality.', 'alt-text-pro');
        echo '</p>';
    }
    
    /**
     * Batch size field callback
     */
    public function batch_size_field_callback() {
        $settings = get_option('alt_text_pro_settings', $this->get_default_settings());
        $batch_size = $settings['batch_size'];
        
        echo '<input type="number" id="batch_size" name="alt_text_pro_settings[batch_size]" value="' . esc_attr($batch_size) . '" min="1" max="50" class="small-text" />';
        echo ' ' . esc_html__('images per batch', 'alt-text-pro');
        
        echo '<p class="description">';
        echo esc_html__('Number of images to process in each batch during bulk operations. Lower numbers are more reliable but slower.', 'alt-text-pro');
        echo '</p>';
    }
    
    /**
     * AJAX test connection
     */
    public function ajax_test_connection() {
        check_ajax_referer('alt_text_pro_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have permission to perform this action.', 'alt-text-pro'));
        }
        
        $api_key = isset($_POST['api_key']) ? sanitize_text_field(wp_unslash($_POST['api_key'])) : '';
        
        if (empty($api_key)) {
            wp_send_json_error(esc_html__('Please enter an API key first.', 'alt-text-pro'));
        }
        
        // Validate API key format
        if (!AltTextPro_API_Client::validate_api_key_format($api_key)) {
            wp_send_json_error(esc_html__('Invalid API key format. API keys should start with "alt_" or "altai_".', 'alt-text-pro'));
        }
        
        $api_client = new AltTextPro_API_Client();
        $result = $api_client->validate_api_key($api_key);
        
        if ($result['success']) {
            $user_data = $result['data'];
            
            wp_send_json_success(array(
                'message' => esc_html__('Connection successful!', 'alt-text-pro'),
                'user_info' => array(
                    'email' => $user_data['user']['email'] ?? '',
                    'plan' => $user_data['user']['plan'] ?? '',
                    'credits_remaining' => $user_data['user']['credits_remaining'] ?? 0
                )
            ));
        } else {
            wp_send_json_error($result['message']);
        }
    }
    
    /**
     * AJAX reset settings
     */
    public function ajax_reset_settings() {
        check_ajax_referer('alt_text_pro_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have permission to perform this action.', 'alt-text-pro'));
        }
        
        // Reset to default settings
        update_option('alt_text_pro_settings', $this->get_default_settings());
        
        wp_send_json_success(esc_html__('Settings have been reset to defaults.', 'alt-text-pro'));
    }
    
    /**
     * Get current settings
     */
    public function get_settings() {
        return get_option('alt_text_pro_settings', $this->get_default_settings());
    }
    
    /**
     * Update setting
     */
    public function update_setting($key, $value) {
        $settings = $this->get_settings();
        $settings[$key] = $value;
        return update_option('alt_text_pro_settings', $settings);
    }
    
    /**
     * Get setting
     */
    public function get_setting($key, $default = null) {
        $settings = $this->get_settings();
        return $settings[$key] ?? $default;
    }
    
    /**
     * Check if API is configured
     */
    public function is_api_configured() {
        $settings = $this->get_settings();
        return !empty($settings['api_key']);
    }
    
    /**
     * Export settings
     */
    public function export_settings() {
        $settings = $this->get_settings();
        
        // Remove sensitive data for export
        $export_settings = $settings;
        $export_settings['api_key'] = !empty($settings['api_key']) ? '[CONFIGURED]' : '[NOT_CONFIGURED]';
        
        return array(
            'version' => ALT_TEXT_PRO_VERSION,
            'exported_at' => current_time('mysql'),
            'settings' => $export_settings
        );
    }
    
    /**
     * Import settings
     */
    public function import_settings($import_data) {
        if (!is_array($import_data) || !isset($import_data['settings'])) {
            return false;
        }
        
        $imported_settings = $import_data['settings'];
        $current_settings = $this->get_settings();
        
        // Merge settings, keeping current API key if import doesn't have one
        if ($imported_settings['api_key'] === '[CONFIGURED]' || $imported_settings['api_key'] === '[NOT_CONFIGURED]') {
            $imported_settings['api_key'] = $current_settings['api_key'];
        }
        
        // Sanitize imported settings
        $sanitized_settings = $this->sanitize_settings($imported_settings);
        
        return update_option('alt_text_pro_settings', $sanitized_settings);
    }
}
