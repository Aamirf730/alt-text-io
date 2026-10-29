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

    // Set when an upload queues automatic generation, holding the alt text
    // the image had then. The scheduled job claims (deletes) it before
    // calling the service, and bulk or manual generation claims it before
    // describing the image, so an image is billed at most once.
    public const PENDING_META = '_alt_text_pro_auto_pending';

    // Short-lived marker while the scheduled job waits for the service, so a
    // bulk run reaching the same image skips it instead of paying twice.
    private const RUNNING_TRANSIENT_PREFIX = 'alt_text_pro_auto_running_';

    // Whether this request already asked WP-Cron to start.
    private static $cron_spawn_queued = false;

    /**
     * Constructor
     */
    public function __construct()
    {
        add_action('add_attachment', array($this, 'handle_new_attachment'));
        add_filter('wp_handle_upload_prefilter', array($this, 'prefilter_upload'));
        add_action('wp_ajax_alt_text_pro_regenerate', array($this, 'ajax_regenerate_alt_text'));
        add_action('wp_ajax_alt_text_pro_get_context_suggestions', array($this, 'ajax_get_context_suggestions'));
        add_action('alt_text_pro_generate_background', array($this, 'run_scheduled_generation'), 10, 3);
    }

    /**
     * Handle new attachment upload
     *
     * Generation is deferred to a single WP-Cron event so the upload (and
     * imports, WooCommerce CSV, media_sideload_image) never waits for the AI.
     */
    public function handle_new_attachment($attachment_id)
    {
        // Only raster images the service can describe (no SVG).
        if (!class_exists('AltTextPro_API_Client') || !AltTextPro_API_Client::is_supported_image($attachment_id)) {
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

        $attachment_id = absint($attachment_id);
        $force_overwrite = !empty($settings['overwrite_existing']);
        $user_id = get_current_user_id();

        // Remember the alt text seen now: if it has changed when the job runs,
        // a person or a bulk run wrote it meanwhile and the job must not
        // replace it.
        update_post_meta($attachment_id, self::PENDING_META, array('alt' => (string) $existing_alt));

        $args = array($attachment_id, $force_overwrite, $user_id);
        if (!wp_next_scheduled('alt_text_pro_generate_background', $args)) {
            wp_schedule_single_event(time(), 'alt_text_pro_generate_background', $args);
        }

        // Start WP-Cron right after this request instead of waiting for the
        // next visitor. spawn_cron() sends a non-blocking request.
        if (!self::$cron_spawn_queued && !wp_doing_cron() && !(defined('DISABLE_WP_CRON') && DISABLE_WP_CRON)) {
            self::$cron_spawn_queued = true;
            add_action('shutdown', array(__CLASS__, 'spawn_cron_after_request'));
        }
    }

    /**
     * Ask WP-Cron to run the queued generation now.
     */
    public static function spawn_cron_after_request()
    {
        if (function_exists('spawn_cron')) {
            spawn_cron();
        }
    }

    /**
     * Claim an upload's queued automatic generation so it never runs. Bulk
     * and manual generation call this before describing the image, so the
     * image is billed once. Returns true when a queued job was cancelled.
     *
     * @param int $attachment_id Image about to be described.
     */
    public static function claim_pending_upload($attachment_id)
    {
        $attachment_id = absint($attachment_id);
        return $attachment_id ? (bool) delete_post_meta($attachment_id, self::PENDING_META) : false;
    }

    /**
     * True while an upload's automatic generation is waiting for the service.
     *
     * @param int $attachment_id Image to check.
     */
    public static function is_upload_generation_running($attachment_id)
    {
        $attachment_id = absint($attachment_id);
        return $attachment_id && get_transient(self::RUNNING_TRANSIENT_PREFIX . $attachment_id) !== false;
    }

    /**
     * WP-Cron callback for a queued upload. Generates only while the upload
     * is still pending, so a repeated event never bills a second time, and
     * only while nobody has written alt text since the upload.
     *
     * @param int  $attachment_id   Uploaded image.
     * @param bool $force_overwrite Overwrite setting at upload time.
     * @param int  $user_id         Uploading user, told about failures.
     */
    public function run_scheduled_generation($attachment_id, $force_overwrite = false, $user_id = 0)
    {
        $attachment_id = absint($attachment_id);
        if (!$attachment_id) {
            return;
        }

        $pending = get_post_meta($attachment_id, self::PENDING_META, true);
        if (!self::claim_pending_upload($attachment_id)) {
            // Already done, or a bulk run or a person generated it meanwhile.
            return;
        }

        // A person, a bulk run or an import wrote alt text after the upload:
        // keep it.
        $current_alt = (string) get_post_meta($attachment_id, '_wp_attachment_image_alt', true);
        if (is_array($pending) && array_key_exists('alt', $pending) && $current_alt !== (string) $pending['alt']) {
            return;
        }

        // Follow the settings as they are now, not as they were at upload.
        $settings = get_option('alt_text_pro_settings', array());
        if (!is_array($settings) || empty($settings['auto_generate'])) {
            return;
        }
        $force_overwrite = (bool) $force_overwrite && !empty($settings['overwrite_existing']);
        if (!$force_overwrite && trim($current_alt) !== '') {
            return;
        }

        $running_key = self::RUNNING_TRANSIENT_PREFIX . $attachment_id;
        set_transient($running_key, 1, 3 * MINUTE_IN_SECONDS);
        try {
            $this->generate_alt_text_background($attachment_id, $force_overwrite, absint($user_id));
        } finally {
            delete_transient($running_key);
        }
    }

    /**
     * Generate alt-text in background
     *
     * @param int  $attachment_id   Image to describe.
     * @param bool $force_overwrite Replace existing alt text.
     * @param int  $user_id         User to tell about a failure (0: current user).
     */
    public function generate_alt_text_background($attachment_id, $force_overwrite = false, $user_id = 0)
    {
        if (!AltTextPro_API_Client::is_supported_image($attachment_id)) {
            return;
        }

        // Marked as decorative after the upload: keep its alt empty, quietly.
        if (AltTextPro_Image_Details::is_decorative($attachment_id)) {
            return;
        }

        $user_id = $user_id ? absint($user_id) : get_current_user_id();

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
        } else {
            // Shown once as an admin notice to the user who uploaded the image.
            AltTextPro_Admin::record_auto_generate_error(
                $user_id,
                wp_strip_all_tags(html_entity_decode((string) ($result['message'] ?? __('Unknown error', 'alt-text-pro')), ENT_QUOTES | ENT_HTML5, 'UTF-8')),
                wp_strip_all_tags(html_entity_decode((string) get_the_title($attachment_id), ENT_QUOTES | ENT_HTML5, 'UTF-8')),
                !empty($result['no_credits']) ? 'no_credits' : sanitize_key((string) ($result['code'] ?? ''))
            );
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
            AltTextPro::send_permission_error();
        }

        $attachment_id = isset($_POST['attachment_id']) ? intval($_POST['attachment_id']) : 0;
        $context = isset($_POST['context']) ? sanitize_text_field(wp_unslash($_POST['context'])) : '';
        $force_overwrite = !empty($_POST['force_overwrite']);

        if (!$attachment_id) {
            wp_send_json_error(esc_html__('Invalid attachment ID.', 'alt-text-pro'));
        }

        if (!current_user_can('edit_post', $attachment_id)) {
            AltTextPro::send_permission_error(__('You do not have permission to edit this image.', 'alt-text-pro'));
        }

        // Only raster images the service can describe (no SVG).
        if (!AltTextPro_API_Client::is_supported_image($attachment_id)) {
            wp_send_json_error(esc_html__('This file type is not supported. Alt Text Pro can describe JPEG, PNG, GIF, WebP, AVIF and HEIC images.', 'alt-text-pro'));
        }

        if (AltTextPro_Image_Details::is_decorative($attachment_id)) {
            wp_send_json_error(esc_html(AltTextPro_Image_Details::get_decorative_message()));
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

        // Generating here replaces a queued upload job for this image.
        self::claim_pending_upload($attachment_id);

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
            AltTextPro::send_permission_error();
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
        // Only raster images the service can describe (no SVG).
        if (!AltTextPro_API_Client::is_supported_image($attachment_id)) {
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
