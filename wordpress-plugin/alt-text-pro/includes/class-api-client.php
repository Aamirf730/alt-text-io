<?php
/**
 * API Client for Alt-Text AI
 * 
 * Handles all communication with the Alt-Text AI SaaS API
 */

if (!defined('ABSPATH')) {
    exit;
}

class AltTextPro_API_Client
{

    // Largest original file the plugin will read at all (memory safety).
    private const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024;

    // Largest image sent as-is. Base64 adds a third, keeping the JSON body
    // well under the service's ~6 MB request limit.
    private const MAX_DIRECT_UPLOAD_BYTES = 3 * 1024 * 1024;

    // Longest edge after downscaling; plenty of detail for alt text.
    private const MAX_UPLOAD_DIMENSION = 2048;

    // Formats the AI service reads directly.
    private const DIRECT_UPLOAD_MIME_TYPES = array('image/jpeg', 'image/png', 'image/webp', 'image/gif');


    private $api_base;
    private $api_key;

    /**
     * Constructor
     */
    public function __construct()
    {
        $this->api_base = ALT_TEXT_PRO_API_BASE;
        $settings_handler = new AltTextPro_Settings();
        $decrypted_settings = $settings_handler->get_settings();
        $this->api_key = $decrypted_settings['api_key'] ?? '';
    }

    /**
     * Generate alt-text for an image
     * 
     * @param int    $attachment_id The attachment ID
     * @param string $context       Individual image context (optional)
     * @param string $blog_context  Global blog context from settings (optional)
     */
    public function generate_alt_text($attachment_id, $context = '', $blog_context = '')
    {
        if (empty($this->api_key)) {
            return array(
                'success' => false,
                'message' => esc_html__('API key not configured. Please check your settings.', 'alt-text-pro')
            );
        }

        // Get image data
        $image_data = $this->get_image_base64($attachment_id);
        if (!$image_data) {
            $file_path = get_attached_file($attachment_id);
            $file_size = ($file_path && file_exists($file_path)) ? (int) filesize($file_path) : 0;

            if ($file_size > self::MAX_DIRECT_UPLOAD_BYTES) {
                return array(
                    'success' => false,
                    'message' => esc_html__('Image too large to process, and it could not be resized on this server.', 'alt-text-pro'),
                    'status_code' => 413,
                    'image_too_large' => true,
                    'retryable' => false
                );
            }

            return array(
                'success' => false,
                'message' => esc_html__('Failed to process image data. Please check that the image file exists and is readable.', 'alt-text-pro')
            );
        }

        // Combine blog context and individual image context
        $combined_context = trim($blog_context . ($blog_context && $context ? ' | ' : '') . $context);

        // Prepare request data
        $request_data = array(
            'image_base64' => $image_data,
            'context' => $combined_context
        );

        // Make API request
        $response = $this->make_request('generate-alt-text', 'POST', $request_data);

        // Handle successful response - API can return alt_text in different formats
        if ($response['success']) {
            $alt_text = null;
            $credits_used = 1;
            $credits_remaining = 0;

            // Try to find alt_text in different possible locations
            if (isset($response['data']['alt_text'])) {
                // Format 1: Nested in data key
                $alt_text = $response['data']['alt_text'];
                $credits_used = $response['data']['credits_used'] ?? 1;
                $credits_remaining = $response['data']['credits_remaining'] ?? 0;
            }
            elseif (isset($response['full_response']['alt_text'])) {
                // Format 2: In full_response (when API returns direct object)
                $alt_text = $response['full_response']['alt_text'];
                $credits_used = $response['full_response']['credits_used'] ?? 1;
                $credits_remaining = $response['full_response']['credits_remaining'] ?? 0;
            }
            elseif (isset($response['data']) && is_array($response['data'])) {
                // Format 3: Check if data is the direct response object (Netlify format)
                // Netlify returns: { alt_text: "...", credits_used: 1, ... }
                // make_request wraps it as: { success: true, data: { alt_text: "...", ... } }
                if (isset($response['data']['alt_text'])) {
                    $alt_text = $response['data']['alt_text'];
                    $credits_used = $response['data']['credits_used'] ?? 1;
                    $credits_remaining = $response['data']['credits_remaining'] ?? 0;
                }
            }

            if (!empty($alt_text)) {
                return array(
                    'success' => true,
                    'alt_text' => $alt_text,
                    'credits_used' => $credits_used,
                    'credits_remaining' => $credits_remaining
                );
            }

        }

        // Return error response with proper message
        return array(
            'success' => false,
            'message' => $response['message'] ?? esc_html__('Failed to generate alt-text. Please check your API key and try again.', 'alt-text-pro'),
            'status_code' => $response['status_code'] ?? null,
            'retryable' => $response['retryable'] ?? false,
            'retry_after_seconds' => $response['retry_after_seconds'] ?? null,
            'code' => $response['code'] ?? null,
            'image_too_large' => $response['image_too_large'] ?? false,
            'no_credits' => $response['no_credits'] ?? false
        );
    }

