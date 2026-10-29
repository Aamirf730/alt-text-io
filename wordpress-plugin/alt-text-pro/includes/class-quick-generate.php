<?php
/**
 * Quick generation outside the media window
 *
 * Media Library list view: a "Generate alt text" row action that works in
 * place, and a bulk action that hands the chosen images to the Bulk page.
 * Block editor: a "Generate alt text" button for the image block.
 */

if (!defined('ABSPATH')) {
    exit;
}

class AltTextPro_Quick_Generate
{
    // Bulk action on the Media Library list view.
    public const BULK_ACTION = 'alt_text_pro_generate';

    // Per-user transient holding the images chosen in the Media Library for
    // the Bulk page, and the query argument that claims it once.
    private const SELECTION_TRANSIENT = 'alt_text_pro_media_selection_';
    private const SELECTION_QUERY_ARG = 'atp_selection';
    private const SELECTION_TTL = 30 * MINUTE_IN_SECONDS;

    // Most images one bulk action hands over (the list shows at most 999).
    private const MAX_SELECTION = 1000;

    /**
     * Constructor
     */
    public function __construct()
    {
        add_action('wp_ajax_alt_text_pro_quick_generate', array($this, 'ajax_quick_generate'));
        add_action('wp_ajax_alt_text_pro_apply_alt_text', array($this, 'ajax_apply_alt_text'));

        add_filter('media_row_actions', array($this, 'add_row_action'), 10, 2);
        add_filter('bulk_actions-upload', array($this, 'add_bulk_action'));
        add_filter('handle_bulk_actions-upload', array($this, 'handle_bulk_action'), 10, 3);

        // After the plugin's own admin assets (priority 10), which these use.
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_assets'), 20);
        add_action('enqueue_block_editor_assets', array($this, 'enqueue_block_editor_assets'));
    }

    /**
     * Generate alt text for one image from the Media Library list or the
     * image block, and save it when the image has none (or "Overwrite
     * existing" is on). Otherwise the text comes back as a draft and the
     * image keeps its alt text, like bulk runs.
     */
    public function ajax_quick_generate()
    {
        check_ajax_referer('alt_text_pro_nonce', 'nonce');

        if (!current_user_can('upload_files')) {
            AltTextPro::send_permission_error();
        }

        $attachment_id = isset($_POST['attachment_id']) ? absint($_POST['attachment_id']) : 0;
        $source = isset($_POST['source']) ? sanitize_key(wp_unslash($_POST['source'])) : 'list';
        $post_id = isset($_POST['post_id']) ? absint($_POST['post_id']) : 0;

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

        // The upload's automatic generation is describing this image right
        // now; a second request would bill it twice.
        if (AltTextPro_Media_Handler::is_upload_generation_running($attachment_id)) {
            wp_send_json_error(esc_html__('Alt Text Pro is already describing this image after its upload. Reload the page in a minute to see the result.', 'alt-text-pro'));
        }

        $settings = get_option('alt_text_pro_settings', array());
        $settings = is_array($settings) ? $settings : array();
        $existing_alt = trim((string) get_post_meta($attachment_id, '_wp_attachment_image_alt', true));
        $save_to_library = $existing_alt === '' || AltTextPro_Settings::is_enabled('overwrite_existing');

        $context = $this->get_context($attachment_id, $post_id);
        $blog_context = isset($settings['blog_context']) ? (string) $settings['blog_context'] : '';

        // Generating here replaces a queued upload job for this image, so the
        // image is billed once.
        AltTextPro_Media_Handler::claim_pending_upload($attachment_id);

        $api_client = new AltTextPro_API_Client();
        $result = $api_client->generate_alt_text($attachment_id, $context, $blog_context);
        $alt_text = sanitize_text_field((string) ($result['alt_text'] ?? ''));

        if (empty($result['success']) || $alt_text === '') {
            $this->send_generation_error($result);
        }

        if ($save_to_library) {
            update_post_meta($attachment_id, '_wp_attachment_image_alt', wp_slash($alt_text));
            $status = AltTextPro_Generation_Log::STATUS_SAVED;
        } else {
            $status = $source === 'block' ? AltTextPro_Generation_Log::STATUS_BLOCK : AltTextPro_Generation_Log::STATUS_DRAFT;
        }

        AltTextPro_Generation_Log::insert($attachment_id, $alt_text, $result['credits_used'] ?? 1, $status);

        wp_send_json_success(array(
            'attachment_id' => $attachment_id,
            'alt_text' => $alt_text,
            'saved' => $save_to_library,
            'existing_alt' => $save_to_library ? '' : $existing_alt,
            'credits_used' => intval($result['credits_used'] ?? 1),
            'credits_remaining' => isset($result['credits_remaining']) ? intval($result['credits_remaining']) : null,
        ));
    }

