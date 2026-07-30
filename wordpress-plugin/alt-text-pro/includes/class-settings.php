<?php
/**
 * Settings Handler for Alt-Text AI
 * 
 * Handles plugin settings and configuration
 */

if (!defined('ABSPATH')) {
    exit;
}

class AltTextPro_Settings
{

    private $settings_group = 'alt_text_pro_settings';
    private $settings_section = 'alt_text_pro_main_section';

    /**
     * Encryption cipher method
     */
    private $cipher = 'aes-256-cbc';

    /**
     * Constructor
     */
    public function __construct()
    {
        add_action('admin_init', array($this, 'register_settings'));
        add_action('wp_ajax_alt_text_pro_test_connection', array($this, 'ajax_test_connection'));
        add_action('wp_ajax_alt_text_pro_reset_settings', array($this, 'ajax_reset_settings'));
    }

    /**
     * Register settings
     */
    public function register_settings()
    {
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
    private function get_default_settings()
    {
        return array(
            'api_key' => '',
            'auto_generate' => false,
            'overwrite_existing' => false,
            'context_enabled' => true,
            'blog_context' => '',
            'show_context_field' => false,
            'batch_size' => 1
        );
    }

    /**
     * Sanitize settings
     */
    public function sanitize_settings($input)
    {
        if (!is_array($input)) {
            $input = array();
        }

        // Get existing settings to preserve values not being updated
        $existing_settings = get_option('alt_text_pro_settings', $this->get_default_settings());

        if (!is_array($existing_settings)) {
            $existing_settings = $this->get_default_settings();
        }

        // Start with existing settings to preserve any fields not in input
        $sanitized = $existing_settings;

        // Ensure we have defaults for all fields
        $defaults = $this->get_default_settings();
        $sanitized = wp_parse_args($sanitized, $defaults);

        // Sanitize API key if provided
        if (isset($input['api_key'])) {
            $api_key = trim(sanitize_text_field(wp_unslash($input['api_key'])));

            // Internal, already-validated saves provide the encrypted value. Keep it
            // only when it can be decrypted on this WordPress installation and is a
            // valid Alt Text Pro key. This avoids a second encryption pass while
            // preserving the same validation standard as the public settings form.
            if (!empty($api_key) && strpos($api_key, 'enc:') === 0) {
                $decrypted_key = $this->decrypt_api_key($api_key);
                if ($decrypted_key !== false && AltTextPro_API_Client::validate_api_key_format($decrypted_key)) {
                    $sanitized['api_key'] = $api_key;
                }
                else {
                    add_settings_error(
                        'alt_text_pro_settings',
                        'invalid_api_key_format',
                        esc_html__('Invalid API key format. API keys should start with "alt_" or "altai_".', 'alt-text-pro'),
                        'error'
                    );
                    $sanitized['api_key'] = $existing_settings['api_key'];
                }
            }
            elseif (!empty($api_key) && AltTextPro_API_Client::validate_api_key_format($api_key)) {
                // Valid new API key — encrypt and save
                $encrypted_key = $this->encrypt_api_key($api_key);
                if (!empty($encrypted_key)) {
                    $sanitized['api_key'] = $encrypted_key;
                }
            }
            elseif (!empty($api_key) && !AltTextPro_API_Client::validate_api_key_format($api_key)) {
                // Invalid format — keep existing and show error
                add_settings_error(
                    'alt_text_pro_settings',
                    'invalid_api_key_format',
                    esc_html__('Invalid API key format. API keys should start with "alt_" or "altai_".', 'alt-text-pro'),
                    'error'
                );
                // Preserve existing key
                $sanitized['api_key'] = $existing_settings['api_key'];
            }
            else {
                // Empty key - preserve existing key (user didn't change it)
                $sanitized['api_key'] = $existing_settings['api_key'] ?? '';
            }
        }

        // Checkboxes: if they are present in POST, they are checked. If absent but other settings are present, they are unchecked.
        // We only do this if we are actually processing form submission containing this option group
        // (verified by checking for a known field that is always submitted or the fact that this callback ran from HTTP POST).
        $alt_text_pro_request_method = isset($_SERVER['REQUEST_METHOD'])
            ? sanitize_text_field(wp_unslash($_SERVER['REQUEST_METHOD']))
            : '';
        if ('POST' === $alt_text_pro_request_method) {
            $sanitized['auto_generate'] = !empty($input['auto_generate']);
            $sanitized['overwrite_existing'] = !empty($input['overwrite_existing']);
            $sanitized['context_enabled'] = !empty($input['context_enabled']);
            $sanitized['show_context_field'] = !empty($input['show_context_field']);
        }

        // Sanitize batch size
        if (isset($input['batch_size'])) {
            $sanitized['batch_size'] = min(10, max(1, intval($input['batch_size'])));
        }

        // Sanitize blog context (textarea, max 500 chars)
        if (isset($input['blog_context'])) {
            $sanitized['blog_context'] = sanitize_textarea_field(substr($input['blog_context'], 0, 500));
        }

        return $sanitized;
    }

    /**
     * Settings section callback
     */
    public function settings_section_callback()
    {
        echo '<p>' . esc_html__('Configure your Alt Text Pro settings below. You can get your API key from your Alt Text Pro dashboard.', 'alt-text-pro') . '</p>';
    }

    /**
     * API key field callback
     */
    public function api_key_field_callback()
    {
        $settings = $this->get_settings();
        $api_key = $settings['api_key'];
        $has_key = !empty($api_key);
        $placeholder = $has_key
            ? __('Saved key hidden. Enter a new key to replace it.', 'alt-text-pro')
            : __('alt_... or altai_...', 'alt-text-pro');

        echo '<div class="alt-text-pro-api-key-field">';
        echo '<input type="password" id="api_key" name="alt_text_pro_settings[api_key]" value="" class="regular-text" placeholder="' . esc_attr($placeholder) . '" autocomplete="off" data-has-key="' . esc_attr($has_key ? '1' : '0') . '" />';
        echo '<button type="button" class="button button-secondary" id="toggle-api-key" aria-label="' . esc_attr__('Show API key', 'alt-text-pro') . '">';
        echo '<span class="dashicons dashicons-visibility"></span>';
        echo '</button>';
        echo '<button type="button" class="button button-secondary" id="test-connection" style="margin-left: 10px;">';
        echo '<span class="dashicons dashicons-admin-plugins"></span> ' . esc_html__('Test Connection', 'alt-text-pro');
        echo '</button>';
        echo '<div id="connection-test-result" style="margin-top: 10px;"></div>';
        echo '</div>';

        if ($has_key) {
            echo '<p class="description">' . esc_html__('An API key is already saved. Leave this blank to keep it, or paste a new key to replace it.', 'alt-text-pro') . '</p>';
        }

        echo '<p class="description">';
        echo wp_kses_post(
            sprintf(
            // translators: %s: URL to Alt Text Pro dashboard
            esc_html__('Enter your Alt Text Pro API key. You can find this in your <a href="%1$s" target="_blank">Alt Text Pro dashboard</a>.', 'alt-text-pro'),
            esc_url('https://www.alt-text.pro/dashboard')
        )
        );
        echo '</p>';
    }

    /**
     * Auto generate field callback
     */
    public function auto_generate_field_callback()
    {
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
    public function overwrite_existing_field_callback()
    {
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
    public function context_enabled_field_callback()
    {
        $settings = get_option('alt_text_pro_settings', $this->get_default_settings());
        $context_enabled = $settings['context_enabled'];

        echo '<label>';
        echo '<input type="checkbox" id="context_enabled" name="alt_text_pro_settings[context_enabled]" value="1" ' . checked(1, $context_enabled, false) . ' />';
        echo ' ' . esc_html__('Enable context-aware alt-text generation', 'alt-text-pro');
        echo '</label>';

        echo '<p class="description">';
        echo esc_html__('When enabled, plugin will try to provide context information (like page title, filename) to improve alt-text quality.', 'alt-text-pro');
        echo '</p>';
    }

    /**
     * Batch size field callback
     */
    public function batch_size_field_callback()
    {
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
    public function ajax_test_connection()
    {
        check_ajax_referer('alt_text_pro_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have permission to perform this action.', 'alt-text-pro'));
        }

        $api_key = isset($_POST['api_key']) ? sanitize_text_field(wp_unslash($_POST['api_key'])) : '';
        $use_saved_key = !empty($_POST['use_saved_key']);

        if (empty($api_key) && $use_saved_key) {
            $settings = $this->get_settings();
            $api_key = $settings['api_key'] ?? '';
        }

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
        }
        else {
            wp_send_json_error($result['message']);
        }
    }

    /**
     * AJAX reset settings
     */
    public function ajax_reset_settings()
    {
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
    public function get_settings()
    {
        $settings = get_option('alt_text_pro_settings', $this->get_default_settings());

        // Decrypt API key when reading from database
        if (!empty($settings['api_key'])) {
            $decrypted = $this->decrypt_api_key($settings['api_key']);
            if ($decrypted !== false) {
                $settings['api_key'] = $decrypted;
            }
            // If decryption fails, value might be stored in plain text (pre-encryption)
            // Auto-migrate: encrypt it now so it's encrypted next time
            if ($decrypted === false && AltTextPro_API_Client::validate_api_key_format($settings['api_key'])) {
                $raw_settings = get_option('alt_text_pro_settings', $this->get_default_settings());
                $raw_settings['api_key'] = $this->encrypt_api_key($settings['api_key']);
                update_option('alt_text_pro_settings', $raw_settings);
            }
        }

        return $settings;
    }

    /**
     * Update setting
     */
    public function update_setting($key, $value)
    {
        $settings = $this->get_settings();
        $settings[$key] = $value;
        return update_option('alt_text_pro_settings', $settings);
    }

    /**
     * Get setting
     */
    public function get_setting($key, $default = null)
    {
        $settings = $this->get_settings();
        return $settings[$key] ?? $default;
    }

    /**
     * Check if API is configured
     */
    public function is_api_configured()
    {
        $settings = $this->get_settings();
        return !empty($settings['api_key']);
    }

    /**
     * Export settings
     */
    public function export_settings()
    {
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
    public function import_settings($import_data)
    {
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

    // ═════════════════════════════════════════════════════════════════
    // ENCRYPTION / DECRYPTION
    // ═════════════════════════════════════════════════════════════════

    /**
     * Get encryption key derived from WordPress AUTH_KEY.
     * AUTH_KEY is unique per WordPress installation (set in wp-config.php).
     *
     * @return string 32-byte key for AES-256
     */
    private function get_encryption_key()
    {
        $secret = defined('AUTH_KEY') ? AUTH_KEY : 'alt-text-pro-default-key';
        return hash('sha256', $secret, true); // 32 bytes for AES-256
    }

    /**
     * Encrypt an API key before storing in database.
     *
     * @param string $plain_text The plain-text API key
     * @return string Base64-encoded encrypted string (IV:ciphertext)
     */
    public function encrypt_api_key($plain_text)
    {
        if (empty($plain_text)) {
            return '';
        }

        if (!function_exists('openssl_encrypt')) {
            // OpenSSL not available — store as-is (fallback)
            return $plain_text;
        }

        $key = $this->get_encryption_key();
        $iv_length = openssl_cipher_iv_length($this->cipher);
        $iv = openssl_random_pseudo_bytes($iv_length);

        $encrypted = openssl_encrypt($plain_text, $this->cipher, $key, OPENSSL_RAW_DATA, $iv);

        if ($encrypted === false) {
            return $plain_text; // Fallback to plain text on failure
        }

        // Prefix with 'enc:' marker so we can detect encrypted vs plain values
        return 'enc:' . base64_encode($iv . $encrypted);
    }

    /**
     * Decrypt an API key read from database.
     *
     * @param string $encrypted_text The encrypted API key (enc:base64...)
     * @return string|false The decrypted API key, or false if not encrypted
     */
    public function decrypt_api_key($encrypted_text)
    {
        if (empty($encrypted_text)) {
            return '';
        }

        // Only attempt decryption if value has our 'enc:' prefix
        if (strpos($encrypted_text, 'enc:') !== 0) {
            return false; // Not encrypted — return false to signal plain text
        }

        if (!function_exists('openssl_decrypt')) {
            return false;
        }

        $key = $this->get_encryption_key();
        $data = base64_decode(substr($encrypted_text, 4)); // Remove 'enc:' prefix

        if ($data === false) {
            return false;
        }

        $iv_length = openssl_cipher_iv_length($this->cipher);

        if (strlen($data) < $iv_length) {
            return false;
        }

        $iv = substr($data, 0, $iv_length);
        $ciphertext = substr($data, $iv_length);

        $decrypted = openssl_decrypt($ciphertext, $this->cipher, $key, OPENSSL_RAW_DATA, $iv);

        return $decrypted !== false ? $decrypted : false;
    }
}
