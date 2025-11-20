<?php
/**
 * API Client for Alt-Text AI
 * 
 * Handles all communication with the Alt-Text AI SaaS API
 */

if (!defined('ABSPATH')) {
    exit;
}

class AltTextAI_API_Client {
    
    private $api_base;
    private $api_key;
    
    /**
     * Constructor
     */
    public function __construct() {
        $this->api_base = ALT_TEXT_AI_API_BASE;
        $settings = get_option('alt_text_ai_settings', array());
        $this->api_key = $settings['api_key'] ?? '';
    }
    
    /**
     * Generate alt-text for an image
     */
    public function generate_alt_text($attachment_id, $context = '') {
        if (empty($this->api_key)) {
            return array(
                'success' => false,
                'message' => esc_html__('API key not configured. Please check your settings.', 'alt-text-ai')
            );
        }
        
        // Get image data
        $image_data = $this->get_image_base64($attachment_id);
        if (!$image_data) {
            $file_path = get_attached_file($attachment_id);
            $file_size = $file_path ? filesize($file_path) : 0;
            $max_size = 15 * 1024 * 1024; // 15MB
            
            if ($file_size > $max_size) {
                return array(
                    'success' => false,
                    'message' => sprintf(
                        // translators: %s: File size in human-readable format
                        esc_html__('Image file is too large (%1$s). Maximum size is 15MB.', 'alt-text-ai'),
                        esc_html(size_format($file_size))
                    )
                );
            }
            
            return array(
                'success' => false,
                'message' => esc_html__('Failed to process image data. Please check that the image file exists and is readable.', 'alt-text-ai')
            );
        }
        
        // Prepare request data
        $request_data = array(
            'image_base64' => $image_data,
            'context' => $context
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
            } elseif (isset($response['full_response']['alt_text'])) {
                // Format 2: In full_response (when API returns direct object)
                $alt_text = $response['full_response']['alt_text'];
                $credits_used = $response['full_response']['credits_used'] ?? 1;
                $credits_remaining = $response['full_response']['credits_remaining'] ?? 0;
            } elseif (isset($response['data']) && is_array($response['data'])) {
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
            
            // Log for debugging if we have success but no alt_text
            // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log, WordPress.PHP.DevelopmentFunctions.error_log_print_r
            error_log('Alt Text Pro API: Success response but alt_text not found. Response structure: ' . print_r($response, true));
        }
        
        // Return error response with proper message
        return array(
            'success' => false,
            'message' => $response['message'] ?? esc_html__('Failed to generate alt-text. Please check your API key and try again.', 'alt-text-ai'),
            'data' => $response['data'] ?? null,
            'status_code' => $response['status_code'] ?? null
        );
    }
    
    /**
     * Get usage statistics
     */
    public function get_usage_stats() {
        if (empty($this->api_key)) {
            return array(
                'success' => false,
                'message' => esc_html__('API key not configured.', 'alt-text-ai')
            );
        }
        
        return $this->make_request('get-usage', 'GET');
    }
    