    /**
     * Get usage statistics
     */
    public function get_usage_stats()
    {
        if (empty($this->api_key)) {
            return array(
                'success' => false,
                'message' => esc_html__('API key not configured.', 'alt-text-pro')
            );
        }

        // Account state renders admin pages; do not let a slow service hold
        // them for the full generation timeout.
        return $this->make_request('get-usage', 'GET', array(), 15);
    }

    /**
     * Validate API key
     */
    public function validate_api_key($api_key = null)
    {
        $key_to_validate = $api_key ?? $this->api_key;

        if (empty($key_to_validate)) {
            return array(
                'success' => false,
                'message' => esc_html__('No API key provided.', 'alt-text-pro')
            );
        }

        // Temporarily set the API key for validation
        $original_key = $this->api_key;
        $this->api_key = $key_to_validate;

        // Use the flat endpoint format (auth-validate) as Netlify doesn't support nested paths for functions
        $response = $this->make_request('auth-validate', 'POST', array());

        // Restore original key
        $this->api_key = $original_key;

        return $response;
    }

    /**
     * Get image as base64
     */
    private function get_image_base64($attachment_id)
    {
        $file_path = get_attached_file($attachment_id);

        if (!$file_path || !file_exists($file_path)) {
            return false;
        }

        // Check if it's an image
        $mime_type = (string) get_post_mime_type($attachment_id);
        if (strpos($mime_type, 'image/') !== 0) {
            return false;
        }

        $file_size = (int) filesize($file_path);
        if ($file_size <= 0 || $file_size > self::MAX_SOURCE_IMAGE_BYTES) {
            return false;
        }

        // Send the original only when it is small and in a format the AI
        // service reads. Everything else is downscaled and re-encoded so the
        // request stays under the service's ~6 MB body limit (base64 adds a
        // third) and formats such as HEIC, BMP or TIFF still work.
        if ($file_size <= self::MAX_DIRECT_UPLOAD_BYTES && in_array($mime_type, self::DIRECT_UPLOAD_MIME_TYPES, true)) {
            $image_data = file_get_contents($file_path);
        } else {
            $image_data = $this->get_resized_image_data($file_path, $mime_type);
        }

        if (!is_string($image_data) || $image_data === '' || strlen($image_data) > self::MAX_DIRECT_UPLOAD_BYTES) {
            return false;
        }

        $base64_data = base64_encode($image_data);

        // Validate base64 encoding succeeded
        if (empty($base64_data)) {
            return false;
        }

        return $base64_data;
    }

    /**
     * Downscale an image with the WordPress image editor and return the
     * encoded bytes, or false when no editor can read the file.
     */
    private function get_resized_image_data($file_path, $source_mime_type)
    {
        if (!function_exists('wp_get_image_editor')) {
            return false;
        }

        $editor = wp_get_image_editor($file_path);
        if (is_wp_error($editor)) {
            return false;
        }

        $size = $editor->get_size();
        if (
            is_array($size)
            && (intval($size['width'] ?? 0) > self::MAX_UPLOAD_DIMENSION || intval($size['height'] ?? 0) > self::MAX_UPLOAD_DIMENSION)
        ) {
            $resized = $editor->resize(self::MAX_UPLOAD_DIMENSION, self::MAX_UPLOAD_DIMENSION, false);
            if (is_wp_error($resized)) {
                return false;
            }
        }

        $editor->set_quality(82);

        // Keep transparency where it matters; JPEG for everything else.
        $target_mime_type = 'image/jpeg';
        if (in_array($source_mime_type, array('image/png', 'image/gif', 'image/webp', 'image/avif'), true)) {
            $target_mime_type = wp_image_editor_supports(array('mime_type' => 'image/webp')) ? 'image/webp' : 'image/png';
        }

        $extension = $target_mime_type === 'image/webp' ? 'webp' : ($target_mime_type === 'image/png' ? 'png' : 'jpg');

        // Uploads through the REST API (block editor) do not load wp-admin.
        if (!function_exists('wp_tempnam')) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
        }
        $temp_base = wp_tempnam('alt-text-pro-upload');
        if (!$temp_base) {
            return false;
        }
        $temp_path = $temp_base . '.' . $extension;

        $saved = $editor->save($temp_path, $target_mime_type);
        $image_data = false;

        if (!is_wp_error($saved) && !empty($saved['path']) && file_exists($saved['path'])) {
            $image_data = file_get_contents($saved['path']);
            wp_delete_file($saved['path']);
        }

        wp_delete_file($temp_base);
        if (file_exists($temp_path)) {
            wp_delete_file($temp_path);
        }

