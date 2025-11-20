<?php
/**
 * Media Handler for Alt-Text AI
 * 
 * Handles automatic alt-text generation on media upload
 */

if (!defined('ABSPATH')) {
    exit;
}

class AltTextAI_Media_Handler {
    
    /**
     * Constructor
     */
    public function __construct() {
        add_action('add_attachment', array($this, 'handle_new_attachment'));
        add_filter('wp_handle_upload_prefilter', array($this, 'prefilter_upload'));
        add_action('wp_ajax_alt_text_ai_regenerate', array($this, 'ajax_regenerate_alt_text'));
    }
    
    /**
     * Handle new attachment upload
     */
    public function handle_new_attachment($attachment_id) {
        // Check if it's an image
        $mime_type = get_post_mime_type($attachment_id);
        if (!str_starts_with($mime_type, 'image/')) {
            return;
        }
        
        $settings = get_option('alt_text_ai_settings', array());
        
        // Only auto-generate if enabled and API key is configured
        if (empty($settings['auto_generate']) || empty($settings['api_key'])) {
            return;
        }
        
        // Check if alt-text already exists and we shouldn't overwrite
        $existing_alt = get_post_meta($attachment_id, '_wp_attachment_image_alt', true);
        if (!empty($existing_alt) && empty($settings['overwrite_existing'])) {
            return;
        }
        
        // Generate alt-text immediately (don't rely on cron)
        // Use wp_schedule_single_event as fallback, but also try immediate generation
        $this->generate_alt_text_background($attachment_id);
        
        // Also schedule as backup in case immediate fails
        if (!wp_next_scheduled('alt_text_ai_generate_background', array($attachment_id))) {
            wp_schedule_single_event(time() + 5, 'alt_text_ai_generate_background', array($attachment_id));
            add_action('alt_text_ai_generate_background', array($this, 'generate_alt_text_background'));
        }
    }
    
    /**
     * Generate alt-text in background
     */
    public function generate_alt_text_background($attachment_id) {
        $api_client = new AltTextAI_API_Client();
        
        // Get context from attachment metadata if available
        $context = get_post_meta($attachment_id, '_alt_text_ai_context', true);
        
        $result = $api_client->generate_alt_text($attachment_id, $context);
        
        if ($result['success'] && !empty($result['alt_text'])) {
            // Update attachment alt text
            update_post_meta($attachment_id, '_wp_attachment_image_alt', $result['alt_text']);
            
            // Log the generation (only if alt_text exists)
            if (!empty($result['alt_text'])) {
                $this->log_generation($attachment_id, $result['alt_text'], $result['credits_used'] ?? 1);
            }
            
            // Add admin notice for successful generation
            set_transient('alt_text_ai_success_' . get_current_user_id(), array(
                'message' => sprintf(
                    // translators: %1$s: Image title, %2$s: Generated alt-text
                    esc_html__('Alt-text generated for "%1$s": %2$s', 'alt-text-ai'),
                    esc_html(get_the_title($attachment_id)),
                    esc_html($result['alt_text'])
                ),
                'credits_remaining' => $result['credits_remaining'] ?? 0
            ), 300);
        } else {
            // Log the error with more details
            $error_msg = $result['message'] ?? 'Unknown error';
            
            // Add admin notice for error
            set_transient('alt_text_ai_error_' . get_current_user_id(), array(
                'message' => sprintf(
                    // translators: %1$s: Image title, %2$s: Error message
                    esc_html__('Failed to generate alt-text for "%1$s": %2$s', 'alt-text-ai'),
                    esc_html(get_the_title($attachment_id)),
                    esc_html($error_msg)
                )
            ), 300);
        }
    }
    
    /**
     * Prefilter upload to add context
     */
    public function prefilter_upload($file) {
        // This could be used to extract context from filename or other metadata
        return $file;
    }
    
