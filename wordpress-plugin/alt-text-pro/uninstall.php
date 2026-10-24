<?php
/**
 * Remove Alt Text Pro configuration and local generation history on uninstall.
 * Generated attachment alt text remains part of the site's content.
 */

if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

/**
 * Remove the plugin's options, scheduled events and logs table from the
 * current site.
 */
function alt_text_pro_uninstall_site()
{
    global $wpdb;

    delete_option('alt_text_pro_settings');
    delete_option('alt_text_pro_version');
    delete_option('alt_text_pro_db_version');
    delete_option('alt_text_pro_api_key_storage_error');
    delete_option('alt_text_pro_active_bulk_run');
    delete_transient('alt_text_pro_activation_redirect');
    delete_transient('alt_text_pro_generated_count');

    wp_clear_scheduled_hook('alt_text_pro_cleanup');
    wp_clear_scheduled_hook('alt_text_pro_bulk_process_batch');
    wp_clear_scheduled_hook('alt_text_pro_generate_background');

    $logs_table = $wpdb->prefix . 'alt_text_pro_logs';
    // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
    $wpdb->query("DROP TABLE IF EXISTS {$logs_table}");

    $transient_prefix = $wpdb->esc_like('_transient_alt_text_pro_') . '%';
    $timeout_prefix = $wpdb->esc_like('_transient_timeout_alt_text_pro_') . '%';
    $lock_prefix = $wpdb->esc_like('alt_text_pro_bulk_lock_') . '%';
    $bulk_state_prefix = $wpdb->esc_like('alt_text_pro_bulk_state_') . '%';
    // phpcs:ignore WordPress.DB.DirectDatabaseQuery
    $wpdb->query(
        $wpdb->prepare(
            "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s OR option_name LIKE %s OR option_name LIKE %s",
            $transient_prefix,
            $timeout_prefix,
            $lock_prefix,
            $bulk_state_prefix
        )
    );
}

if (is_multisite()) {
    // Clean every site of the network, not only the main one.
    $alt_text_pro_site_ids = get_sites(array(
        'fields' => 'ids',
        'number' => 0,
    ));

    foreach ($alt_text_pro_site_ids as $alt_text_pro_site_id) {
        switch_to_blog($alt_text_pro_site_id);
        alt_text_pro_uninstall_site();
        restore_current_blog();
    }
} else {
    alt_text_pro_uninstall_site();
}

// Review-request answers are stored per user, once for the whole network.
delete_metadata('user', 0, 'alt_text_pro_review_prompt', '', true);