        return $image_data;
    }

    /**
     * Make API request
     */
    private function make_request($endpoint, $method = 'GET', $data = array(), $timeout = 60)
    {
        // Ensure proper URL construction (remove trailing slash from base, ensure single slash)
        $api_base = rtrim($this->api_base, '/');
        $endpoint = ltrim($endpoint, '/');
        $url = $api_base . '/' . $endpoint;

        $headers = array(
            'Content-Type' => 'application/json',
            'Authorization' => 'Bearer ' . $this->api_key,
            'X-Alt-Text-Pro-Version' => ALT_TEXT_PRO_VERSION
        );

        $args = array(
            'method' => $method,
            'headers' => $headers,
            'timeout' => max(5, intval($timeout)),
            'sslverify' => true
        );

        if ($method === 'POST' && !empty($data)) {
            $args['body'] = json_encode($data);
        }

        $response = wp_remote_request($url, $args);

        // Handle WordPress errors
        if (is_wp_error($response)) {
            $request_error = $response->get_error_message();
            $normalized_request_error = strtolower($request_error);
            $is_payload_too_large = strpos($normalized_request_error, '413') !== false ||
                strpos($normalized_request_error, 'payload too large') !== false ||
                strpos($normalized_request_error, 'request entity too large') !== false;

            if ($is_payload_too_large) {
                return array(
                    'success' => false,
                    'message' => esc_html__('Image too large to process.', 'alt-text-pro'),
                    'status_code' => 413,
                    'image_too_large' => true,
                    'retryable' => false
                );
            }

            return array(
                'success' => false,
                'message' => esc_html__('Could not reach the Alt Text Pro service. Please try again.', 'alt-text-pro'),
                'retryable' => true
            );
        }

        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $decoded_body = json_decode($body, true);

        // Handle API errors
        if ($status_code >= 400) {
            // Extract error message from response
            $error_message = null;

            if (is_array($decoded_body)) {
                $error_message = $decoded_body['error'] ?? $decoded_body['message'] ?? null;
            }

            // If we still don't have an error message, try to get it from the raw body
            if (empty($error_message) && !empty($body)) {
                // Maybe the body is a string error message
                if (is_string($body) && strlen($body) < 200) {
                    $error_message = $body;
                }
            }

            $error_message = $this->sanitize_api_error_message($error_message);

            // Default error message
            if (empty($error_message)) {
                $error_message = sprintf(
                    // translators: %d: HTTP status code
                    esc_html__('API error (Status: %1$d)', 'alt-text-pro'),
                    $status_code
                );
            }

            // Handle specific error codes with more specific messages
            switch ($status_code) {
                case 401:
                    $error_message = esc_html__('Invalid API key. Please check your settings and ensure your API key is correct.', 'alt-text-pro');
                    break;
                case 402:
                    $error_message = esc_html__('No credits remaining. Please upgrade your plan.', 'alt-text-pro');
                    // Mark as no credits error for bulk processing to stop
                    return array(
                        'success' => false,
                        'message' => $error_message,
                        'no_credits' => true, // Special flag to indicate credits exhausted
                        'status_code' => 402
                    );
                case 403:
                    $error_message = esc_html__('Access forbidden. Please check your API key permissions.', 'alt-text-pro');
                    break;
                case 404:
                    $error_message = esc_html__('The requested Alt Text Pro service is unavailable. Please update the plugin or try again later.', 'alt-text-pro');
                    break;
                case 413:
                    $error_message = esc_html__('Image too large to process.', 'alt-text-pro');
                    break;
                case 429:
                    $retry_after_seconds = null;
                    if (is_array($decoded_body) && isset($decoded_body['retry_after_seconds'])) {
                        $retry_after_seconds = max(1, intval($decoded_body['retry_after_seconds']));
                    }
                    $error_message = is_array($decoded_body) && !empty($decoded_body['message'])
                        ? sanitize_text_field($decoded_body['message'])
                        : esc_html__('AI generation is temporarily rate limited. The plugin will wait and retry automatically.', 'alt-text-pro');

                    return array(
                        'success' => false,
                        'message' => $error_message,
                        'retryable' => true,
                        'retry_after_seconds' => $retry_after_seconds,
                        'code' => is_array($decoded_body) && isset($decoded_body['code']) ? sanitize_key($decoded_body['code']) : 'rate_limited',
                        'status_code' => 429
                    );
                case 500:
                    $error_message = esc_html__('The Alt Text Pro service encountered an error. Please try again later.', 'alt-text-pro');
                    break;
            }

            if ($status_code >= 500) {
                $error_message = esc_html__('The Alt Text Pro service encountered an error. Please try again later.', 'alt-text-pro');
            }

            // Handle specific AI service errors (moved inside status >= 400 block)
            if (!empty($error_message) && (stripos($error_message, 'AI Service') !== false || stripos($error_message, 'empty response') !== false)) {
                $error_message = esc_html__('AI service returned an empty or blocked response. This may be due to image content restrictions or API limitations.', 'alt-text-pro');
            }

            return array(
                'success' => false,
                'message' => $error_message,
                'status_code' => $status_code,
                'retryable' => is_array($decoded_body) ? (bool) ($decoded_body['retryable'] ?? false) : false,
                'retry_after_seconds' => is_array($decoded_body) ? ($decoded_body['retry_after_seconds'] ?? null) : null,
                'code' => is_array($decoded_body) && isset($decoded_body['code']) ? sanitize_key($decoded_body['code']) : null,
                'image_too_large' => $status_code === 413
            );
        }

        // Check if response body is valid JSON and has expected structure
        if (json_last_error() !== JSON_ERROR_NONE) {
            return array(
                'success' => false,
                'message' => esc_html__('The Alt Text Pro service returned an invalid response. Please try again.', 'alt-text-pro'),
                'status_code' => $status_code
            );
        }

        // Check for error key FIRST - even when status is 200 (some APIs return errors with 200 status)
        // This must be checked before checking for success, as error takes priority
        if (isset($decoded_body['error'])) {
            $error_message = $this->sanitize_api_error_message($decoded_body['error']);

            // Check if it's an authentication error
            // Only override if status code is 401 (Unauthorized)
            if ($status_code === 401) {
                $error_message = esc_html__('Invalid or expired API key. Please check your API key in settings and ensure it\'s correct.', 'alt-text-pro');
            }

            // The mapping for AI Service error is now handled above for status >= 400

            return array(
                'success' => false,
                'message' => $error_message,
                'status_code' => $status_code,
                'data' => $decoded_body
            );
        }

        // Check if the API response itself indicates an error (some APIs return 200 with error in body)
        if (isset($decoded_body['success']) && $decoded_body['success'] === false) {
            $error_message = $this->sanitize_api_error_message(
                $decoded_body['error'] ?? $decoded_body['message'] ?? esc_html__('API returned an error.', 'alt-text-pro')
            );
            return array(
                'success' => false,
                'message' => $error_message,
                'status_code' => $status_code,
                'data' => $decoded_body
            );
        }

        // Success response handling - API can return different formats:
        // Format 1: { success: true, data: {...} }
        // Format 2: { success: true, valid: true, user: {...} }
        // Format 3: Direct data object
        if (isset($decoded_body['data'])) {
            return array(
                'success' => true,
                'data' => $decoded_body['data'],
                'status_code' => $status_code,
                'full_response' => $decoded_body
            );
        }

        // Handle format with 'valid' and 'user' keys directly (for auth-validate endpoint)
        if (isset($decoded_body['valid']) && $decoded_body['valid'] === true && isset($decoded_body['user'])) {
            return array(
                'success' => true,
                'data' => array(
                    'user' => $decoded_body['user']
                ),
                'status_code' => $status_code,
                'full_response' => $decoded_body
            );
        }

        // Fallback: if no 'data' key, return the whole response
        return array(
            'success' => true,
            'data' => $decoded_body,
            'status_code' => $status_code
        );
    }

    /**
     * Keep remote service errors short, plain-text, and safe for admin notices.
     */
    private function sanitize_api_error_message($message)
    {
        if (!is_scalar($message) || $message === '') {
            return '';
        }

        return substr(sanitize_text_field((string) $message), 0, 300);
    }

    /**
     * Test API connection
     */
    public function test_connection()
    {
        if (empty($this->api_key)) {
            return array(
                'success' => false,
                'message' => esc_html__('No API key configured.', 'alt-text-pro')
            );
        }

        // Try to get usage stats as a connection test
        $response = $this->get_usage_stats();

        if ($response['success']) {
            return array(
                'success' => true,
                'message' => esc_html__('Connection successful!', 'alt-text-pro'),
                'data' => $response['data']
            );
        }

        return $response;
    }

    /**
     * Get API key format validation
     */
    public static function validate_api_key_format($api_key)
    {
        // API key format: alt_[base64_string]
        // Accept both old format (altai_) and new format (alt_)
        if (strpos($api_key, 'alt_') === 0) {
            // New format: alt_ followed by base64-like string
            return strlen($api_key) > 20; // At least 20 characters
        }
        if (strpos($api_key, 'altai_') === 0) {
            // Legacy format: altai_[hash]_[random]_[timestamp]
            $pattern = '/^altai_[a-zA-Z0-9]+_[a-zA-Z0-9]+_[a-zA-Z0-9]+$/';
            return preg_match($pattern, $api_key);
        }
        return false;
    }

    /**
     * Get API endpoint URL
     */
    public function get_api_url($endpoint = '')
    {
        return $this->api_base . ($endpoint ? '/' . $endpoint : '');
    }
}