    /**
     * AJAX handler for regenerating alt-text
     */
    public function ajax_regenerate_alt_text() {
        check_ajax_referer('alt_text_ai_nonce', 'nonce');
        
        if (!current_user_can('upload_files')) {
            wp_die(esc_html__('You do not have permission to perform this action.', 'alt-text-ai'));
        }
        
        $attachment_id = isset($_POST['attachment_id']) ? intval($_POST['attachment_id']) : 0;
        $context = isset($_POST['context']) ? sanitize_text_field(wp_unslash($_POST['context'])) : '';
        $force_overwrite = (bool) $_POST['force_overwrite'] ?? false;
        
        if (!$attachment_id) {
            wp_send_json_error(esc_html__('Invalid attachment ID.', 'alt-text-ai'));
        }
        
        // Check if it's an image
        $mime_type = get_post_mime_type($attachment_id);
        if (!str_starts_with($mime_type, 'image/')) {
            wp_send_json_error(esc_html__('File is not an image.', 'alt-text-ai'));
        }
        
        // Check if alt-text exists and we shouldn't overwrite
        if (!$force_overwrite) {
            $existing_alt = get_post_meta($attachment_id, '_wp_attachment_image_alt', true);
            if (!empty($existing_alt)) {
                wp_send_json_error(esc_html__('Alt-text already exists. Use force overwrite to replace it.', 'alt-text-ai'));
            }
        }
        
        $api_client = new AltTextAI_API_Client();
        $result = $api_client->generate_alt_text($attachment_id, $context);
        
        if ($result['success']) {
            // Update attachment alt text
            update_post_meta($attachment_id, '_wp_attachment_image_alt', $result['alt_text']);
            
            // Save context if provided
            if (!empty($context)) {
                update_post_meta($attachment_id, '_alt_text_ai_context', $context);
            }
            
            // Log the generation
            $this->log_generation($attachment_id, $result['alt_text'], $result['credits_used']);
            
            wp_send_json_success(array(
                'alt_text' => $result['alt_text'],
                'credits_remaining' => $result['credits_remaining'],
                'credits_used' => $result['credits_used'],
                'attachment_id' => $attachment_id
            ));
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
     */
    public function get_context_suggestions($attachment_id) {
        $suggestions = array();
        
        // Get post title and content where image is used
        $posts_using_image = $this->get_posts_using_image($attachment_id);
        
        foreach ($posts_using_image as $post) {
            if (!empty($post->post_title)) {
                $suggestions[] = sprintf(
                    // translators: %s: Post title
                    esc_html__('Used in: %1$s', 'alt-text-ai'),
                    esc_html($post->post_title)
                );
            }
        }
        
        // Get image filename as context
        $filename = basename(get_attached_file($attachment_id));
        $filename_without_ext = pathinfo($filename, PATHINFO_FILENAME);
        $suggestions[] = sprintf(
            // translators: %s: Filename without extension
            esc_html__('Filename: %1$s', 'alt-text-ai'),
            esc_html($filename_without_ext)
        );
        
        return array_unique($suggestions);
    }
    
    /**
     * Get posts that use this image
     */
    private function get_posts_using_image($attachment_id) {
        global $wpdb;
        
        // Find posts that reference this image in content
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $posts = $wpdb->get_results($wpdb->prepare(
            "SELECT ID, post_title, post_type 
             FROM {$wpdb->posts} 
             WHERE post_content LIKE %s 
             AND post_status = 'publish'
             LIMIT 5",
            '%wp-image-' . $attachment_id . '%'
        ));
        
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
        
        return array_merge($posts, $featured_posts);
    }
    
    /**
     * Check if image needs alt-text
     */
    public function needs_alt_text($attachment_id) {
        // Check if it's an image
        $mime_type = get_post_mime_type($attachment_id);
        if (!str_starts_with($mime_type, 'image/')) {
            return false;
        }
        
        // Check if alt-text already exists
        $alt_text = get_post_meta($attachment_id, '_wp_attachment_image_alt', true);
        return empty($alt_text);
    }
    
    /**
     * Get image dimensions and file size
     */
    public function get_image_info($attachment_id) {
        $metadata = wp_get_attachment_metadata($attachment_id);
        $file_path = get_attached_file($attachment_id);
        
        return array(
            'width' => $metadata['width'] ?? 0,
            'height' => $metadata['height'] ?? 0,
            'file_size' => file_exists($file_path) ? filesize($file_path) : 0,
            'mime_type' => get_post_mime_type($attachment_id)
        );
    }
}
