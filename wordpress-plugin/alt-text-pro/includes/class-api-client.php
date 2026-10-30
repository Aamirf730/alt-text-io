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

    // Offloaded media (S3/CDN): how long to wait for the attachment URL.
    private const REMOTE_IMAGE_TIMEOUT = 20;

    // Raster formats the plugin offers to describe. SVG, icons and other
    // non-raster "image/*" types are excluded; the list matches the formats
    // WordPress itself treats as images (wp_attachment_is_image()).
    // supported_mime_types() drops the ones the running WordPress does not.
    private const SUPPORTED_MIME_TYPES = array(
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/avif',
        'image/heic',
        'image/heif',
    );

    // First WordPress version whose wp_attachment_is_image() accepts each
    // newer format. Older versions reject them, so they are neither counted
    // nor queued there.
    private const MIME_TYPE_MIN_WP_VERSION = array(
        'image/webp' => '5.8',
        'image/avif' => '6.5',
        'image/heic' => '6.7',
        'image/heif' => '6.7',
    );

    // Longest wait the plugin honours from a Retry-After answer.
    private const MAX_RETRY_AFTER_SECONDS = 300;


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
     * MIME types Alt Text Pro can describe on this WordPress version: the
     * same ones wp_attachment_is_image() accepts, so the missing-alt counts
     * match what a bulk run processes.
     *
     * @return string[]
     */
    public static function supported_mime_types()
    {
        global $wp_version;

        // Unknown version (outside WordPress): assume a current one.
        if (!is_string($wp_version) || !preg_match('/^\d+(?:\.\d+)*/', $wp_version, $version_match)) {
            return self::SUPPORTED_MIME_TYPES;
        }

        $running_version = $version_match[0];
        $minimum_versions = self::MIME_TYPE_MIN_WP_VERSION;
        $supported = array();
        foreach (self::SUPPORTED_MIME_TYPES as $mime_type) {
            if (
                !isset($minimum_versions[$mime_type]) ||
                version_compare($running_version, $minimum_versions[$mime_type], '>=')
            ) {
                $supported[] = $mime_type;
            }
        }

        return $supported;
    }

    /**
     * True when the attachment is a raster image the service can describe.
     * SVG, icons and other non-raster files return false.
     */
    public static function is_supported_image($attachment_id)
    {
        $attachment_id = absint($attachment_id);
        if (!$attachment_id || get_post_type($attachment_id) !== 'attachment') {
            return false;
        }

        $mime_type = strtolower((string) get_post_mime_type($attachment_id));
        return in_array($mime_type, self::supported_mime_types(), true);
    }

    /**
     * SQL fragment limiting an attachment query to supported image types.
     *
     * @param string $table_alias Alias of the posts table in the query.
     */
    public static function get_supported_mime_sql_clause($table_alias = 'p')
    {
        global $wpdb;

        $mime_types = self::supported_mime_types();
        $placeholders = implode(', ', array_fill(0, count($mime_types), '%s'));
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare -- alias is internal, placeholders match the values
        return $wpdb->prepare(" AND {$table_alias}.post_mime_type IN ({$placeholders})", $mime_types);
    }

    /**
     * This site's address as the service records it for "connected sites".
     */
    public static function get_site_url()
    {
        return function_exists('home_url') ? rtrim((string) home_url('/'), '/') : '';
    }

    /**
     * Tell the service this site no longer uses the key. Best effort: the
     * key itself stays valid because every site of the account shares it.
     *
     * @param string $api_key  Plain API key; defaults to the saved key.
     * @param bool   $blocking False sends the request without waiting for
     *                         the answer (uninstall, where a slow service
     *                         must not hold up every site of a network).
     * @return bool True when the service confirmed the request, or, when not
     *              blocking, when the request was sent.
     */
    public function disconnect_site($api_key = null, $blocking = true)
    {
        $key = $api_key ?? $this->api_key;
        if (empty($key)) {
            return false;
        }

        $original_key = $this->api_key;
        $this->api_key = $key;
        $response = $this->make_request('site-disconnect', 'POST', array('site_url' => self::get_site_url()), 5, (bool) $blocking);
        $this->api_key = $original_key;

        return !empty($response['success']);
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

        // A decorative image keeps an empty alt on purpose: never spend a
        // credit on it, whichever button or run asked.
        if (class_exists('AltTextPro_Image_Details') && AltTextPro_Image_Details::is_decorative($attachment_id)) {
            return array(
                'success' => false,
                'message' => esc_html(AltTextPro_Image_Details::get_decorative_message()),
                'code' => 'decorative_image',
                'retryable' => false,
                'decorative' => true,
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

        // Prepare request data. The language is a BCP-47 tag such as "de-DE"
        // (the image's own WPML or Polylang language when it has one); the
        // service falls back to English for anything it does not support.
        $request_data = array(
            'image_base64' => $image_data,
            'context' => $combined_context,
            'language' => method_exists('AltTextPro_Settings', 'get_output_language')
                ? AltTextPro_Settings::get_output_language($attachment_id)
                : 'en',
        );

        // Make API request
        $response = $this->make_request('generate-alt-text', 'POST', $request_data);

        // Handle successful response - API can return alt_text in different formats
        if ($response['success']) {
            $alt_text = null;
            $credits_used = 1;
            $credits_remaining = 0;
            $reported = is_array($response['data'] ?? null) && isset($response['data']['alt_text'])
                ? $response['data']
                : (is_array($response['full_response'] ?? null) ? $response['full_response'] : array());

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
                // Keep the low-credit notice current without asking the
                // service again.
                if (isset($reported['credits_remaining']) && is_numeric($reported['credits_remaining']) && class_exists('AltTextPro_Credit_Notice')) {
                    AltTextPro_Credit_Notice::remember_credits(intval($reported['credits_remaining']));
                }

                // Lets a later save of exactly this text fill the image
                // title, caption or description when those settings are on.
                if (class_exists('AltTextPro_Image_Details')) {
                    AltTextPro_Image_Details::remember_generated_alt($attachment_id, $alt_text);
                }

                return array(
                    'success' => true,
                    'alt_text' => $alt_text,
                    'credits_used' => $credits_used,
                    'credits_remaining' => $credits_remaining
                );
            }

        }

        if (!empty($response['no_credits']) && class_exists('AltTextPro_Credit_Notice')) {
            AltTextPro_Credit_Notice::remember_credits(0);
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
            'no_credits' => $response['no_credits'] ?? false,
            'stop_bulk' => $response['stop_bulk'] ?? false,
            // Bulk runs stop when the service itself keeps failing (5xx).
            'server_error' => $response['server_error'] ?? false
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
        $response = $this->make_request('get-usage', 'GET', array(), 15);

        // Every successful check also refreshes the cached credit balance
        // behind the low-credit notice.
        if (!empty($response['success']) && is_array($response['data'] ?? null) && class_exists('AltTextPro_Credit_Notice')) {
            $data = $response['data'];
            $credits = isset($data['monthly_credits_remaining']) && is_numeric($data['monthly_credits_remaining'])
                ? $data['monthly_credits_remaining']
                : ($data['credits_remaining'] ?? null);
            if (is_numeric($credits)) {
                AltTextPro_Credit_Notice::remember_credits(intval($credits));
            }
        } elseif (in_array($response['code'] ?? '', array('invalid_api_key', 'account_not_found'), true) && class_exists('AltTextPro_Credit_Notice')) {
            // A rotated key or deleted account: the old balance no longer
            // applies, so no low-credit notice is shown from it.
            AltTextPro_Credit_Notice::forget_credits();
        }

        return $response;
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
        // Images only, and never SVG (vector markup the service cannot read).
        $mime_type = strtolower((string) get_post_mime_type($attachment_id));
        if (strpos($mime_type, 'image/') !== 0 || strpos($mime_type, 'svg') !== false) {
            return false;
        }

        $file_path = get_attached_file($attachment_id);
        $temp_file = null;

        if (!$file_path || !file_exists($file_path)) {
            // Offloaded media (S3, CDN): the local copy was removed, so read
            // the image from its public URL instead.
            $remote = $this->download_remote_image($attachment_id);
            if (!$remote) {
                return false;
            }
            $file_path = $remote['path'];
            $temp_file = $remote['path'];
            if (!empty($remote['mime_type'])) {
                $mime_type = $remote['mime_type'];
            }
        }

        try {
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
        } finally {
            if ($temp_file !== null && file_exists($temp_file)) {
                wp_delete_file($temp_file);
            }
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
     * Download an attachment whose local file is missing (offloaded media)
     * into a temporary file.
     *
     * @return array|false array('path' => string, 'mime_type' => string), or false.
     */
    private function download_remote_image($attachment_id)
    {
        $url = wp_get_attachment_url($attachment_id);
        if (!$url || !function_exists('wp_safe_remote_get')) {
            return false;
        }

        // Uploads through the REST API (block editor) do not load wp-admin.
        if (!function_exists('wp_tempnam')) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
        }

        $temp_path = wp_tempnam('alt-text-pro-remote');
        if (!$temp_path) {
            return false;
        }

        // wp_safe_remote_get() refuses local and private network addresses.
        // Stream to disk and stop reading one byte past the size limit, so an
        // oversized file is detected without holding it in memory.
        $response = wp_safe_remote_get($url, array(
            'timeout' => self::REMOTE_IMAGE_TIMEOUT,
            'redirection' => 3,
            'stream' => true,
            'filename' => $temp_path,
            'limit_response_size' => self::MAX_SOURCE_IMAGE_BYTES + 1,
        ));

        $fail = function () use ($temp_path) {
            if (file_exists($temp_path)) {
                wp_delete_file($temp_path);
            }
            return false;
        };

        if (is_wp_error($response) || intval(wp_remote_retrieve_response_code($response)) !== 200) {
            return $fail();
        }

        $content_type = strtolower(trim((string) wp_remote_retrieve_header($response, 'content-type')));
        if (strpos($content_type, 'image/') !== 0) {
            return $fail();
        }

        $content_length = wp_remote_retrieve_header($response, 'content-length');
        if ($content_length !== '' && is_numeric($content_length) && intval($content_length) > self::MAX_SOURCE_IMAGE_BYTES) {
            return $fail();
        }

        clearstatcache(true, $temp_path);
        $size = file_exists($temp_path) ? (int) filesize($temp_path) : 0;
        if ($size <= 0 || $size > self::MAX_SOURCE_IMAGE_BYTES) {
            return $fail();
        }

        // Trust the bytes, not the header: the file must really be an image.
        $mime_type = '';
        if (function_exists('wp_get_image_mime')) {
            $mime_type = (string) wp_get_image_mime($temp_path);
        }
        if ($mime_type === '') {
            $image_info = @getimagesize($temp_path); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
            $mime_type = is_array($image_info) && !empty($image_info['mime']) ? (string) $image_info['mime'] : '';
        }
        if (strpos($mime_type, 'image/') !== 0) {
            // PHP always recognises JPEG, PNG, GIF and WebP, so bytes it
            // cannot read are not one of those. Other formats (HEIC, AVIF on
            // older PHP) go through the image editor, which rejects files it
            // cannot decode.
            $mime_type = trim((string) strtok($content_type, ';'));
            if (in_array($mime_type, self::DIRECT_UPLOAD_MIME_TYPES, true) || strpos($mime_type, 'image/') !== 0) {
                return $fail();
            }
        }

        // Give the file the right extension so image editors recognise it.
        $extensions = array(
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/gif' => 'gif',
            'image/webp' => 'webp',
            'image/avif' => 'avif',
            'image/heic' => 'heic',
            'image/bmp' => 'bmp',
            'image/tiff' => 'tif',
        );
        if (isset($extensions[$mime_type])) {
            $named_path = $temp_path . '.' . $extensions[$mime_type];
            if (@rename($temp_path, $named_path)) { // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged, WordPress.WP.AlternativeFunctions.rename_rename
                $temp_path = $named_path;
            }
        }

        return array(
            'path' => $temp_path,
            'mime_type' => $mime_type,
        );
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
    private function make_request($endpoint, $method = 'GET', $data = array(), $timeout = 60, $blocking = true)
    {
        // Ensure proper URL construction (remove trailing slash from base, ensure single slash)
        $api_base = rtrim($this->api_base, '/');
        $endpoint = ltrim($endpoint, '/');
        $url = $api_base . '/' . $endpoint;

        // The site URL, plugin version and locale let the account list its
        // connected sites; they are listed under "External services".
        $headers = array(
            'Content-Type' => 'application/json',
            'Authorization' => 'Bearer ' . $this->api_key,
            'X-Alt-Text-Pro-Version' => ALT_TEXT_PRO_VERSION,
            'X-Plugin-Version' => ALT_TEXT_PRO_VERSION,
        );
        $site_url = self::get_site_url();
        if ($site_url !== '') {
            $headers['X-Site-URL'] = $site_url;
        }
        if (function_exists('get_locale')) {
            $headers['X-WP-Locale'] = (string) get_locale();
        }

        $args = array(
            'method' => $method,
            'headers' => $headers,
            'timeout' => max(5, intval($timeout)),
            'sslverify' => true
        );

        // Fire and forget: only connecting and sending may take time.
        if (!$blocking) {
            $args['blocking'] = false;
            $args['timeout'] = 2;
        }

        if ($method === 'POST' && !empty($data)) {
            $args['body'] = json_encode($data);
        }

        $response = wp_remote_request($url, $args);

        // A non-blocking request has no answer to read.
        if (!$blocking) {
            return array('success' => !is_wp_error($response));
        }

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

            $response_code = is_array($decoded_body) && isset($decoded_body['code']) ? sanitize_key($decoded_body['code']) : null;
            $retry_after_seconds = $this->get_retry_after_seconds($response, $decoded_body);

            // Handle specific error codes with more specific messages
            switch ($status_code) {
                case 401:
                    // The key itself is wrong: nothing else will work, so bulk
                    // runs stop instead of failing every remaining image.
                    return array(
                        'success' => false,
                        'message' => esc_html__('Invalid API key. Please check your settings and ensure your API key is correct.', 'alt-text-pro'),
                        'status_code' => 401,
                        'code' => 'invalid_api_key',
                        'retryable' => false,
                        'stop_bulk' => true
                    );
                case 402:
                    $error_message = esc_html__('No credits remaining. Buy a credit pack or upgrade your plan at alt-text.pro.', 'alt-text-pro');
                    // Mark as no credits error for bulk processing to stop
                    return array(
                        'success' => false,
                        'message' => $error_message,
                        'no_credits' => true, // Special flag to indicate credits exhausted
                        'code' => 'no_credits',
                        'status_code' => 402
                    );
                case 403:
                    if ($response_code === 'account_suspended' || (is_array($decoded_body) && ($decoded_body['error'] ?? '') === 'account_suspended')) {
                        return array(
                            'success' => false,
                            'message' => esc_html__('Your Alt Text Pro account is suspended, so alt text cannot be generated. Contact help@alt-text.pro if you think this is a mistake.', 'alt-text-pro'),
                            'status_code' => 403,
                            'code' => 'account_suspended',
                            'retryable' => false,
                            'stop_bulk' => true
                        );
                    }
                    return array(
                        'success' => false,
                        'message' => esc_html__('Access forbidden. Please check your API key permissions.', 'alt-text-pro'),
                        'status_code' => 403,
                        'code' => $response_code ?: 'forbidden',
                        'retryable' => false,
                        'stop_bulk' => true
                    );
                case 404:
                    // The service answers 404 when the account behind this key
                    // no longer exists; that needs a reconnect, not an update.
                    if (is_string($error_message) && stripos($error_message, 'profile not found') !== false) {
                        return array(
                            'success' => false,
                            'message' => esc_html__('Your Alt Text Pro account could not be found. Reconnect your account in Alt Text Pro > Settings.', 'alt-text-pro'),
                            'status_code' => 404,
                            'code' => 'account_not_found',
                            'reconnect' => true,
                            'retryable' => false,
                            'stop_bulk' => true
                        );
                    }
                    $error_message = esc_html__('The requested Alt Text Pro service is unavailable. Please update the plugin or try again later.', 'alt-text-pro');
                    break;
                case 413:
                    $error_message = esc_html__('Image too large to process.', 'alt-text-pro');
                    break;
                case 429:
                    $error_message = is_array($decoded_body) && !empty($decoded_body['message'])
                        ? sanitize_text_field($decoded_body['message'])
                        : esc_html__('AI generation is temporarily rate limited. The plugin will wait and retry automatically.', 'alt-text-pro');

                    return array(
                        'success' => false,
                        'message' => $error_message,
                        'retryable' => true,
                        'retry_after_seconds' => $retry_after_seconds ?: 15,
                        'code' => $response_code ?: 'rate_limited',
                        'status_code' => 429
                    );
                case 500:
                    // One image the AI could not describe: record it and move on.
                    if ($response_code === 'generation_failed') {
                        return array(
                            'success' => false,
                            'message' => esc_html__('Alt Text Pro could not describe this image. Try again, or write this one by hand.', 'alt-text-pro'),
                            'status_code' => 500,
                            'code' => 'generation_failed',
                            'retryable' => false
                        );
                    }

                    // Any other server error: retry a few times; bulk runs stop
                    // if it keeps failing.
                    return array(
                        'success' => false,
                        'message' => esc_html__('The Alt Text Pro service encountered an error. Please try again later.', 'alt-text-pro'),
                        'status_code' => 500,
                        'code' => $response_code ?: 'server_error',
                        'retryable' => true,
                        'retry_after_seconds' => $retry_after_seconds ?: 15,
                        'server_error' => true
                    );
                case 503:
                    // Temporary: the key could not be checked, credit status is
                    // unavailable, or the rate limiter is down. Bulk runs wait
                    // and retry, like a 429, and keep the API key.
                    $error_message = $response_code === 'auth_unavailable'
                        ? esc_html__('Alt Text Pro could not check your API key right now. Your key is kept; please try again in a moment.', 'alt-text-pro')
                        : esc_html__('The Alt Text Pro service is temporarily busy. Please try again in a moment; bulk runs retry automatically.', 'alt-text-pro');

                    return array(
                        'success' => false,
                        'message' => $error_message,
                        'retryable' => true,
                        'retry_after_seconds' => $retry_after_seconds ?: 30,
                        'code' => $response_code ?: 'service_unavailable',
                        'status_code' => 503,
                        'server_error' => true
                    );
            }

            if ($status_code >= 500) {
                // 502/504: a gateway or timeout in front of the service.
                return array(
                    'success' => false,
                    'message' => esc_html__('The Alt Text Pro service encountered an error. Please try again later.', 'alt-text-pro'),
                    'status_code' => $status_code,
                    'code' => $response_code ?: 'server_error',
                    'retryable' => true,
                    'retry_after_seconds' => $retry_after_seconds ?: 15,
                    'server_error' => true
                );
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
     * Seconds to wait before retrying, from the body (retry_after_seconds or
     * retryAfter) or the Retry-After header (seconds or an HTTP date).
     *
     * @return int|null
     */
    private function get_retry_after_seconds($response, $decoded_body)
    {
        $seconds = null;

        if (is_array($decoded_body)) {
            if (isset($decoded_body['retry_after_seconds']) && is_numeric($decoded_body['retry_after_seconds'])) {
                $seconds = (int) ceil((float) $decoded_body['retry_after_seconds']);
            } elseif (isset($decoded_body['retryAfter']) && is_numeric($decoded_body['retryAfter'])) {
                $seconds = (int) ceil((float) $decoded_body['retryAfter']);
            }
        }

        if (!$seconds) {
            $header = trim((string) wp_remote_retrieve_header($response, 'retry-after'));
            if ($header !== '' && is_numeric($header)) {
                $seconds = (int) ceil((float) $header);
            } elseif ($header !== '') {
                $timestamp = strtotime($header);
                if ($timestamp) {
                    $seconds = $timestamp - time();
                }
            }
        }

        if (!$seconds || $seconds < 1) {
            return null;
        }

        return min(self::MAX_RETRY_AFTER_SECONDS, $seconds);
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
