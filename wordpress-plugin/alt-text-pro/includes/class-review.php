<?php
/**
 * "Review alt text before it goes live"
 *
 * With the setting on, bulk runs, automatic generation on upload and the
 * Posts list "Add Alt Text" button store the generated alt text as a
 * suggestion (attachment meta) instead of writing it to the image. The
 * Review page lists the suggestions so they can be approved (as written or
 * edited) or rejected. Generating one image from the media editor is not
 * affected: that is already a reviewed draft.
 */

if (!defined('ABSPATH')) {
    exit;
}

class AltTextPro_Review
{
    // Attachment meta holding a suggestion: alt, source, run_ref, log_id,
    // created_at. While it exists the image is never generated again.
    public const META = '_alt_text_pro_suggested_alt';

    public const PAGE_SLUG = 'alt-text-pro-review';

    private const PER_PAGE = 20;

    // Suggestions one "Approve all" request handles.
    private const APPROVE_ALL_CHUNK = 100;

    /**
     * Constructor
     */
    public function __construct()
    {
        add_action('admin_menu', array($this, 'add_menu'), 20);
        add_action('wp_ajax_alt_text_pro_review_approve', array($this, 'ajax_approve'));
        add_action('wp_ajax_alt_text_pro_review_reject', array($this, 'ajax_reject'));
        add_action('wp_ajax_alt_text_pro_review_approve_all', array($this, 'ajax_approve_all'));
    }

    /**
     * Whether generated alt text waits for approval.
     */
    public static function is_enabled()
    {
        return class_exists('AltTextPro_Settings') && AltTextPro_Settings::is_enabled('review_before_live');
    }

    /**
     * Suggestion waiting for review, or null.
     *
     * @return array|null
     */
    public static function get_suggestion($attachment_id)
    {
        $suggestion = get_post_meta(absint($attachment_id), self::META, true);

        return is_array($suggestion) && isset($suggestion['alt']) ? $suggestion : null;
    }

    /**
     * True while the image has a suggestion waiting for review.
     */
    public static function has_suggestion($attachment_id)
    {
        return metadata_exists('post', absint($attachment_id), self::META);
    }

    /**
     * Keep generated alt text as a suggestion and log it.
     *
     * @param int    $attachment_id Image.
     * @param string $alt_text      Generated alt text (sanitized).
     * @param string $source        bulk, upload or post.
     * @param string $run_ref       Bulk run reference, if any.
     * @param int    $credits_used  Credits the generation used.
     */
    public static function store_suggestion($attachment_id, $alt_text, $source, $run_ref = '', $credits_used = 1)
    {
        $attachment_id = absint($attachment_id);
        $log_id = AltTextPro_Bulk_Processor::write_log($attachment_id, $alt_text, $credits_used, array(
            'outcome' => 'suggested',
            'run_ref' => (string) $run_ref,
        ));

        update_post_meta($attachment_id, self::META, array(
            'alt' => (string) $alt_text,
            'source' => sanitize_key((string) $source),
            'run_ref' => (string) $run_ref,
            'log_id' => (int) $log_id,
            'created_at' => current_time('mysql'),
        ));
    }

