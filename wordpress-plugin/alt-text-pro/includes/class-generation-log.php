<?php
/**
 * Generation log for Alt Text Pro
 *
 * Writes rows to the logs table and records whether the generated text
 * reached the image. A single-image draft uses its credit as soon as it is
 * generated, but only counts as saved once that text is stored as the
 * image's alt text (Apply, then save or update the image).
 */

if (!defined('ABSPATH')) {
    exit;
}

class AltTextPro_Generation_Log
{
    // Status of a log row. Rows logged before 1.7.28 have an empty status
    // (not recorded) and are shown as before.
    public const STATUS_SAVED = 'saved';
    public const STATUS_DRAFT = 'draft';
    public const STATUS_BLOCK = 'block';

    // First schema (alt_text_pro_db_version) with the status column.
    public const STATUS_SCHEMA_VERSION = '1.7.28';

    // Unapplied drafts compared when an image's alt text is saved.
    private const DRAFT_LOOKUP_LIMIT = 20;

    /**
     * Watch alt text saves everywhere (media window, image edit screen, REST
     * API, bulk runs) so a draft is marked saved however it gets applied.
     */
    public static function register_hooks()
    {
        add_action('added_post_meta', array(__CLASS__, 'handle_alt_meta_saved'), 10, 4);
        add_action('updated_post_meta', array(__CLASS__, 'handle_alt_meta_saved'), 10, 4);
    }

    /**
     * Logs table of the current site.
     */
    public static function table_name()
    {
        global $wpdb;

        return $wpdb->prefix . 'alt_text_pro_logs';
    }

    /**
     * True once this site's logs table has the status column.
     */
    public static function has_status_column()
    {
        return version_compare((string) get_option('alt_text_pro_db_version', '0'), self::STATUS_SCHEMA_VERSION, '>=');
    }

    /**
     * Record one generation.
     *
     * @param int    $attachment_id Image described.
     * @param string $alt_text      Generated text.
     * @param int    $credits_used  Credits the service charged.
     * @param string $status        STATUS_SAVED, STATUS_DRAFT or STATUS_BLOCK.
     */
    public static function insert($attachment_id, $alt_text, $credits_used = 1, $status = self::STATUS_SAVED)
    {
        global $wpdb;

        $data = array(
            'attachment_id' => absint($attachment_id),
            'alt_text' => (string) $alt_text,
            'credits_used' => intval($credits_used),
            'created_at' => current_time('mysql'),
        );
        $formats = array('%d', '%s', '%d', '%s');

        // Before the schema upgrade has run the column does not exist yet.
        if (self::has_status_column()) {
            $data['status'] = in_array($status, array(self::STATUS_SAVED, self::STATUS_DRAFT, self::STATUS_BLOCK), true)
                ? $status
                : self::STATUS_SAVED;
            $formats[] = '%s';
        }

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $wpdb->insert(self::table_name(), $data, $formats);
    }

    /**
     * An image's alt text was saved: mark unapplied drafts with the same text
     * as saved.
     *
     * @param int    $meta_id    Meta row ID.
     * @param int    $object_id  Post ID.
     * @param string $meta_key   Meta key.
     * @param mixed  $meta_value Saved (unslashed) value.
     */
    public static function handle_alt_meta_saved($meta_id, $object_id, $meta_key, $meta_value)
    {
        if ($meta_key !== '_wp_attachment_image_alt' || !is_scalar($meta_value) || !self::has_status_column()) {
            return;
        }

        $saved_text = self::normalize_text((string) $meta_value);
        if ($saved_text === '') {
            return;
        }

        global $wpdb;
        $table = self::table_name();

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name comes from $wpdb
        $drafts = $wpdb->get_results($wpdb->prepare(
            "SELECT id, alt_text FROM {$table}
             WHERE attachment_id = %d AND status IN (%s, %s)
             ORDER BY id DESC
             LIMIT %d",
            absint($object_id),
            self::STATUS_DRAFT,
            self::STATUS_BLOCK,
            self::DRAFT_LOOKUP_LIMIT
        ));

        foreach ((array) $drafts as $draft) {
            if (self::normalize_text((string) $draft->alt_text) !== $saved_text) {
                continue;
            }

            // phpcs:ignore WordPress.DB.DirectDatabaseQuery
            $wpdb->update(
                $table,
                array('status' => self::STATUS_SAVED),
                array('id' => intval($draft->id)),
                array('%s'),
                array('%d')
            );
        }
    }

    /**
     * Schema upgrade: rows logged before the status column existed never
     * recorded whether a draft was applied, so they are marked "not
     * recorded" instead of taking the new "saved" default.
     */
    public static function clear_legacy_status()
    {
        global $wpdb;
        $table = self::table_name();

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name comes from $wpdb
        $wpdb->query("UPDATE {$table} SET status = ''");
    }

    /**
     * Label, style and explanation of a log row's status for the Logs page
     * and the CSV export, or null for rows that did not record one.
     *
     * @param string $status Stored status.
     * @return array|null array('class' => string, 'label' => string, 'description' => string)
     */
    public static function get_status_display($status)
    {
        switch ((string) $status) {
            case self::STATUS_SAVED:
                return array(
                    'class' => 'saved',
                    'label' => __('Saved to image', 'alt-text-pro'),
                    'description' => '',
                );
            case self::STATUS_DRAFT:
                return array(
                    'class' => 'draft',
                    'label' => __('Draft, not applied', 'alt-text-pro'),
                    'description' => __('The credit was used, but this text was never saved as the image\'s alt text.', 'alt-text-pro'),
                );
            case self::STATUS_BLOCK:
                return array(
                    'class' => 'block',
                    'label' => __('Added to an image block', 'alt-text-pro'),
                    'description' => __('Placed in an image block in the editor. The Media Library kept its existing alt text.', 'alt-text-pro'),
                );
        }

        return null;
    }

    /**
     * Compare alt text the way WordPress stores it: no tags or entities,
     * single spaces.
     */
    private static function normalize_text($text)
    {
        $text = wp_strip_all_tags(html_entity_decode((string) $text, ENT_QUOTES | ENT_HTML5, 'UTF-8'));

        return trim((string) preg_replace('/\s+/u', ' ', $text));
    }
}