    /**
     * Save a draft from the Media Library list as the image's alt text
     * ("Replace alt text").
     */
    public function ajax_apply_alt_text()
    {
        check_ajax_referer('alt_text_pro_nonce', 'nonce');

        if (!current_user_can('upload_files')) {
            AltTextPro::send_permission_error();
        }

        $attachment_id = isset($_POST['attachment_id']) ? absint($_POST['attachment_id']) : 0;
        $alt_text = isset($_POST['alt_text']) ? sanitize_text_field(wp_unslash($_POST['alt_text'])) : '';

        if (!$attachment_id || $alt_text === '') {
            wp_send_json_error(esc_html__('There is no alt text to save.', 'alt-text-pro'));
        }

        if (!current_user_can('edit_post', $attachment_id)) {
            AltTextPro::send_permission_error(__('You do not have permission to edit this image.', 'alt-text-pro'));
        }

        if (!AltTextPro_API_Client::is_supported_image($attachment_id)) {
            wp_send_json_error(esc_html__('This file type is not supported. Alt Text Pro can describe JPEG, PNG, GIF, WebP, AVIF and HEIC images.', 'alt-text-pro'));
        }

        // Saving marks the matching draft in the Logs as saved.
        update_post_meta($attachment_id, '_wp_attachment_image_alt', wp_slash($alt_text));

        wp_send_json_success(array(
            'attachment_id' => $attachment_id,
            'alt_text' => $alt_text,
            'saved' => true,
        ));
    }

    /**
     * Context sent with the image: the context saved for it in the media
     * window, and the post title when generating inside a post.
     */
    private function get_context($attachment_id, $post_id)
    {
        $parts = array();

        $saved_context = trim((string) get_post_meta($attachment_id, '_alt_text_pro_context', true));
        if ($saved_context !== '') {
            $parts[] = $saved_context;
        }

        if ($post_id && AltTextPro_Settings::is_enabled('context_enabled') && current_user_can('edit_post', $post_id)) {
            $title = trim(wp_strip_all_tags(html_entity_decode((string) get_the_title($post_id), ENT_QUOTES | ENT_HTML5, 'UTF-8')));
            if ($title !== '') {
                $parts[] = $title;
            }
        }

        return implode(' | ', $parts);
    }

    /**
     * Send a failed generation as JSON. The code lets the browser add the
     * buy-credits link or the link to Settings for a rejected key.
     */
    private function send_generation_error(array $result)
    {
        $message = !empty($result['message'])
            ? (string) $result['message']
            : __('Failed to generate alt-text. Please check your API key and try again.', 'alt-text-pro');

        wp_send_json_error(array(
            // Plain text: the browser inserts it as text, not HTML.
            'message' => wp_strip_all_tags(html_entity_decode($message, ENT_QUOTES | ENT_HTML5, 'UTF-8')),
            'code' => !empty($result['no_credits']) ? 'no_credits' : sanitize_key((string) ($result['code'] ?? '')),
        ));
    }

