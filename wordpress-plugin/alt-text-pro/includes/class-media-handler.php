<?php
/**
 * Media Handler for Alt-Text AI
 * 
 * Handles automatic alt-text generation on media upload
 */

if (!defined('ABSPATH')) {
    exit;
}

class AltTextPro_Media_Handler
{

    /**
     * Constructor
     */
    public function __construct()
    {
        add_action('add_attachment', array($this, 'handle_new_attachment'));
        add_filter('wp_handle_upload_prefilter', array($this, 'prefilter_upload'));
        add_action('wp_ajax_alt_text_pro_regenerate', array($this, 'ajax_regenerate_alt_text'));
        add_action('wp_ajax_alt_text_pro_get_context_suggestions', array($this, 'ajax_get_context_suggestions'));
        add_action('alt_text_pro_generate_background', array($this, 'generate_alt_text_background'));
    }

    /**
     * Handle new attachment upload
     */
    public function handle_new_attachment($attachment_id)
    {
        // Check if it's an image
        $mime_type = get_post_mime_type($attachment_id);
        if (strpos((string) $mime_type, 'image/') !== 0) {
            return;
        }

        $settings = get_option('alt_text_pro_settings', array());

        // Only auto-generate if enabled and API key is configured
        if (empty($settings['auto_generate']) || empty($settings['api_key'])) {
            return;
        }

        // Check if alt-text already exists and we shouldn't overwrite
        $existing_alt = get_post_meta($attachment_id, '_wp_attachment_image_alt', true);
        if (!empty($existing_alt) && empty($settings['overwrite_existing'])) {
            return;
        }

        // Generate once during the attachment request. Scheduling a second
        // unconditional fallback can consume another credit after a success.
        $this->generate_alt_text_background($attachment_id, !empty($settings['overwrite_existing']));
    }

    /**
     * Generate alt-text in background
     */
    public function generate_alt_text_background($attachment_id, $force_overwrite = false)
    {
        if (!wp_attachment_is_image($attachment_id)) {
            return;
        }

        // Old versions scheduled a second callback after running immediately.
        // Treat any already-populated alt text as completed unless the current
        // upload request explicitly asked to overwrite it.
        $existing_alt = get_post_meta($attachment_id, '_wp_attachment_image_alt', true);
        if (!$force_overwrite && !empty($existing_alt)) {
            return;
        }

        $api_client = new AltTextPro_API_Client();

        // Get context from attachment metadata if available
        $context = get_post_meta($attachment_id, '_alt_text_pro_context', true);

        // Get blog context from settings
        $settings = get_option('alt_text_pro_settings', array());
        $blog_context = isset($settings['blog_context']) ? $settings['blog_context'] : '';
        $context_enabled = !empty($settings['context_enabled']);

        // Auto-generate context if enabled and empty
        if ($context_enabled && empty($context)) {
            $suggestions = $this->get_context_suggestions($attachment_id);
            if (!empty($suggestions)) {
                $context = implode(' | ', $suggestions);
            }
        }

        $result = $api_client->generate_alt_text($attachment_id, $context, $blog_context);
        $alt_text = sanitize_text_field((string) ($result['alt_text'] ?? ''));

        if ($result['success'] && $alt_text !== '') {
            // Update attachment alt text
            update_post_meta($attachment_id, '_wp_attachment_image_alt', $alt_text);

            // Log the generation (only if alt_text exists)
            $this->log_generation($attachment_id, $alt_text, $result['credits_used'] ?? 1);

            // Add admin notice for successful generation
            set_transient('alt_text_pro_success_' . get_current_user_id(), array(
                'message' => sprintf(
                    // translators: %1$s: Image title, %2$s: Generated alt-text
                    esc_html__('Alt-text generated for "%1$s": %2$s', 'alt-text-pro'),
                    esc_html(get_the_title($attachment_id)),
                    esc_html($alt_text)
                ),
                'credits_remaining' => $result['credits_remaining'] ?? 0
            ), 300);
        } else {
            // Log the error with more details
            $error_msg = $result['message'] ?? 'Unknown error';

            // Add admin notice for error
            set_transient('alt_text_pro_error_' . get_current_user_id(), array(
                'message' => sprintf(
                    // translators: %1$s: Image title, %2$s: Error message
                    esc_html__('Failed to generate alt-text for "%1$s": %2$s', 'alt-text-pro'),
                    esc_html(get_the_title($attachment_id)),
                    esc_html($error_msg)
                )
            ), 300);
        }
    }

