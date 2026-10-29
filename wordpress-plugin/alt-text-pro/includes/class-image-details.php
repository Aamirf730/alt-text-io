<?php
/**
 * Image details: decorative images, and filling the image title, caption
 * and description from alt text the plugin wrote.
 *
 * @package AltTextPro
 */

if (!defined('ABSPATH')) {
    exit;
}

class AltTextPro_Image_Details
{
    // '1' when the image is decorative: its alt text stays empty on purpose.
    // Generation skips it and the post-content fill leaves alt="" alone.
    public const DECORATIVE_META = '_alt_text_pro_decorative';

    // The alt text the service last wrote for the image. Kept only while one
    // of the "also fill" settings is on, so that saving exactly that text
    // (applying a draft, an upload, a bulk run) can be recognised as the
    // plugin's alt text rather than text a person typed.
    public const GENERATED_ALT_META = '_alt_text_pro_generated_alt';

    // Settings that copy new alt text into other image fields (off by default).
    public const DETAIL_SETTINGS = array('fill_title_from_alt', 'fill_caption_from_alt', 'fill_description_from_alt');

    // Attachment field name of the decorative checkbox.
    private const DECORATIVE_FIELD = 'alt_text_pro_decorative';

    /**
     * Images whose title, caption or description to fill when this request
     * ends, keyed by attachment ID.
     *
     * @var array<int, string>
     */
    private static $pending_details = array();

    // Whether the shutdown callback is registered for this request.
    private static $shutdown_hooked = false;

    /**
     * Constructor
     */
    public function __construct()
    {
        // Media modal, Media Library grid and the attachment edit screen.
        add_filter('attachment_fields_to_edit', array($this, 'add_decorative_field'), 20, 2);
        add_filter('attachment_fields_to_save', array($this, 'save_decorative_field'), 10, 2);

        // Every way alt text is saved ends in these two actions, including
        // WordPress's own media modal and edit screen.
        add_action('added_post_meta', array($this, 'on_alt_text_saved'), 10, 4);
        add_action('updated_post_meta', array($this, 'on_alt_text_saved'), 10, 4);
    }

    /**
     * True when the image is marked as decorative.
     *
     * @param int $attachment_id Image to check.
     */
    public static function is_decorative($attachment_id)
    {
        $attachment_id = absint($attachment_id);

        return $attachment_id && (string) get_post_meta($attachment_id, self::DECORATIVE_META, true) === '1';
    }

    /**
     * Shown when someone asks for alt text for a decorative image.
     */
    public static function get_decorative_message()
    {
        return __('This image is marked as decorative, so its alt text stays empty on purpose and no credit was used. Untick "Decorative image" for this image to generate alt text.', 'alt-text-pro');
    }