    /**
     * Number of suggestions the current user may review.
     */
    public static function count_pending()
    {
        global $wpdb;

        $editable_clause = AltTextPro_Bulk_Processor::get_editable_media_sql_clause('p');
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- the editable clause is prepared
        return (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(DISTINCT p.ID) FROM {$wpdb->posts} p
             INNER JOIN {$wpdb->postmeta} sug ON (sug.post_id = p.ID AND sug.meta_key = %s)
             WHERE p.post_type = 'attachment' {$editable_clause}",
            self::META
        ));
    }

    /**
     * Suggestions (the current user may review) whose image already has alt
     * text that approving would replace.
     */
    private static function count_pending_replacing()
    {
        global $wpdb;

        $editable_clause = AltTextPro_Bulk_Processor::get_editable_media_sql_clause('p');
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- the editable clause is prepared
        return (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(DISTINCT p.ID) FROM {$wpdb->posts} p
             INNER JOIN {$wpdb->postmeta} sug ON (sug.post_id = p.ID AND sug.meta_key = %s)
             INNER JOIN {$wpdb->postmeta} alt ON (alt.post_id = p.ID AND alt.meta_key = '_wp_attachment_image_alt' AND TRIM(alt.meta_value) != '')
             WHERE p.post_type = 'attachment' {$editable_clause}",
            self::META
        ));
    }

    /**
     * IDs of suggestions the current user may review, newest first.
     *
     * @return int[]
     */
    private static function get_pending_ids($limit, $offset = 0)
    {
        global $wpdb;

        $editable_clause = AltTextPro_Bulk_Processor::get_editable_media_sql_clause('p');
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- the editable clause is prepared
        $ids = $wpdb->get_col($wpdb->prepare(
            "SELECT p.ID FROM {$wpdb->posts} p
             INNER JOIN {$wpdb->postmeta} sug ON (sug.post_id = p.ID AND sug.meta_key = %s)
             WHERE p.post_type = 'attachment' {$editable_clause}
             GROUP BY p.ID
             ORDER BY p.ID DESC
             LIMIT %d OFFSET %d",
            self::META,
            max(1, intval($limit)),
            max(0, intval($offset))
        ));

        return array_map('intval', (array) $ids);
    }

    /**
     * Review submenu, after the plugin's other pages.
     */
    public function add_menu()
    {
        $pending = current_user_can('upload_files') ? self::count_pending() : 0;
        $menu_title = __('Review', 'alt-text-pro');
        if ($pending > 0) {
            $menu_title .= ' <span class="awaiting-mod"><span class="pending-count">' . esc_html(number_format_i18n($pending)) . '</span></span>';
        }

        add_submenu_page(
            'alt-text-pro',
            __('Review alt text', 'alt-text-pro'),
            $menu_title,
            'upload_files',
            self::PAGE_SLUG,
            array($this, 'render_page')
        );
    }

    /**
     * Review page: suggestions with thumbnail, current and suggested alt.
     */
    public function render_page()
    {
        if (!current_user_can('upload_files')) {
            wp_die(esc_html__('You do not have permission to perform this action.', 'alt-text-pro'), '', array('response' => 403));
        }

        // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only paging
        $current_page = max(1, isset($_GET['paged']) ? absint($_GET['paged']) : 1);
        $total = self::count_pending();
        $total_pages = max(1, (int) ceil($total / self::PER_PAGE));
        $current_page = min($current_page, $total_pages);
        $ids = self::get_pending_ids(self::PER_PAGE, ($current_page - 1) * self::PER_PAGE);

        if (!empty($ids)) {
            _prime_post_caches($ids, false, true);
        }

        $items = array();
        foreach ($ids as $attachment_id) {
            $suggestion = self::get_suggestion($attachment_id);
            if (!$suggestion || !current_user_can('edit_post', $attachment_id)) {
                continue;
            }
            $items[] = array(
                'id' => $attachment_id,
                'title' => get_the_title($attachment_id),
                'thumb' => (string) wp_get_attachment_image_url($attachment_id, 'thumbnail'),
                'current_alt' => (string) get_post_meta($attachment_id, '_wp_attachment_image_alt', true),
                'suggested_alt' => (string) $suggestion['alt'],
                'source' => (string) ($suggestion['source'] ?? ''),
                'created_at' => (string) ($suggestion['created_at'] ?? ''),
            );
        }

        $review_enabled = self::is_enabled();
        $replacing_total = $total > 0 ? self::count_pending_replacing() : 0;
        include ALT_TEXT_PRO_PLUGIN_PATH . 'templates/review.php';
    }

    /**
     * Approve one suggestion, optionally edited.
     */
    public function ajax_approve()
    {
        check_ajax_referer('alt_text_pro_nonce', 'nonce');

        if (!current_user_can('upload_files')) {
            AltTextPro::send_permission_error();
        }

        $attachment_id = isset($_POST['attachment_id']) ? absint($_POST['attachment_id']) : 0;
        $alt_text = isset($_POST['alt_text']) ? sanitize_text_field(wp_unslash($_POST['alt_text'])) : null;

        if (!$attachment_id || !current_user_can('edit_post', $attachment_id)) {
            AltTextPro::send_permission_error(__('You do not have permission to edit this image.', 'alt-text-pro'));
        }

        if ($alt_text !== null && trim($alt_text) === '') {
            wp_send_json_error(esc_html__('Alt text cannot be empty. Reject the suggestion instead.', 'alt-text-pro'));
        }

        if (!$this->approve($attachment_id, $alt_text)) {
            wp_send_json_error(esc_html__('This suggestion was already handled.', 'alt-text-pro'));
        }

        wp_send_json_success(array(
            'attachment_id' => $attachment_id,
            'remaining' => self::count_pending(),
        ));
    }

    /**
     * Reject one suggestion: the image keeps its current alt text.
     */
    public function ajax_reject()
    {
        check_ajax_referer('alt_text_pro_nonce', 'nonce');

        if (!current_user_can('upload_files')) {
            AltTextPro::send_permission_error();
        }

        $attachment_id = isset($_POST['attachment_id']) ? absint($_POST['attachment_id']) : 0;
        if (!$attachment_id || !current_user_can('edit_post', $attachment_id)) {
            AltTextPro::send_permission_error(__('You do not have permission to edit this image.', 'alt-text-pro'));
        }

        $suggestion = self::get_suggestion($attachment_id);
        if (!$suggestion) {
            wp_send_json_error(esc_html__('This suggestion was already handled.', 'alt-text-pro'));
        }

        delete_post_meta($attachment_id, self::META);
        AltTextPro_Bulk_Processor::update_log_outcome(intval($suggestion['log_id'] ?? 0), 'rejected', __('Rejected on the Review page.', 'alt-text-pro'));

        wp_send_json_success(array(
            'attachment_id' => $attachment_id,
            'remaining' => self::count_pending(),
        ));
    }

    /**
     * Approve the next chunk of suggestions as written. The browser repeats
     * the request until none are left.
     */
    public function ajax_approve_all()
    {
        check_ajax_referer('alt_text_pro_nonce', 'nonce');

        if (!current_user_can('upload_files')) {
            AltTextPro::send_permission_error();
        }

        $approved = 0;
        foreach (self::get_pending_ids(self::APPROVE_ALL_CHUNK) as $attachment_id) {
            if (current_user_can('edit_post', $attachment_id) && $this->approve($attachment_id, null)) {
                $approved++;
            }
        }

        wp_send_json_success(array(
            'approved' => $approved,
            'remaining' => self::count_pending(),
        ));
    }

    /**
     * Write a suggestion to the image's alt text. The log row becomes a
     * normal generation that remembers the replaced alt text, so undoing
     * its bulk run restores it.
     *
     * @param int         $attachment_id Image.
     * @param string|null $alt_text      Edited text, or null for the suggestion.
     * @return bool False when there is no suggestion.
     */
    private function approve($attachment_id, $alt_text)
    {
        $suggestion = self::get_suggestion($attachment_id);
        if (!$suggestion) {
            return false;
        }

        $final_alt = $alt_text !== null ? $alt_text : sanitize_text_field((string) $suggestion['alt']);
        if (trim($final_alt) === '') {
            return false;
        }

        $previous_alt = (string) get_post_meta($attachment_id, '_wp_attachment_image_alt', true);
        update_post_meta($attachment_id, '_wp_attachment_image_alt', wp_slash($final_alt));
        delete_post_meta($attachment_id, self::META);

        $edited = $final_alt !== (string) $suggestion['alt'];
        AltTextPro_Bulk_Processor::update_log_outcome(
            intval($suggestion['log_id'] ?? 0),
            'generated',
            $edited ? __('Approved with edits on the Review page.', 'alt-text-pro') : __('Approved on the Review page.', 'alt-text-pro'),
            array(
                'alt_text' => $final_alt,
                'previous_alt' => $previous_alt,
            )
        );

        return true;
    }
}