    /**
     * Validate API key
     */
    public function validate_api_key($api_key = null) {
        $key_to_validate = $api_key ?? $this->api_key;
        
        if (empty($key_to_validate)) {
            return array(
                'success' => false,
                'message' => esc_html__('No API key provided.', 'alt-text-ai')
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
    private function get_image_base64($attachment_id) {
        $file_path = get_attached_file($attachment_id);
        
        if (!$file_path || !file_exists($file_path)) {
            // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
            error_log(sprintf('Alt Text Pro: File not found for attachment %d: %s', $attachment_id, $file_path));
            return false;
        }
        
        // Check if it's an image
        $mime_type = get_post_mime_type($attachment_id);
        if (!str_starts_with($mime_type, 'image/')) {
            // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
            error_log(sprintf('Alt Text Pro: Invalid mime type for attachment %d: %s', $attachment_id, $mime_type));
            return false;
        }
        
        // Check file size (Gemini API limit is ~20MB, but base64 increases size by ~33%)
        // So we limit to ~15MB raw file size to be safe
        $file_size = filesize($file_path);
        $max_size = 15 * 1024 * 1024; // 15MB in bytes
        
        if ($file_size > $max_size) {
            // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
            error_log(sprintf('Alt Text Pro: Image too large for attachment %d: %d bytes (max: %d)', $attachment_id, $file_size, $max_size));
            return false;
        }
        
        // Get image data
        $image_data = file_get_contents($file_path);
        if ($image_data === false) {
            // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
            error_log(sprintf('Alt Text Pro: Failed to read file for attachment %d: %s', $attachment_id, $file_path));
            return false;
        }
        
        // Validate image data is not empty
        if (empty($image_data)) {
            // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
            error_log(sprintf('Alt Text Pro: Empty image data for attachment %d', $attachment_id));
            return false;
        }
        
        $base64_data = base64_encode($image_data);
        
        // Validate base64 encoding succeeded
        if (empty($base64_data)) {
            // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
            error_log(sprintf('Alt Text Pro: Failed to encode image to base64 for attachment %d', $attachment_id));
            return false;
        }
        
        return $base64_data;
    }
    
    /**
     * Make API request
     */
    private function make_request($endpoint, $method = 'GET', $data = array()) {
        // Ensure proper URL construction (remove trailing slash from base, ensure single slash)
        $api_base = rtrim($this->api_base, '/');
        $endpoint = ltrim($endpoint, '/');
        $url = $api_base . '/' . $endpoint;
        
        $headers = array(
            'Content-Type' => 'application/json',
            'Authorization' => 'Bearer ' . $this->api_key
        );
        
        $args = array(
            'method' => $method,
            'headers' => $headers,
            'timeout' => 60,
            'sslverify' => true
        );
        
        if ($method === 'POST' && !empty($data)) {
            $args['body'] = json_encode($data);
        }
        
        // Debug logging (always log for troubleshooting)
        // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
        error_log(sprintf(
            'Alt Text Pro API Request: %s %s | Endpoint: %s | Base: %s',
            $method,
            $url,
            $endpoint,
            $this->api_base
        ));
        
        $response = wp_remote_request($url, $args);
        
        // Handle WordPress errors
        if (is_wp_error($response)) {
            return array(
                'success' => false,
                'message' => sprintf(
                    // translators: %s: Error message
                    esc_html__('Request failed: %1$s', 'alt-text-ai'),
                    esc_html($response->get_error_message())
                )
            );
        }
        
        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $decoded_body = json_decode($body, true);
        
        // Always log response for troubleshooting (with sanitized API key)
        $log_data = array(
            'full_url' => $url,
            'endpoint_called' => $endpoint,
            'api_base' => $this->api_base,
            'method' => $method,
            'status_code' => $status_code,
            'body_length' => strlen($body),
            'body_preview' => substr($body, 0, 500), // First 500 chars
            'is_html_404' => (strpos($body, '<!DOCTYPE html>') !== false && $status_code === 404),
            'decoded' => $decoded_body,
            'json_error' => json_last_error() !== JSON_ERROR_NONE ? json_last_error_msg() : null
        );
        // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log, WordPress.PHP.DevelopmentFunctions.error_log_print_r
        error_log('Alt Text Pro API Response: ' . print_r($log_data, true));
        
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
            
            // Default error message
            if (empty($error_message)) {
                $error_message = sprintf(
                    // translators: %d: HTTP status code
                    esc_html__('API error (Status: %1$d)', 'alt-text-ai'),
                    $status_code
                );
            }
            
            // Handle specific error codes with more specific messages
            switch ($status_code) {
                case 401:
                    $error_message = esc_html__('Invalid API key. Please check your settings and ensure your API key is correct.', 'alt-text-ai');
                    break;
                case 402:
                    $error_message = esc_html__('No credits remaining. Please upgrade your plan.', 'alt-text-ai');
                    // Mark as no credits error for bulk processing to stop
                    return array(
                        'success' => false,
                        'message' => $error_message,
                        'no_credits' => true, // Special flag to indicate credits exhausted
                        'status_code' => 402
                    );
                case 403:
                    $error_message = esc_html__('Access forbidden. Please check your API key permissions.', 'alt-text-ai');
                    break;
                case 404:
                    $error_message = sprintf(
                        // translators: %1$s: Requested URL, %2$s: API base URL
                        esc_html__('Endpoint not found (404). Tried: %1$s. Please verify the API base URL is correct: %2$s', 'alt-text-ai'),
                        esc_url($url),
                        esc_url($this->api_base)
                    );
                    break;
                case 429:
                    $error_message = esc_html__('Rate limit exceeded. Please try again later.', 'alt-text-ai');
                    break;
                case 500:
                    $error_message = esc_html__('Server error. Please try again later.', 'alt-text-ai');
                    break;
            }
            
            return array(
                'success' => false,
                'message' => $error_message,
                'status_code' => $status_code,
                'raw_response' => substr($body, 0, 1000), // Limit size
                'url_attempted' => $url
            );
        }
        
        // Check if response body is valid JSON and has expected structure
        if (json_last_error() !== JSON_ERROR_NONE) {
            return array(
                'success' => false,
                'message' => sprintf(
                    // translators: %s: First 100 characters of the response body
                    esc_html__('Invalid API response format. Raw response: %1$s', 'alt-text-ai'),
                    esc_html(substr($body, 0, 100))
                ),
                'status_code' => $status_code
            );
        }
        
        // Check for error key FIRST - even when status is 200 (some APIs return errors with 200 status)
        // This must be checked before checking for success, as error takes priority
        if (isset($decoded_body['error'])) {
            $error_message = $decoded_body['error'];
            
            // Check if it's an authentication error
            if (stripos($error_message, 'invalid') !== false || stripos($error_message, 'expired') !== false || stripos($error_message, 'token') !== false) {
                $error_message = esc_html__('Invalid or expired API key. Please check your API key in settings and ensure it\'s correct.', 'alt-text-ai');
            }
            
            // Handle specific Gemini API errors
            if (stripos($error_message, 'Gemini API') !== false || stripos($error_message, 'empty response') !== false) {
                $error_message = esc_html__('Gemini AI service returned an empty response. This may be due to image content restrictions or API limitations. Please try again or use a different image.', 'alt-text-ai');
            }
            
            return array(
                'success' => false,
                'message' => $error_message,
                'status_code' => $status_code,
                'data' => $decoded_body
            );
        }
        
        // Check if the API response itself indicates an error (some APIs return 200 with error in body)
        if (isset($decoded_body['success']) && $decoded_body['success'] === false) {
            $error_message = $decoded_body['error'] ?? $decoded_body['message'] ?? esc_html__('API returned an error', 'alt-text-ai');
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
     * Test API connection
     */
    public function test_connection() {
        if (empty($this->api_key)) {
            return array(
                'success' => false,
                'message' => esc_html__('No API key configured.', 'alt-text-ai')
            );
        }
        
        // Try to get usage stats as a connection test
        $response = $this->get_usage_stats();
        
        if ($response['success']) {
            return array(
                'success' => true,
                'message' => esc_html__('Connection successful!', 'alt-text-ai'),
                'data' => $response['data']
            );
        }
        
        return $response;
    }
    
    /**
     * Get API key format validation
     */
    public static function validate_api_key_format($api_key) {
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
    public function get_api_url($endpoint = '') {
        return $this->api_base . ($endpoint ? '/' . $endpoint : '');
    }
}