    /**
     * Prefilter upload to add context
     */
    public function prefilter_upload($file)
    {
        // This could be used to extract context from filename or other metadata
        return $file;
    }

    /**
     * AJAX handler for regenerating alt-text
     */
    public function ajax_regenerate_alt_text()
    {
        check_ajax_referer('alt_text_pro_nonce', 'nonce');

        if (!current_user_can('upload_files')) {
            wp_die(esc_html__('You do not have permission to perform this action.', 'alt-text-pro'));
        }

        $attachment_id = isset($_POST['attachment_id']) ? intval($_POST['attachment_id']) : 0;
        $context = isset($_POST['context']) ? sanitize_text_field(wp_unslash($_POST['context'])) : '';
        $force_overwrite = !empty($_POST['force_overwrite']);

        if (!$attachment_id) {
            wp_send_json_error(esc_html__('Invalid attachment ID.', 'alt-text-pro'));
        }

        if (!current_user_can('edit_post', $attachment_id)) {
            wp_send_json_error(esc_html__('You do not have permission to edit this image.', 'alt-text-pro'));
        }

        // Check if it's an image
        $mime_type = get_post_mime_type($attachment_id);
        if (strpos((string) $mime_type, 'image/') !== 0) {
            wp_send_json_error(esc_html__('File is not an image.', 'alt-text-pro'));
        }

        // Check if alt-text exists and we shouldn't overwrite
        if (!$force_overwrite) {
            $existing_alt = get_post_meta($attachment_id, '_wp_attachment_image_alt', true);
            if (!empty($existing_alt)) {
                wp_send_json_error(esc_html__('Alt-text already exists. Use force overwrite to replace it.', 'alt-text-pro'));
            }
        }

        $api_client = new AltTextPro_API_Client();

        // Get blog context from settings
        $settings = get_option('alt_text_pro_settings', array());
        $blog_context = isset($settings['blog_context']) ? $settings['blog_context'] : '';

        $result = $api_client->generate_alt_text($attachment_id, $context, $blog_context);
        $alt_text = sanitize_text_field((string) ($result['alt_text'] ?? ''));

        if ($result['success'] && $alt_text !== '') {
            // Update attachment alt text
            update_post_meta($attachment_id, '_wp_attachment_image_alt', $alt_text);

            // Save context if provided
            if (!empty($context)) {
                update_post_meta($attachment_id, '_alt_text_pro_context', $context);
            }

            // Log the generation
            $this->log_generation($attachment_id, $alt_text, $result['credits_used']);

            wp_send_json_success(array(
                'alt_text' => $alt_text,
                'credits_remaining' => $result['credits_remaining'],
                'credits_used' => $result['credits_used'],
                'attachment_id' => $attachment_id
            ));
        } else {
            wp_send_json_error($result['message']);
        }
    }