    /**
     * "Generate alt text" row action on supported images in the Media
     * Library list view.
     *
     * @param string[] $actions Row actions.
     * @param WP_Post  $post    Attachment.
     * @return string[]
     */
    public function add_row_action($actions, $post)
    {
        if (
            !is_object($post)
            || !current_user_can('upload_files')
            || !AltTextPro_API_Client::is_supported_image($post->ID)
            || !current_user_can('edit_post', $post->ID)
        ) {
            return $actions;
        }

        // Without a connected account the media window explains what to do.
        $settings = get_option('alt_text_pro_settings', array());
        if (!is_array($settings) || empty($settings['api_key'])) {
            return $actions;
        }

        $has_alt = trim((string) get_post_meta($post->ID, '_wp_attachment_image_alt', true)) !== '';
        $label = $has_alt ? __('Regenerate alt text', 'alt-text-pro') : __('Generate alt text', 'alt-text-pro');
        $title = wp_strip_all_tags(html_entity_decode((string) get_the_title($post), ENT_QUOTES | ENT_HTML5, 'UTF-8'));

        $actions['alt_text_pro_generate'] = sprintf(
            '<a href="#" class="atp-row-generate" role="button" data-attachment-id="%1$d" aria-label="%2$s">%3$s</a>',
            intval($post->ID),
            esc_attr(sprintf(
                /* translators: 1: "Generate alt text" or "Regenerate alt text", 2: image title */
                __('%1$s for "%2$s" (uses 1 credit)', 'alt-text-pro'),
                $label,
                $title
            )),
            esc_html($label)
        );

        return $actions;
    }

    /**
     * Bulk action on the Media Library list view.
     *
     * @param string[] $actions Bulk actions.
     * @return string[]
     */
    public function add_bulk_action($actions)
    {
        if (current_user_can('upload_files')) {
            $actions[self::BULK_ACTION] = __('Generate alt text (Alt Text Pro)', 'alt-text-pro');
        }

        return $actions;
    }

    /**
     * Hand the chosen images to the Bulk page's "Selected" mode instead of
     * generating them all in this request. upload.php has already checked
     * the bulk-media nonce.
     *
     * @param string $redirect_to Where WordPress would redirect.
     * @param string $action      Chosen bulk action.
     * @param int[]  $post_ids    Chosen attachments.
     * @return string
     */
    public function handle_bulk_action($redirect_to, $action, $post_ids)
    {
        if ($action !== self::BULK_ACTION || !current_user_can('upload_files')) {
            return $redirect_to;
        }

        $ids = array_slice(array_values(array_unique(array_filter(array_map('absint', (array) $post_ids)))), 0, self::MAX_SELECTION);
        if (!empty($ids)) {
            _prime_post_caches($ids, false, true);
        }

        // Same rule as the "Generate alt text" row action and bulk runs:
        // existing alt text is replaced only with "Overwrite existing" on.
        $overwrite = AltTextPro_Settings::is_enabled('overwrite_existing');
        $selection = array(
            'ids' => array(),
            'unsupported' => 0,
            'no_permission' => 0,
            'has_alt' => 0,
        );

        foreach ($ids as $id) {
            if (!AltTextPro_API_Client::is_supported_image($id)) {
                $selection['unsupported']++;
            } elseif (!current_user_can('edit_post', $id)) {
                $selection['no_permission']++;
            } elseif (!$overwrite && trim((string) get_post_meta($id, '_wp_attachment_image_alt', true)) !== '') {
                $selection['has_alt']++;
            } else {
                $selection['ids'][] = $id;
            }
        }

        $selection['token'] = wp_generate_password(20, false);
        set_transient(self::SELECTION_TRANSIENT . get_current_user_id(), $selection, self::SELECTION_TTL);

        return add_query_arg(
            array(
                'page' => 'alt-text-pro-bulk',
                self::SELECTION_QUERY_ARG => $selection['token'],
            ),
            admin_url('admin.php')
        );
    }

    /**
     * Media Library list view script, and the hand-over on the Bulk page.
     *
     * @param string $hook Current admin page.
     */
    public function enqueue_admin_assets($hook)
    {
        if ($hook === 'upload.php') {
            $this->enqueue_media_list_assets();
            return;
        }

        // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only page check
        $page = isset($_GET['page']) ? sanitize_key(wp_unslash($_GET['page'])) : '';
        if ($page === 'alt-text-pro-bulk') {
            $this->enqueue_bulk_selection();
        }
    }

