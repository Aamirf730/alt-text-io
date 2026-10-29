<?php
/**
 * Admin functionality for Alt-Text AI
 * 
 * Handles admin dashboard, menu pages, and admin-specific features
 */

if (!defined('ABSPATH')) {
    exit;
}

class AltTextPro_Admin
{

    /**
     * Constructor
     */
    public function __construct()
    {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'admin_init'));
        add_action('alt_text_pro_render_notices', array($this, 'plugin_notices'));
        // Media modal and Media Library grid. The full attachment edit screen
        // uses the meta box instead, so add_alt_text_field() skips it.
        add_filter('attachment_fields_to_edit', array($this, 'add_alt_text_field'), 10, 2);
        add_filter('attachment_fields_to_save', array($this, 'save_alt_text_field'), 10, 2);
        add_action('add_meta_boxes', array($this, 'add_media_meta_boxes'));
        add_action('admin_post_alt_text_pro_export_logs', array($this, 'export_logs_csv'));
        add_action('admin_post_alt_text_pro_review_prompt', array($this, 'handle_review_prompt'));
        add_action('wp_ajax_alt_text_pro_dismiss_onboarding', array($this, 'ajax_dismiss_onboarding'));
        add_action('admin_post_alt_text_pro_hide_key_notice', array($this, 'handle_hide_key_notice'));
    }

    // Per-user flag: the onboarding modal was closed with "I'll do this later".
    public const ONBOARDING_DISMISSED_META = 'alt_text_pro_onboarding_dismissed';

    // Per-user flag: the site-wide "configure your API key" notice was hidden.
    public const KEY_NOTICE_HIDDEN_META = 'alt_text_pro_key_notice_hidden';

    // Per-user transient holding automatic-generation failures to report.
    public const AUTO_GENERATE_ERROR_TRANSIENT = 'alt_text_pro_error_';

    // Logs per page on the Usage & Logs screen.
    private const LOGS_PER_PAGE = 20;

    /**
     * Remember that this user chose "I'll do this later" in the onboarding
     * modal, so it no longer opens on every page load.
     */
    public function ajax_dismiss_onboarding()
    {
        check_ajax_referer('alt_text_pro_nonce', 'nonce');

        if (!current_user_can('manage_options')) {
            AltTextPro::send_permission_error();
        }

        update_user_meta(get_current_user_id(), self::ONBOARDING_DISMISSED_META, time());
        wp_send_json_success();
    }

    /**
     * Record a failed automatic generation for the user who uploaded the
     * image; the next admin page shows it once.
     *
     * @param int    $user_id    Uploading user.
     * @param string $message    Plain-text reason.
     * @param string $image_name Image title.
     * @param string $code       Error code such as no_credits.
     */
    public static function record_auto_generate_error($user_id, $message, $image_name, $code = '')
    {
        $user_id = absint($user_id);
        if (!$user_id) {
            return;
        }

        $key = self::AUTO_GENERATE_ERROR_TRANSIENT . $user_id;
        $existing = get_transient($key);
        $existing = is_array($existing) ? $existing : array();

        set_transient($key, array(
            'count' => intval($existing['count'] ?? 0) + 1,
            'message' => (string) $message,
            'image' => (string) $image_name,
            'code' => (string) $code,
        ), DAY_IN_SECONDS);
    }

    /**
     * Show (once) the automatic-generation failures recorded for the current
     * user, with a buy-credits link when credits ran out.
     */
    private function render_auto_generate_errors()
    {
        if (!current_user_can('upload_files')) {
            return;
        }

        $key = self::AUTO_GENERATE_ERROR_TRANSIENT . get_current_user_id();
        $error = get_transient($key);
        if (!is_array($error) || empty($error['message'])) {
            return;
        }
        delete_transient($key);

        $count = max(1, intval($error['count'] ?? 1));
        echo '<div class="notice notice-error is-dismissible alt-text-pro-auto-error"><p><strong>' . esc_html__('Alt Text Pro:', 'alt-text-pro') . '</strong> ';
        if ($count > 1) {
            echo esc_html(sprintf(
                /* translators: 1: number of uploads, 2: reason of the latest failure */
                __('Automatic alt text failed for %1$d uploaded images. Latest reason: %2$s', 'alt-text-pro'),
                $count,
                $error['message']
            ));
        } else {
            echo esc_html(sprintf(
                /* translators: 1: image title, 2: reason */
                __('Automatic alt text failed for "%1$s": %2$s', 'alt-text-pro'),
                $error['image'] ?? '',
                $error['message']
            ));
        }

        if (($error['code'] ?? '') === 'no_credits') {
            echo ' <a href="' . esc_url(ALT_TEXT_PRO_PRICING_URL) . '" target="_blank" rel="noopener noreferrer">' . esc_html__('Buy credits or upgrade', 'alt-text-pro') . '</a>';
        } elseif (in_array($error['code'] ?? '', array('invalid_api_key', 'account_not_found'), true) && current_user_can('manage_options')) {
            echo ' <a href="' . esc_url(admin_url('admin.php?page=alt-text-pro-settings')) . '">' . esc_html__('Open Alt Text Pro settings', 'alt-text-pro') . '</a>';
        }
        echo '</p></div>';
    }

    // Most rows one CSV export writes.
    private const EXPORT_LOGS_LIMIT = 50000;

    // Generated descriptions on this site before the review request appears.
    public const REVIEW_PROMPT_THRESHOLD = 50;

    // Per-user state: 'done', or a Unix time to ask again after.
    public const REVIEW_PROMPT_META = 'alt_text_pro_review_prompt';

    public const REVIEW_PROMPT_SNOOZE = 30 * DAY_IN_SECONDS;

    public const REVIEW_URL = 'https://wordpress.org/support/plugin/alt-text-pro/reviews/#new-post';

    /**
     * Logs page "Export": download the generation history as CSV, filtered
     * by the search box the same way as the table.
     */
    public function export_logs_csv()
    {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have permission to perform this action.', 'alt-text-pro'), '', array('response' => 403));
        }

        check_admin_referer('alt_text_pro_export_logs');

        global $wpdb;
        $logs_table = $wpdb->prefix . 'alt_text_pro_logs';
        $search = isset($_GET['s']) ? sanitize_text_field(wp_unslash($_GET['s'])) : '';
        $outcome = isset($_GET['outcome']) ? sanitize_key(wp_unslash($_GET['outcome'])) : '';

        $where = 'WHERE 1=1';
        $args = array();
        if ($search !== '') {
            // Same match as the Logs page search: alt text or image title.
            $where .= ' AND (l.alt_text LIKE %s OR p.post_title LIKE %s)';
            $args[] = '%' . $wpdb->esc_like($search) . '%';
            $args[] = '%' . $wpdb->esc_like($search) . '%';
        }
        // Same outcome filter as the Logs page (generated, failed...).
        $where .= AltTextPro_Bulk_Processor::outcome_filter_sql($outcome, 'l');
        $args[] = self::EXPORT_LOGS_LIMIT;

        // Whether each draft was applied; sites not yet upgraded have no column.
        $status_column = AltTextPro_Generation_Log::has_status_column() ? ', l.status' : '';
        // Failed and skipped bulk images are exported with their reason.
        $outcome_columns = AltTextPro_Bulk_Processor::log_columns_ready()
            ? ', l.outcome, l.outcome_reason, l.run_ref'
            : '';

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared -- table names come from $wpdb; values are prepared
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT l.id, l.attachment_id, p.post_title, l.alt_text, l.credits_used, l.created_at{$status_column}{$outcome_columns}
             FROM {$logs_table} l
             LEFT JOIN {$wpdb->posts} p ON l.attachment_id = p.ID
             {$where}
             ORDER BY l.created_at DESC, l.id DESC
             LIMIT %d",
            $args
        ), ARRAY_A);

        $filename = 'alt-text-pro-logs-' . current_time('Y-m-d') . '.csv';

        nocache_headers();
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('X-Content-Type-Options: nosniff');

        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
        $output = fopen('php://output', 'w');
        // UTF-8 byte order mark so spreadsheet apps read accents correctly.
        fwrite($output, "\xEF\xBB\xBF"); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite
        foreach (self::get_logs_csv_rows((array) $rows) as $csv_row) {
            fputcsv($output, $csv_row, ',', '"', '');
        }
        fclose($output); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
        exit;
    }

    /**
     * Build CSV rows (header first) for log records.
     *
     * Cells that a spreadsheet would run as a formula are prefixed with a
     * quote so exported alt text cannot execute anything.
     *
     * Status, then result, reason and run come last so the first six
     * columns keep their place for existing spreadsheets.
     *
     * @param array[] $rows Log rows with id, attachment_id, post_title, alt_text, credits_used, created_at, and optionally status, outcome, outcome_reason, run_ref.
     * @return array[]
     */
    public static function get_logs_csv_rows(array $rows)
    {
        $csv_rows = array(array(
            __('Log ID', 'alt-text-pro'),
            __('Attachment ID', 'alt-text-pro'),
            __('Image', 'alt-text-pro'),
            __('Alt Text', 'alt-text-pro'),
            __('Credits', 'alt-text-pro'),
            __('Date', 'alt-text-pro'),
            __('Status', 'alt-text-pro'),
            // Bulk-run result (generated, failed, skipped...) and why.
            __('Result', 'alt-text-pro'),
            __('Reason', 'alt-text-pro'),
            __('Bulk run', 'alt-text-pro'),
        ));
        $outcome_labels = class_exists('AltTextPro_Bulk_Processor') ? AltTextPro_Bulk_Processor::get_outcome_labels() : array();

        foreach ($rows as $row) {
            $row = (array) $row;
            $outcome = (string) ($row['outcome'] ?? 'generated');
            $csv_rows[] = array(
                (string) intval($row['id'] ?? 0),
                (string) intval($row['attachment_id'] ?? 0),
                self::csv_safe_cell($row['post_title'] ?? ''),
                self::csv_safe_cell($row['alt_text'] ?? ''),
                (string) intval($row['credits_used'] ?? 0),
                self::csv_safe_cell($row['created_at'] ?? ''),
                // Only generations have a draft/saved status.
                self::csv_safe_cell(in_array($outcome, array('generated', 'suggested'), true) ? self::get_log_status_label($row['status'] ?? '') : ''),
                self::csv_safe_cell($outcome_labels[$outcome] ?? $outcome),
                self::csv_safe_cell($row['outcome_reason'] ?? ''),
                self::csv_safe_cell($row['run_ref'] ?? ''),
            );
        }

        return $csv_rows;
    }

    /**
     * Status label of a log row ("Draft, not applied" and so on), or '' for
     * rows logged before statuses were recorded.
     */
    private static function get_log_status_label($status)
    {
        if (!class_exists('AltTextPro_Generation_Log')) {
            return '';
        }

        $display = AltTextPro_Generation_Log::get_status_display($status);
        return $display ? $display['label'] : '';
    }

    /**
     * Neutralise spreadsheet formulas in a text cell.
     */
    private static function csv_safe_cell($value)
    {
        $value = (string) $value;
        if ($value !== '' && strpos("=+-@\t\r", $value[0]) !== false) {
            $value = "'" . $value;
        }

        return $value;
    }

    /**
     * Admin menu icon: the simplified "ALT" mark as a single-colour SVG.
     *
     * The letters are cut out of the disc (even-odd fill), so WordPress can
     * repaint the one fill colour to match the admin colour scheme.
     */
    public static function menu_icon()
    {
        return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cGF0aCBmaWxsPSIjYTdhYWFkIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik01MCAyYTQ4IDQ4IDAgMSAwIDAgOTZBNDggNDggMCAxIDAgNTAgMlpNMTQgNjUgMjMuNSAzNWg3LjVMNDAuNSA2NWgtNy42bC0xLjgtNmgtOC43bC0xLjggNlpNMjQuNiA1M2g0LjlMMjcgNDQuNlpNNDIuNSAzNWg3LjZ2MjMuNmgxMS42VjY1SDQyLjVaTTYyLjUgMzVoMjUuNXY2LjZoLTlWNjVoLTcuNVY0MS42aC05WiIvPjwvc3ZnPgo=';
    }

    /**
     * Add admin menu
     */
    public function add_admin_menu()
    {
        add_menu_page(
            __('Alt Text Pro', 'alt-text-pro'),
            __('Alt Text Pro', 'alt-text-pro'),
            'manage_options',
            'alt-text-pro',
            array($this, 'dashboard_page'),
            self::menu_icon(),
            30
        );

        add_submenu_page(
            'alt-text-pro',
            __('Dashboard', 'alt-text-pro'),
            __('Dashboard', 'alt-text-pro'),
            'manage_options',
            'alt-text-pro',
            array($this, 'dashboard_page')
        );

        add_submenu_page(
            'alt-text-pro',
            __('Bulk Process', 'alt-text-pro'),
            __('Bulk Process', 'alt-text-pro'),
            'upload_files',
            'alt-text-pro-bulk',
            array($this, 'bulk_process_page')
        );

        add_submenu_page(
            'alt-text-pro',
            __('Settings', 'alt-text-pro'),
            __('Settings', 'alt-text-pro'),
            'manage_options',
            'alt-text-pro-settings',
            array($this, 'settings_page')
        );

        add_submenu_page(
            'alt-text-pro',
            __('Usage & Logs', 'alt-text-pro'),
            __('Usage & Logs', 'alt-text-pro'),
            'manage_options',
            'alt-text-pro-logs',
            array($this, 'logs_page')
        );
    }

    /**
     * Whether we are on a plugin page
     * @var bool
     */
    private $is_plugin_page = false;

    /**
     * Admin init
     */
    public function admin_init()
    {
        // Add settings link to plugins page
        add_filter('plugin_action_links_' . ALT_TEXT_PRO_PLUGIN_BASENAME, array($this, 'add_plugin_action_links'));

        // Determine if we are on a plugin page
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        $page = isset($_GET['page']) ? sanitize_text_field(wp_unslash($_GET['page'])) : '';
        $this->is_plugin_page = (strpos($page, 'alt-text-pro') !== false);

        // Add our admin notice only on NON-plugin pages (plugin pages have the API key field visible)
        if (!$this->is_plugin_page) {
            add_action('admin_notices', array($this, 'admin_notices'));
        }

        // On plugin pages, suppress ALL admin notices so they don't break the custom header layout
        if ($this->is_plugin_page) {
            // Remove all third-party and core notice hooks at the earliest opportunity
            add_action('in_admin_header', array($this, 'suppress_admin_notices'), PHP_INT_MAX);
        }
    }

    /**
     * Suppress all admin notices on plugin pages.
     * This runs at the end of `in_admin_header`, right before WordPress would render notices.
     * We remove all callbacks from the notice hooks so nothing renders in the default location.
     */
    public function suppress_admin_notices()
    {
        remove_all_actions('admin_notices');
        remove_all_actions('all_admin_notices');
        remove_all_actions('network_admin_notices');
        remove_all_actions('user_admin_notices');
    }

    /**
     * Add plugin action links
     */
    public function add_plugin_action_links($links)
    {
        $settings_link = '<a href="' . admin_url('admin.php?page=alt-text-pro-settings') . '">' . __('Settings', 'alt-text-pro') . '</a>';
        $dashboard_link = '<a href="' . admin_url('admin.php?page=alt-text-pro') . '">' . __('Dashboard', 'alt-text-pro') . '</a>';

        array_unshift($links, $settings_link, $dashboard_link);

        return $links;
    }

    /**
     * Admin notices
     */
    public function admin_notices()
    {
        $this->render_auto_generate_errors();

        if (!current_user_can('manage_options')) {
            return;
        }

        if (get_option('alt_text_pro_api_key_storage_error', false)) {
            $this->render_api_key_storage_notice();
            return;
        }

        $settings = get_option('alt_text_pro_settings', array());

        // Show notice if API key is not configured, until this user hides it.
        // The plugin's own pages keep their connect prompts either way.
        if (empty($settings['api_key']) && !get_user_meta(get_current_user_id(), self::KEY_NOTICE_HIDDEN_META, true)) {
            $hide_url = wp_nonce_url(
                admin_url('admin-post.php?action=alt_text_pro_hide_key_notice'),
                'alt_text_pro_hide_key_notice'
            );
            echo '<div class="notice notice-warning">';
            echo '<p><strong>' . esc_html__('Alt Text Pro:', 'alt-text-pro') . '</strong> ';
            echo wp_kses_post(
                sprintf(
                    // translators: %s: URL to the settings page
                    __('Please <a href="%1$s">configure your API key</a> to start generating alt-text for your images.', 'alt-text-pro'),
                    esc_url(admin_url('admin.php?page=alt-text-pro-settings'))
                )
            );
            echo ' <a href="' . esc_url($hide_url) . '">' . esc_html__("Don't show again", 'alt-text-pro') . '</a>';
            echo '</p></div>';
        }
    }

    /**
     * Render plugin-owned notices inside the custom plugin-page container.
     */
    public function plugin_notices()
    {
        $this->render_auto_generate_errors();

        if (!current_user_can('manage_options')) {
            return;
        }

        if (get_option('alt_text_pro_api_key_storage_error', false)) {
            $this->render_api_key_storage_notice();
            return;
        }

        $this->maybe_render_review_prompt();
    }

    /**
     * Ask for a WordPress.org review once the plugin has been useful on this
     * site. Shown only on plugin pages, never more than once per snooze.
     */
    private function maybe_render_review_prompt()
    {
        $state = get_user_meta(get_current_user_id(), self::REVIEW_PROMPT_META, true);
        if ($state === 'done' || (is_numeric($state) && (int) $state > time())) {
            return;
        }

        $generated = self::count_generated_descriptions();
        if ($generated < self::REVIEW_PROMPT_THRESHOLD) {
            return;
        }

        $action_url = function ($choice) {
            return wp_nonce_url(
                admin_url('admin-post.php?action=alt_text_pro_review_prompt&choice=' . $choice),
                'alt_text_pro_review_prompt'
            );
        };

        echo '<div class="notice notice-info alt-text-pro-review-prompt"><p>';
        echo '<strong>' . esc_html(sprintf(
            // translators: %s: number of alt text descriptions generated on this site.
            _n('Alt Text Pro has written %s alt text description on this site.', 'Alt Text Pro has written %s alt text descriptions on this site.', $generated, 'alt-text-pro'),
            number_format_i18n($generated)
        )) . '</strong> ';
        echo esc_html__('If it is saving you time, a short review on WordPress.org helps other site owners find it.', 'alt-text-pro');
        echo '</p><p class="alt-text-pro-review-actions">';
        echo '<a class="button-primary-custom atp-btn-sm" href="' . esc_url($action_url('review')) . '" target="_blank" rel="noopener noreferrer">' . esc_html__('Leave a review', 'alt-text-pro') . '</a>';
        echo '<a class="button-secondary-custom atp-btn-sm" href="' . esc_url($action_url('later')) . '">' . esc_html__('Maybe later', 'alt-text-pro') . '</a>';
        echo '<a class="atp-btn atp-btn-ghost atp-btn-sm" href="' . esc_url($action_url('dismiss')) . '">' . esc_html__("Don't ask again", 'alt-text-pro') . '</a>';
        echo '</p></div>';
    }

    /**
     * Number of saved generations on this site, cached for a few hours.
     */
    public static function count_generated_descriptions()
    {
        $cached = get_transient('alt_text_pro_generated_count');
        if ($cached !== false) {
            return (int) $cached;
        }

        global $wpdb;
        $logs_table = $wpdb->prefix . 'alt_text_pro_logs';
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name comes from $wpdb
        // Failed and skipped bulk images are logged too; they are not
        // descriptions.
        $generated_clause = class_exists('AltTextPro_Bulk_Processor') ? AltTextPro_Bulk_Processor::generated_logs_sql('') : '';
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- table name comes from $wpdb; the clause is fixed SQL
        $count = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$logs_table} WHERE 1=1{$generated_clause}");
        set_transient('alt_text_pro_generated_count', $count, 6 * HOUR_IN_SECONDS);

        return $count;
    }

    /**
     * Record the answer to the review request and continue.
     */
    /**
     * Hide the site-wide "configure your API key" notice for this user.
     */
    public function handle_hide_key_notice()
    {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have permission to perform this action.', 'alt-text-pro'), '', array('response' => 403));
        }

        check_admin_referer('alt_text_pro_hide_key_notice');
        update_user_meta(get_current_user_id(), self::KEY_NOTICE_HIDDEN_META, time());

        $back = wp_get_referer();
        wp_safe_redirect($back ? $back : admin_url('index.php'));
        exit;
    }

    public function handle_review_prompt()
    {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have permission to perform this action.', 'alt-text-pro'), '', array('response' => 403));
        }

        check_admin_referer('alt_text_pro_review_prompt');

        $choice = isset($_GET['choice']) ? sanitize_key(wp_unslash($_GET['choice'])) : '';
        $user_id = get_current_user_id();

        if ($choice === 'later') {
            update_user_meta($user_id, self::REVIEW_PROMPT_META, time() + self::REVIEW_PROMPT_SNOOZE);
        } elseif ($choice === 'review' || $choice === 'dismiss') {
            update_user_meta($user_id, self::REVIEW_PROMPT_META, 'done');
        }

        if ($choice === 'review') {
            // phpcs:ignore WordPress.Security.SafeRedirect.wp_redirect_wp_redirect -- fixed WordPress.org URL
            wp_redirect(self::REVIEW_URL);
            exit;
        }

        $back = wp_get_referer();
        wp_safe_redirect($back ? $back : admin_url('admin.php?page=alt-text-pro'));
        exit;
    }

    /**
     * Explain a fail-closed API-key storage problem without exposing the key.
     */
    private function render_api_key_storage_notice()
    {
        echo '<div class="notice notice-error"><p><strong>' . esc_html__('Alt Text Pro:', 'alt-text-pro') . '</strong> ';
        echo wp_kses_post(
            sprintf(
                // translators: %s: URL to the settings page.
                __('The saved API key could not be decrypted or securely migrated. <a href="%1$s">Reconnect or save a new API key</a> before generating alt text.', 'alt-text-pro'),
                esc_url(admin_url('admin.php?page=alt-text-pro-settings'))
            )
        );
        echo '</p></div>';
    }

    /**
     * Dashboard page
     */
    public function dashboard_page()
    {
        $api_client = new AltTextPro_API_Client();
        $usage_stats = null;
        $usage_error = '';

        // Get usage stats if API key is configured and valid
        $settings_handler = new AltTextPro_Settings();
        $settings = $settings_handler->get_settings();
        $has_valid_key = !empty($settings['api_key'])
            && AltTextPro_API_Client::validate_api_key_format($settings['api_key']);
        // Override settings api_key for template: empty string if invalid
        if (!$has_valid_key) {
            $settings['api_key'] = '';
        }

        // One usage request: it confirms the connection and returns the account
        // state. The template shows an error instead of guessing numbers.
        if ($has_valid_key) {
            $usage_response = $api_client->get_usage_stats();
            if (!empty($usage_response['success']) && is_array($usage_response['data'] ?? null)) {
                $usage_stats = $usage_response['data'];
            } else {
                $usage_error = isset($usage_response['message']) ? sanitize_text_field($usage_response['message']) : '';
            }
        }

        // Get local statistics
        global $wpdb;
        $logs_table = $wpdb->prefix . 'alt_text_pro_logs';

        // Failed and skipped bulk images are logged too; count generations.
        $generated_clause = AltTextPro_Bulk_Processor::generated_logs_sql('');
        // phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
        $total_generated = $wpdb->get_var("SELECT COUNT(*) FROM $logs_table WHERE 1=1{$generated_clause}");
        $site_month_prefix = current_time('Y-m') . '-%';
        $this_month_generated = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$logs_table} WHERE created_at LIKE %s{$generated_clause}",
            $site_month_prefix
        ));
        // phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
        $total_credits_used = $wpdb->get_var("SELECT SUM(credits_used) FROM $logs_table");
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $recent_clause = AltTextPro_Bulk_Processor::generated_logs_sql('l');
        $query = "SELECT l.*, p.post_title 
             FROM $logs_table l 
             LEFT JOIN {$wpdb->posts} p ON l.attachment_id = p.ID 
             WHERE 1=1{$recent_clause}
             ORDER BY l.created_at DESC 
             LIMIT 10";

        // phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared
        $recent_generations = $wpdb->get_results($query);

        // Get images without alt text (using a more reliable query). SVG and
        // other files the service cannot describe are not counted, nor are
        // images marked as decorative (empty alt on purpose).
        $supported_mime_clause = AltTextPro_API_Client::get_supported_mime_sql_clause('p');
        $not_decorative_clause = AltTextPro_Image_Details::get_not_decorative_sql_clause('p');
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- the mime and decorative clauses are prepared
        $images_without_alt = $wpdb->get_var(
            "SELECT COUNT(DISTINCT p.ID) 
             FROM {$wpdb->posts} p 
             WHERE p.post_type = 'attachment' 
             {$supported_mime_clause}
             {$not_decorative_clause}
             AND p.ID NOT IN (
                 SELECT DISTINCT pm.post_id 
                 FROM {$wpdb->postmeta} pm 
                 WHERE pm.meta_key = '_wp_attachment_image_alt' 
                 AND pm.meta_value IS NOT NULL 
                 AND pm.meta_value != ''
                 AND TRIM(pm.meta_value) != ''
             )"
        );

        include ALT_TEXT_PRO_PLUGIN_PATH . 'templates/dashboard.php';
    }

    /**
     * Bulk process page
     */
    public function bulk_process_page()
    {
        $credits_remaining = null;
        $billing_cycle = null;
        $monthly_credit_allowance = null;
        $monthly_credits_remaining = null;
        $monthly_credit_limit = null;

        // Count the same editable media set the processor uses (no SVG, no
        // decorative images, none waiting for review), scoped in SQL so
        // this page stays fast on large libraries.
        $image_counts = AltTextPro_Bulk_Processor::count_images();
        $total_without_alt = $image_counts['missing'];
        $total_images = $image_counts['all'];
        $run_credit_limit = null;

        $settings_handler = new AltTextPro_Settings();
        $settings = $settings_handler->get_settings();
        $has_valid_key = !empty($settings['api_key'])
            && AltTextPro_API_Client::validate_api_key_format($settings['api_key']);

        $usage_error = '';
        $usage_error_code = '';
        if ($has_valid_key) {
            $api_client = new AltTextPro_API_Client();
            $usage_response = $api_client->get_usage_stats();
            if (empty($usage_response['success'])) {
                $usage_error = isset($usage_response['message']) ? sanitize_text_field($usage_response['message']) : '';
                $usage_error_code = isset($usage_response['code']) ? sanitize_key((string) $usage_response['code']) : '';
            }
            if (!empty($usage_response['success'])) {
                $credits_remaining = isset($usage_response['data']['credits_remaining']) ? intval($usage_response['data']['credits_remaining']) : null;
                $billing_cycle = isset($usage_response['data']['billing_cycle']) ? sanitize_text_field($usage_response['data']['billing_cycle']) : null;
                $monthly_credit_allowance = isset($usage_response['data']['monthly_credit_allowance']) ? intval($usage_response['data']['monthly_credit_allowance']) : null;
                $monthly_credits_remaining = isset($usage_response['data']['monthly_credits_remaining']) ? intval($usage_response['data']['monthly_credits_remaining']) : null;
                $monthly_credit_limit = isset($usage_response['data']['monthly_credit_limit']) ? intval($usage_response['data']['monthly_credit_limit']) : null;
                // Credits one run may use: the run estimate compares with this.
                $run_credit_limit = AltTextPro_Bulk_Processor::get_run_credit_limits((array) $usage_response['data'])['run_limit'];
                // The run estimate's first preview reuses this balance.
                set_transient('alt_text_pro_bulk_credit_limit', array('limit' => $run_credit_limit), MINUTE_IN_SECONDS);
            }
        }

        // A run that is still going (this tab was closed or reloaded, or
        // another administrator started it).
        $active_run = AltTextPro_Bulk_Processor::get_active_run_for_page();

        // Finished runs with their failed and skipped images, and undo.
        $recent_runs = AltTextPro_Bulk_Processor::get_recent_runs_for_page();
        $pending_review = AltTextPro_Review::count_pending();
        $review_enabled = AltTextPro_Review::is_enabled();

        include ALT_TEXT_PRO_PLUGIN_PATH . 'templates/bulk-process.php';
    }

    /**
     * Settings page
     */
    public function settings_page()
    {
        $settings = wp_parse_args(get_option('alt_text_pro_settings', array()), AltTextPro_Settings::defaults());

        // Which Alt Text Pro account the saved key belongs to, or whether the
        // service rejected it (rotated key or deleted account).
        $account_email = '';
        $key_rejected = false;
        $usable_settings = (new AltTextPro_Settings())->get_settings();
        if (!empty($usable_settings['api_key']) && AltTextPro_API_Client::validate_api_key_format($usable_settings['api_key'])) {
            $usage_response = (new AltTextPro_API_Client())->get_usage_stats();
            if (!empty($usage_response['success']) && !empty($usage_response['data']['account_email'])) {
                $account_email = sanitize_email($usage_response['data']['account_email']);
            }
            $key_rejected = empty($usage_response['success'])
                && in_array($usage_response['code'] ?? '', array('invalid_api_key', 'account_not_found'), true);
        }

        include ALT_TEXT_PRO_PLUGIN_PATH . 'templates/settings.php';
    }

    /**
     * Logs page
     */
    public function logs_page()
    {
        global $wpdb;

        $logs_table = $wpdb->prefix . 'alt_text_pro_logs';
        $per_page = self::LOGS_PER_PAGE;
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        $current_page = max(1, intval($_GET['paged'] ?? 1));
        $offset = ($current_page - 1) * $per_page;

        // Search the whole history on the server (alt text and image title),
        // not only the rows on this page. Read-only, so no nonce.
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        $search = isset($_GET['s']) ? trim(sanitize_text_field(wp_unslash($_GET['s']))) : '';
        // Show one outcome only (generated, failed, skipped...). Read-only.
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        $outcome = isset($_GET['outcome']) ? sanitize_key(wp_unslash($_GET['outcome'])) : '';
        $outcome_labels = AltTextPro_Bulk_Processor::log_columns_ready() ? AltTextPro_Bulk_Processor::get_outcome_labels() : array();
        if (!array_key_exists($outcome, $outcome_labels)) {
            $outcome = '';
        }
        $where = 'WHERE 1=1';
        $where_args = array();
        if ($search !== '') {
            $like = '%' . $wpdb->esc_like($search) . '%';
            $where .= ' AND (l.alt_text LIKE %s OR p.post_title LIKE %s)';
            $where_args = array($like, $like);
        }
        $where .= AltTextPro_Bulk_Processor::outcome_filter_sql($outcome, 'l');

        // Get logs with pagination
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $query = "SELECT l.*, p.post_title, p.guid 
             FROM $logs_table l 
             LEFT JOIN {$wpdb->posts} p ON l.attachment_id = p.ID 
             {$where}
             ORDER BY l.created_at DESC, l.id DESC 
             LIMIT %d OFFSET %d";

        // phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared
        $logs = $wpdb->get_results($wpdb->prepare($query, array_merge($where_args, array($per_page, $offset))));

        // Get total count for pagination
        if (!empty($where_args)) {
            // phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
            $total_logs = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM $logs_table l LEFT JOIN {$wpdb->posts} p ON l.attachment_id = p.ID {$where}",
                $where_args
            ));
        } else {
            // phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared -- the outcome clause is prepared
            $total_logs = (int) $wpdb->get_var("SELECT COUNT(*) FROM $logs_table l {$where}");
        }
        $total_pages = ceil($total_logs / $per_page);

        $site_date_prefix = current_time('Y-m-d') . '%';
        $site_month_prefix = current_time('Y-m') . '-%';
        // Failed and skipped bulk images are listed too; they are not
        // generations.
        $generated_clause = AltTextPro_Bulk_Processor::generated_logs_sql('');

        // Get summary stats
        $stats = array(
            // phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
            'total_generated' => $wpdb->get_var("SELECT COUNT(*) FROM $logs_table WHERE 1=1{$generated_clause}"),
            // phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
            'total_credits_used' => $wpdb->get_var("SELECT SUM(credits_used) FROM $logs_table"),
            // phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
            'avg_processing_time' => $wpdb->get_var("SELECT AVG(processing_time) FROM $logs_table WHERE processing_time IS NOT NULL"),
            'today_generated' => $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$logs_table} WHERE created_at LIKE %s{$generated_clause}",
                $site_date_prefix
            )),
            'this_month_generated' => $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$logs_table} WHERE created_at LIKE %s{$generated_clause}",
                $site_month_prefix
            ))
        );

        include ALT_TEXT_PRO_PLUGIN_PATH . 'templates/logs.php';
    }

    /**
     * Add alt-text field to media attachment fields
     */
    public function add_alt_text_field($form_fields, $post)
    {
        if (!is_object($post) || !AltTextPro_API_Client::is_supported_image($post->ID) || !current_user_can('edit_post', $post->ID)) {
            return $form_fields;
        }

        // The full attachment edit screen shows the meta box instead.
        $screen = function_exists('get_current_screen') ? get_current_screen() : null;
        if ($screen && $screen->base === 'post' && $screen->post_type === 'attachment') {
            return $form_fields;
        }

        $alt_text = get_post_meta($post->ID, '_wp_attachment_image_alt', true);

        $form_fields['alt_text_pro_generate'] = array(
            'label' => __('Alt Text Pro', 'alt-text-pro'),
            'input' => 'html',
            'html' => $this->get_media_field_html($post->ID, $alt_text)
        );

        return $form_fields;
    }

    /**
     * Save alt-text field
     */
    public function save_alt_text_field($post, $attachment)
    {
        if (isset($attachment['alt_text_pro_context']) && !empty($post['ID']) && current_user_can('edit_post', $post['ID'])) {
            update_post_meta($post['ID'], '_alt_text_pro_context', sanitize_text_field($attachment['alt_text_pro_context']));
        }

        return $post;
    }

    /**
     * Get media field HTML
     */
    private function get_media_field_html($attachment_id, $current_alt_text)
    {
        $settings = get_option('alt_text_pro_settings', array());
        $api_configured = !empty($settings['api_key']);

        ob_start();
        ?>
        <div class="alt-text-pro-media-field atp-ui">
            <?php if ($api_configured): ?>
                <div class="alt-text-pro-current">
                    <strong><?php esc_html_e('Current Alt-Text:', 'alt-text-pro'); ?></strong>
                    <p class="current-alt-text">
                        <?php echo esc_html($current_alt_text ?: esc_html__('No alt-text set', 'alt-text-pro')); ?>
                    </p>
                </div>

                <?php
                // Show context field if setting is enabled
                $show_context = !empty($settings['show_context_field']);
                ?>
                <div class="alt-text-pro-context"<?php echo $show_context ? '' : ' style="display: none;"'; ?>>
                    <label for="alt_text_pro_context_<?php echo esc_attr($attachment_id); ?>">
                        <?php esc_html_e('Image Context (optional):', 'alt-text-pro'); ?>
                    </label>
                    <input type="text" id="alt_text_pro_context_<?php echo esc_attr($attachment_id); ?>"
                        name="attachments[<?php echo esc_attr($attachment_id); ?>][alt_text_pro_context]"
                        value="<?php echo esc_attr((string) get_post_meta($attachment_id, '_alt_text_pro_context', true)); ?>"
                        placeholder="<?php esc_attr_e('e.g., product photo, team meeting, etc.', 'alt-text-pro'); ?>">
                    <p class="description">
                        <?php esc_html_e('Add specific context to make the generated draft more relevant to this page.', 'alt-text-pro'); ?>
                    </p>
                </div>

                <button type="button" class="button button-primary-custom atp-btn-sm atp-btn-block alt-text-pro-generate-btn"
                    data-attachment-id="<?php echo esc_attr($attachment_id); ?>">
                    <span class="dashicons dashicons-images-alt2" aria-hidden="true"></span>
                    <span><?php esc_html_e('Generate Alt-Text', 'alt-text-pro'); ?></span>
                </button>
                <p class="description atp-credit-note">
                    <?php esc_html_e('Uses 1 credit, even if you do not apply the draft.', 'alt-text-pro'); ?>
                </p>

                <div class="alt-text-pro-result" style="display: none !important;">
                    <div class="alt-text-pro-loading" style="display: none !important;">
                        <span class="spinner is-active"></span>
                        <?php esc_html_e('Generating alt-text...', 'alt-text-pro'); ?>
                    </div>
                    <div class="alt-text-pro-success" style="display: none !important;">
                        <p class="generated-alt-text"></p>
                        <p class="description"><?php esc_html_e('Review this draft, then apply it. The credit is already used, but the image keeps its current alt text until you apply the draft and save.', 'alt-text-pro'); ?></p>
                        <p class="description credits-remaining" style="display: none;"></p>
                        <button type="button" class="button button-secondary-custom atp-btn-sm atp-btn-block alt-text-pro-apply-btn">
                            <span class="dashicons dashicons-yes" aria-hidden="true"></span>
                            <span><?php esc_html_e('Apply Alt-Text', 'alt-text-pro'); ?></span>
                        </button>
                    </div>
                    <div class="alt-text-pro-error" role="alert" style="display: none !important;"></div>
                </div>
            <?php else: ?>
                <div class="alt-text-pro-notice">
                    <p><?php esc_html_e('API key not configured.', 'alt-text-pro'); ?></p>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-pro-settings')); ?>" class="button button-secondary-custom atp-btn-sm atp-btn-block">
                        <span class="dashicons dashicons-admin-network" aria-hidden="true"></span>
                        <span><?php esc_html_e('Configure Settings', 'alt-text-pro'); ?></span>
                    </a>
                </div>
            <?php endif; ?>
        </div>
        <?php
        return ob_get_clean();
    }

    /**
     * Add meta boxes for media edit screen
     */
    public function add_media_meta_boxes()
    {
        add_meta_box(
            'alt-text-pro-meta-box',
            esc_html__('Alt Text Pro', 'alt-text-pro'),
            array($this, 'media_meta_box_callback'),
            'attachment',
            'side',
            'high'
        );
    }

    /**
     * Media meta box callback
     */
    public function media_meta_box_callback($post)
    {
        if (!current_user_can('edit_post', $post->ID)) {
            echo '<p>' . esc_html__('You do not have permission to edit this image.', 'alt-text-pro') . '</p>';
            return;
        }

        if (!AltTextPro_API_Client::is_supported_image($post->ID)) {
            echo '<p>' . esc_html__('Alt Text Pro can only describe photos and other raster images. SVG and other file types are not supported.', 'alt-text-pro') . '</p>';
            return;
        }

        $alt_text = get_post_meta($post->ID, '_wp_attachment_image_alt', true);
        // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- get_media_field_html() returns properly escaped HTML and wp_kses_post strips input tags
        echo $this->get_media_field_html($post->ID, $alt_text);
    }
}