    /**
     * Return context suggestions for the media-field autocomplete.
     */
    public function ajax_get_context_suggestions()
    {
        check_ajax_referer('alt_text_pro_nonce', 'nonce');

        if (!current_user_can('upload_files')) {
            wp_send_json_error(esc_html__('You do not have permission to perform this action.', 'alt-text-pro'));
        }

        $attachment_id = isset($_POST['attachment_id']) ? absint($_POST['attachment_id']) : 0;
        if (
            !$attachment_id ||
            !wp_attachment_is_image($attachment_id) ||
            !current_user_can('edit_post', $attachment_id)
        ) {
            wp_send_json_error(esc_html__('You do not have permission to read this image context.', 'alt-text-pro'));
        }

        wp_send_json_success($this->get_context_suggestions($attachment_id));
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
     * Get attachment context suggestions
     *
     * Returns plain text: the suggestions are sent to the AI service as
     * context and inserted into the media field with jQuery .text(), so they
     * must not carry HTML entities.
     */
    public function get_context_suggestions($attachment_id)
    {
        $suggestions = array();

        // Get post title and content where image is used
        $posts_using_image = $this->get_posts_using_image($attachment_id);

        foreach ($posts_using_image as $post) {
            $title = $this->to_plain_text($post->post_title ?? '');
            if ($title !== '') {
                $suggestions[] = sprintf(
                    // translators: %s: Post title
                    __('Used in: %1$s', 'alt-text-pro'),
                    $title
                );
            }
        }

        // Get image filename as context
        $filename = basename((string) get_attached_file($attachment_id));
        $filename_without_ext = $this->to_plain_text(pathinfo($filename, PATHINFO_FILENAME));
        if ($filename_without_ext !== '') {
            $suggestions[] = sprintf(
                // translators: %s: Filename without extension
                __('Filename: %1$s', 'alt-text-pro'),
                $filename_without_ext
            );
        }

        // Re-index: a JSON array, not an object with gaps, for the browser.
        return array_values(array_unique($suggestions));
    }

    /**
     * Convert stored text (which may hold tags or entities such as &amp;)
     * to plain text.
     */
    private function to_plain_text($text)
    {
        $text = wp_strip_all_tags((string) $text);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');

        return trim(preg_replace('/\s+/u', ' ', $text));
    }

    /**
     * Get posts that use this image
     */
    private function get_posts_using_image($attachment_id)
    {
        global $wpdb;

        $attachment_id = absint($attachment_id);
        if (!$attachment_id) {
            return array();
        }

        // Match the class "wp-image-{id}" exactly: "wp-image-12" must not
        // find posts that only use wp-image-120. The class is followed by a
        // quote or a space; LIKE keeps this portable across MySQL, MariaDB
        // and SQLite.
        $class = $wpdb->esc_like('wp-image-' . $attachment_id);
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $posts = $wpdb->get_results($wpdb->prepare(
            "SELECT ID, post_title, post_type, post_content
             FROM {$wpdb->posts}
             WHERE (post_content LIKE %s OR post_content LIKE %s OR post_content LIKE %s)
             AND post_status = 'publish'
             LIMIT 5",
            '%' . $class . '"%',
            '%' . $class . "'%",
            '%' . $class . ' %'
        ));

        // Belt and braces for unusual markup: keep only exact ID matches.
        $pattern = '/\bwp-image-' . $attachment_id . '(?![0-9])/';
        $posts = array_values(array_filter((array) $posts, function ($post) use ($pattern) {
            return isset($post->post_content) && preg_match($pattern, (string) $post->post_content) === 1;
        }));
        foreach ($posts as $post) {
            unset($post->post_content);
        }

        // Also check for featured images
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $featured_posts = $wpdb->get_results($wpdb->prepare(
            "SELECT p.ID, p.post_title, p.post_type 
             FROM {$wpdb->posts} p
             INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
             WHERE pm.meta_key = '_thumbnail_id' 
             AND pm.meta_value = %d
             AND p.post_status = 'publish'
             LIMIT 5",
            $attachment_id
        ));

        return array_merge($posts, (array) $featured_posts);
    }

    /**
     * Check if image needs alt-text
     */
    public function needs_alt_text($attachment_id)
    {
        // Check if it's an image
        $mime_type = get_post_mime_type($attachment_id);
        if (strpos((string) $mime_type, 'image/') !== 0) {
            return false;
        }

        // Check if alt-text already exists
        $alt_text = get_post_meta($attachment_id, '_wp_attachment_image_alt', true);
        return empty($alt_text);
    }

    /**
     * Get image dimensions and file size
     */
    public function get_image_info($attachment_id)
    {
        $metadata = wp_get_attachment_metadata($attachment_id);
        $file_path = get_attached_file($attachment_id);

        return array(
            'width' => $metadata['width'] ?? 0,
            'height' => $metadata['height'] ?? 0,
            'file_size' => ($file_path && file_exists($file_path)) ? (int) filesize($file_path) : 0,
            'mime_type' => get_post_mime_type($attachment_id)
        );
    }
}