    /**
     * Row action script and styles for the Media Library list view.
     */
    private function enqueue_media_list_assets()
    {
        if (!current_user_can('upload_files')) {
            return;
        }

        wp_enqueue_style(
            'alt-text-pro-media-list',
            ALT_TEXT_PRO_PLUGIN_URL . 'assets/css/media-list.css',
            array('alt-text-pro-admin'),
            ALT_TEXT_PRO_VERSION
        );

        wp_enqueue_script(
            'alt-text-pro-media-list',
            ALT_TEXT_PRO_PLUGIN_URL . 'assets/js/media-list.js',
            array('jquery', 'alt-text-pro-admin'),
            ALT_TEXT_PRO_VERSION,
            true
        );

        wp_localize_script('alt-text-pro-media-list', 'altTextProMediaList', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('alt_text_pro_nonce'),
            'strings' => array(
                'generating' => __('Generating alt text (uses 1 credit)...', 'alt-text-pro'),
                'saved' => __('Alt text saved:', 'alt-text-pro'),
                'regenerate' => __('Regenerate alt text', 'alt-text-pro'),
                'draftNotSaved' => __('This image already has alt text, so the new text was not saved ("Overwrite existing" is off in Settings). The credit has been used.', 'alt-text-pro'),
                'newText' => __('New:', 'alt-text-pro'),
                'currentText' => __('Current:', 'alt-text-pro'),
                'replace' => __('Replace alt text', 'alt-text-pro'),
                'keep' => __('Keep current alt text', 'alt-text-pro'),
                'error' => __('Alt text could not be generated. Please try again.', 'alt-text-pro'),
                'saveError' => __('The alt text could not be saved. Please try again.', 'alt-text-pro'),
            ),
        ));
    }

    /**
     * Bulk page opened from the Media Library bulk action: preselect the
     * images in "Selected" mode and say what was left out.
     */
    private function enqueue_bulk_selection()
    {
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- the token is checked against this user's transient
        $token = isset($_GET[self::SELECTION_QUERY_ARG]) ? preg_replace('/[^A-Za-z0-9]/', '', (string) wp_unslash($_GET[self::SELECTION_QUERY_ARG])) : '';
        if ($token === '' || !current_user_can('upload_files')) {
            return;
        }

        $key = self::SELECTION_TRANSIENT . get_current_user_id();
        $selection = get_transient($key);
        if (!is_array($selection) || empty($selection['token']) || !hash_equals((string) $selection['token'], $token)) {
            return;
        }

        // One use: reloading the page later starts from a clean form.
        delete_transient($key);

        $ids = array_values(array_filter(array_map('absint', (array) ($selection['ids'] ?? array()))));

        wp_enqueue_script(
            'alt-text-pro-bulk-selection',
            ALT_TEXT_PRO_PLUGIN_URL . 'assets/js/bulk-selection.js',
            array('jquery', 'alt-text-pro-admin'),
            ALT_TEXT_PRO_VERSION,
            true
        );

        wp_localize_script('alt-text-pro-bulk-selection', 'altTextProBulkSelection', array(
            'ids' => $ids,
            'message' => self::get_selection_message(
                count($ids),
                intval($selection['has_alt'] ?? 0),
                intval($selection['unsupported'] ?? 0),
                intval($selection['no_permission'] ?? 0)
            ),
        ));
    }

    /**
     * Explain the hand-over from the Media Library on the Bulk page.
     *
     * @param int $selected      Images preselected.
     * @param int $has_alt       Left out: already have alt text.
     * @param int $unsupported   Left out: SVG or other unsupported files.
     * @param int $no_permission Left out: the user cannot edit them.
     */
    public static function get_selection_message($selected, $has_alt, $unsupported, $no_permission)
    {
        $parts = array();

        if ($selected > 0) {
            $parts[] = sprintf(
                /* translators: %s: number of images */
                _n(
                    '%s image from the Media Library is selected below. Each image uses 1 credit. Click Start to generate.',
                    '%s images from the Media Library are selected below. Each image uses 1 credit. Click Start to generate.',
                    $selected,
                    'alt-text-pro'
                ),
                number_format_i18n($selected)
            );
        } else {
            $parts[] = __('None of the images chosen in the Media Library can be processed.', 'alt-text-pro');
        }

        if ($has_alt > 0) {
            $parts[] = sprintf(
                /* translators: %s: number of images */
                _n(
                    '%s already has alt text and was left out. Turn on "Overwrite existing" in Settings, or select it in the list below, to replace it.',
                    '%s already have alt text and were left out. Turn on "Overwrite existing" in Settings, or select them in the list below, to replace them.',
                    $has_alt,
                    'alt-text-pro'
                ),
                number_format_i18n($has_alt)
            );
        }

        if ($unsupported > 0) {
            $parts[] = sprintf(
                /* translators: %s: number of files */
                _n(
                    '%s is not a supported image type (such as SVG) and was left out.',
                    '%s are not supported image types (such as SVG) and were left out.',
                    $unsupported,
                    'alt-text-pro'
                ),
                number_format_i18n($unsupported)
            );
        }

        if ($no_permission > 0) {
            $parts[] = sprintf(
                /* translators: %s: number of images */
                _n(
                    '%s was left out because you do not have permission to edit it.',
                    '%s were left out because you do not have permission to edit them.',
                    $no_permission,
                    'alt-text-pro'
                ),
                number_format_i18n($no_permission)
            );
        }

        return implode(' ', $parts);
    }

    /**
     * "Generate alt text" button for the image block in the block editor.
     */
    public function enqueue_block_editor_assets()
    {
        if (!current_user_can('upload_files')) {
            return;
        }

        $settings = get_option('alt_text_pro_settings', array());

        wp_enqueue_script(
            'alt-text-pro-block-editor',
            ALT_TEXT_PRO_PLUGIN_URL . 'assets/js/block-editor.js',
            array('wp-hooks', 'wp-compose', 'wp-element', 'wp-components', 'wp-block-editor', 'wp-data'),
            ALT_TEXT_PRO_VERSION,
            true
        );

        wp_localize_script('alt-text-pro-block-editor', 'altTextProBlockEditor', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('alt_text_pro_nonce'),
            'flags' => array(
                'connected' => is_array($settings) && !empty($settings['api_key']),
                'overwrite' => AltTextPro_Settings::is_enabled('overwrite_existing'),
            ),
            // Only administrators can open Settings to reconnect.
            'settingsUrl' => current_user_can('manage_options') ? admin_url('admin.php?page=alt-text-pro-settings') : '',
            'pricingUrl' => ALT_TEXT_PRO_PRICING_URL,
            'strings' => array(
                'panelTitle' => __('Alt Text Pro', 'alt-text-pro'),
                'generate' => __('Generate alt text', 'alt-text-pro'),
                'generating' => __('Generating...', 'alt-text-pro'),
                'helpOverwrite' => __('Uses 1 credit. Fills this block\'s alternative text and replaces the image\'s alt text in the Media Library.', 'alt-text-pro'),
                'helpKeep' => __('Uses 1 credit. Fills this block\'s alternative text. The Media Library alt text is filled only when it is empty.', 'alt-text-pro'),
                'noAttachment' => __('Alt Text Pro can generate alt text for images from the Media Library. Upload or choose this image from the Media Library first.', 'alt-text-pro'),
                'notConnected' => __('Connect your Alt Text Pro account to generate alt text.', 'alt-text-pro'),
                'notConnectedNoAdmin' => __('Alt Text Pro is not connected yet. Ask a site administrator to connect it.', 'alt-text-pro'),
                'savedBoth' => __('Alt text added to this block and saved to the Media Library. Save the post to keep it in the block.', 'alt-text-pro'),
                'savedBlock' => __('Alt text added to this block. The Media Library kept its existing alt text ("Overwrite existing" is off). Save the post to keep it.', 'alt-text-pro'),
                // translators: %d: credits the account can still spend.
                'creditsLeft' => __('Credits left: %d', 'alt-text-pro'),
                'imageChanged' => __('The image in this block changed while generating, so the alt text was not added.', 'alt-text-pro'),
                'error' => __('Alt text could not be generated. Please try again.', 'alt-text-pro'),
                'openSettings' => __('Open Settings to reconnect', 'alt-text-pro'),
                'connect' => __('Open Alt Text Pro settings', 'alt-text-pro'),
                'askAdmin' => __('Ask a site administrator to reconnect Alt Text Pro in its Settings.', 'alt-text-pro'),
                'buyCredits' => __('Buy credits or upgrade', 'alt-text-pro'),
            ),
        ));
    }
}