    /**
     * SQL condition that leaves out decorative images, for queries over
     * attachments. Starts with " AND ".
     *
     * @param string $table_alias Alias of the posts table in the query.
     */
    public static function get_not_decorative_sql_clause($table_alias = 'p')
    {
        global $wpdb;

        $table_alias = preg_replace('/[^A-Za-z0-9_]/', '', (string) $table_alias);
        if ($table_alias === '') {
            $table_alias = $wpdb->posts;
        }

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table names come from $wpdb and the alias is restricted above
        return $wpdb->prepare(
            " AND NOT EXISTS (
                 SELECT 1 FROM {$wpdb->postmeta} atp_decorative
                 WHERE atp_decorative.post_id = {$table_alias}.ID
                 AND atp_decorative.meta_key = %s
                 AND atp_decorative.meta_value = '1'
             )",
            self::DECORATIVE_META
        );
    }

    /**
     * "Decorative image" checkbox for images in the media modal and on the
     * attachment edit screen.
     *
     * @param array   $form_fields Attachment fields.
     * @param WP_Post $post        Attachment.
     * @return array
     */
    public function add_decorative_field($form_fields, $post)
    {
        if (
            !is_array($form_fields)
            || !is_object($post)
            || empty($post->ID)
            || !wp_attachment_is_image($post->ID)
            || !current_user_can('edit_post', $post->ID)
        ) {
            return $form_fields;
        }

        $attachment_id = (int) $post->ID;
        $name = 'attachments[' . $attachment_id . '][' . self::DECORATIVE_FIELD . ']';
        $field_id = 'attachments-' . $attachment_id . '-' . self::DECORATIVE_FIELD;

        // The hidden 0 comes first, so an unticked box still reaches the save
        // filter; when ticked, the later 1 wins.
        $html = '<input type="hidden" name="' . esc_attr($name) . '" value="0" />'
            . '<label class="alt-text-pro-decorative-label"><input type="checkbox" id="' . esc_attr($field_id) . '" name="' . esc_attr($name) . '" value="1"'
            . checked(self::is_decorative($attachment_id), true, false) . ' /> '
            . esc_html__('Decorative image (empty alt on purpose)', 'alt-text-pro') . '</label>';

        // WordPress prints label and helps without escaping them.
        $form_fields[self::DECORATIVE_FIELD] = array(
            'label' => esc_html__('Decorative', 'alt-text-pro'),
            'input' => 'html',
            'html' => $html,
            'helps' => esc_html__('For images that add nothing for someone who cannot see them, such as dividers or background patterns. Alt Text Pro will not write alt text for this image, and leaves its alt empty in posts. If the Alternative Text field has text, clear it as well.', 'alt-text-pro'),
        );

        return $form_fields;
    }

    /**
     * Save the "Decorative image" checkbox.
     *
     * @param array $post       Attachment data being saved.
     * @param array $attachment Submitted attachment fields.
     * @return array
     */
    public function save_decorative_field($post, $attachment)
    {
        // Only act when this form carried the checkbox; other saves (title
        // or alt changes in the media modal) do not include it.
        if (!is_array($post) || !is_array($attachment) || !array_key_exists(self::DECORATIVE_FIELD, $attachment)) {
            return $post;
        }

        $attachment_id = isset($post['ID']) ? absint($post['ID']) : 0;
        if (!$attachment_id || !current_user_can('edit_post', $attachment_id)) {
            return $post;
        }

        $value = is_scalar($attachment[self::DECORATIVE_FIELD])
            ? sanitize_text_field(wp_unslash((string) $attachment[self::DECORATIVE_FIELD]))
            : '';

        if ($value === '1') {
            update_post_meta($attachment_id, self::DECORATIVE_META, '1');

            // An automatic description queued at upload no longer applies.
            if (class_exists('AltTextPro_Media_Handler')) {
                AltTextPro_Media_Handler::claim_pending_upload($attachment_id);
            }
        } else {
            delete_post_meta($attachment_id, self::DECORATIVE_META);
        }

        return $post;
    }

    /**
     * True when at least one "also fill" setting is on.
     */
    public static function is_detail_fill_enabled()
    {
        foreach (self::DETAIL_SETTINGS as $setting) {
            if (AltTextPro_Settings::is_enabled($setting)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Remember the alt text the service just wrote for an image. The API
     * client calls this after every successful generation.
     *
     * @param int    $attachment_id Described image.
     * @param string $alt_text      Generated alt text.
     */
    public static function remember_generated_alt($attachment_id, $alt_text)
    {
        $attachment_id = absint($attachment_id);
        $alt_text = sanitize_text_field((string) $alt_text);

        if (!$attachment_id || $alt_text === '' || !self::is_detail_fill_enabled()) {
            return;
        }

        update_post_meta($attachment_id, self::GENERATED_ALT_META, $alt_text);
    }

    /**
     * When an image's alt text is saved as exactly the text the plugin
     * generated, fill the image's empty details at the end of the request.
     *
     * Waiting for the end of the request matters: WordPress's media modal
     * saves the alt text and then writes the whole attachment back, which
     * would undo a title or caption written in between.
     *
     * @param int    $meta_id    Meta row ID.
     * @param int    $object_id  Post ID.
     * @param string $meta_key   Meta key.
     * @param mixed  $meta_value Saved value.
     */
    public function on_alt_text_saved($meta_id, $object_id, $meta_key, $meta_value)
    {
        if ($meta_key !== '_wp_attachment_image_alt' || !is_scalar($meta_value)) {
            return;
        }

        $attachment_id = absint($object_id);
        if (!$attachment_id) {
            return;
        }

        $generated = get_post_meta($attachment_id, self::GENERATED_ALT_META, true);
        if (!is_string($generated) || $generated === '') {
            return;
        }

        $saved = self::normalize_text((string) $meta_value);
        if ($saved === '' || $saved !== self::normalize_text($generated)) {
            // A person changed the draft before saving: their text is not
            // copied anywhere.
            return;
        }

        delete_post_meta($attachment_id, self::GENERATED_ALT_META);

        if (!self::is_detail_fill_enabled()) {
            return;
        }

        self::$pending_details[$attachment_id] = $saved;

        if (!self::$shutdown_hooked) {
            self::$shutdown_hooked = true;
            add_action('shutdown', array(__CLASS__, 'apply_pending_details'));
        }
    }

    /**
     * Fill the details of the images queued in this request.
     */
    public static function apply_pending_details()
    {
        $pending = self::$pending_details;
        self::$pending_details = array();

        foreach ($pending as $attachment_id => $alt_text) {
            self::fill_image_details($attachment_id, $alt_text);
        }
    }

    /**
     * Copy alt text into the image title (while it is still the file name),
     * the caption and the description (while empty), as the settings say.
     * Text a person wrote is never replaced.
     *
     * @param int    $attachment_id Image.
     * @param string $alt_text      Alt text the plugin saved.
     * @return bool True when the image was updated.
     */
    public static function fill_image_details($attachment_id, $alt_text)
    {
        $attachment_id = absint($attachment_id);
        $alt_text = sanitize_text_field((string) $alt_text);
        $post = $attachment_id ? get_post($attachment_id) : null;

        if (!$post || $post->post_type !== 'attachment' || $alt_text === '' || self::is_decorative($attachment_id)) {
            return false;
        }

        $update = array();

        if (AltTextPro_Settings::is_enabled('fill_title_from_alt') && self::is_file_name_title($post)) {
            $update['post_title'] = $alt_text;
        }

        if (AltTextPro_Settings::is_enabled('fill_caption_from_alt') && trim((string) $post->post_excerpt) === '') {
            $update['post_excerpt'] = $alt_text;
        }

        if (AltTextPro_Settings::is_enabled('fill_description_from_alt') && trim((string) $post->post_content) === '') {
            $update['post_content'] = $alt_text;
        }

        if (empty($update)) {
            return false;
        }

        $update['ID'] = $attachment_id;

        // wp_update_post() expects slashed data.
        $result = wp_update_post(wp_slash($update), true);

        return !is_wp_error($result) && $result;
    }

    /**
     * True when the image title is empty or still just the file name that
     * WordPress gave it on upload (for example "IMG_1234" or "team-photo").
     *
     * @param WP_Post $post Attachment.
     */
    public static function is_file_name_title($post)
    {
        $title = trim(html_entity_decode((string) $post->post_title, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        if ($title === '') {
            return true;
        }

        $files = array(
            get_attached_file($post->ID, true),
            get_post_meta($post->ID, '_wp_attached_file', true),
            (string) wp_parse_url((string) $post->guid, PHP_URL_PATH),
        );
        if (function_exists('wp_get_original_image_path')) {
            $files[] = wp_get_original_image_path($post->ID, true);
        }

        $normalized_title = self::normalize_file_name($title);

        foreach ($files as $file) {
            if (!is_string($file) || $file === '') {
                continue;
            }

            $name = pathinfo(wp_basename($file), PATHINFO_FILENAME);

            // WordPress adds -scaled, -rotated, -e{timestamp} (edited) and
            // -1, -2 (duplicate names) to the stored file name.
            for ($i = 0; $i < 4 && $name !== ''; $i++) {
                if (self::normalize_file_name($name) === $normalized_title) {
                    return true;
                }

                $shorter = preg_replace('/-(?:scaled|rotated|e\d{10,}|\d{1,3})$/i', '', $name);
                if (!is_string($shorter) || $shorter === $name) {
                    break;
                }
                $name = $shorter;
            }
        }

        return false;
    }

    /**
     * Lower case, with dashes, underscores, dots and spaces folded to one
     * space, so "IMG_1234" and "img-1234" compare equal.
     *
     * @param string $name File name or title.
     */
    private static function normalize_file_name($name)
    {
        $name = function_exists('mb_strtolower') ? mb_strtolower((string) $name, 'UTF-8') : strtolower((string) $name);
        $folded = preg_replace('/[\s._-]+/u', ' ', $name);

        return trim(is_string($folded) ? $folded : $name);
    }

    /**
     * Plain text with runs of white space folded, for comparing alt text.
     *
     * @param string $text Text to compare.
     */
    private static function normalize_text($text)
    {
        $text = wp_strip_all_tags((string) $text);
        $folded = preg_replace('/\s+/u', ' ', $text);

        return trim(is_string($folded) ? $folded : $text);
    }
}
