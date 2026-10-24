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
        // Removed attachment_fields_to_edit filter - using meta box instead to avoid duplication
        add_action('add_meta_boxes', array($this, 'add_media_meta_boxes'));
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
            'dashicons-format-image',
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
        if (!current_user_can('manage_options')) {
            return;
        }

        if (get_option('alt_text_pro_api_key_storage_error', false)) {
            $this->render_api_key_storage_notice();
            return;
        }

        $settings = get_option('alt_text_pro_settings', array());

        // Show notice if API key is not configured
        if (empty($settings['api_key'])) {
            echo '<div class="notice notice-warning is-dismissible">';
            echo '<p><strong>' . esc_html__('Alt Text Pro:', 'alt-text-pro') . '</strong> ';
            echo wp_kses_post(
                sprintf(
                    // translators: %s: URL to the settings page
                    __('Please <a href="%1$s">configure your API key</a> to start generating alt-text for your images.', 'alt-text-pro'),
                    esc_url(admin_url('admin.php?page=alt-text-pro-settings'))
                )
            );
            echo '</p></div>';
        }
    }

    /**
     * Render plugin-owned notices inside the custom plugin-page container.
     */
    public function plugin_notices()
    {
        if (!current_user_can('manage_options')) {
            return;
        }

        if (get_option('alt_text_pro_api_key_storage_error', false)) {
            $this->render_api_key_storage_notice();
        }
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

        // phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
        $total_generated = $wpdb->get_var("SELECT COUNT(*) FROM $logs_table");
        $site_month_prefix = current_time('Y-m') . '-%';
        $this_month_generated = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$logs_table} WHERE created_at LIKE %s",
            $site_month_prefix
        ));
        // phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
        $total_credits_used = $wpdb->get_var("SELECT SUM(credits_used) FROM $logs_table");
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $query = "SELECT l.*, p.post_title 
             FROM $logs_table l 
             LEFT JOIN {$wpdb->posts} p ON l.attachment_id = p.ID 
             ORDER BY l.created_at DESC 
             LIMIT 10";

        // phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared
        $recent_generations = $wpdb->get_results($query);

        // Get images without alt text (using a more reliable query)
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $images_without_alt = $wpdb->get_var(
            "SELECT COUNT(DISTINCT p.ID) 
             FROM {$wpdb->posts} p 
             WHERE p.post_type = 'attachment' 
             AND p.post_mime_type LIKE 'image/%'
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
        global $wpdb;
        $credits_remaining = null;
        $billing_cycle = null;
        $monthly_credit_allowance = null;
        $monthly_credits_remaining = null;
        $monthly_credit_limit = null;

        // Count the same editable media set the processor uses. Scoping in SQL
        // keeps this page fast on large libraries; a single run takes the
        // newest images up to the processor's queue cap.
        $editable_clause = AltTextPro_Bulk_Processor::get_editable_media_sql_clause('p');
        $missing_alt_sql = "FROM {$wpdb->posts} p
             LEFT JOIN {$wpdb->postmeta} pm ON (
                 p.ID = pm.post_id
                 AND pm.meta_key = '_wp_attachment_image_alt'
                 AND pm.meta_value IS NOT NULL
                 AND pm.meta_value != ''
                 AND TRIM(pm.meta_value) != ''
             )
             WHERE p.post_type = 'attachment'
             AND p.post_mime_type LIKE 'image/%'
             AND pm.post_id IS NULL
             {$editable_clause}";

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared -- the only variable fragment is prepared above
        $total_without_alt = (int) $wpdb->get_var("SELECT COUNT(*) {$missing_alt_sql}");

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared
        $images_without_alt = $wpdb->get_results(
            "SELECT p.ID, p.post_title, p.post_date {$missing_alt_sql}
             ORDER BY p.post_date DESC
             LIMIT 100"
        );

        // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared
        $total_images = (int) $wpdb->get_var(
            "SELECT COUNT(*)
             FROM {$wpdb->posts} p
             WHERE p.post_type = 'attachment'
             AND p.post_mime_type LIKE 'image/%'
             {$editable_clause}"
        );

        $settings_handler = new AltTextPro_Settings();
        $settings = $settings_handler->get_settings();
        $has_valid_key = !empty($settings['api_key'])
            && AltTextPro_API_Client::validate_api_key_format($settings['api_key']);

        if ($has_valid_key) {
            $api_client = new AltTextPro_API_Client();
            $usage_response = $api_client->get_usage_stats();
            if (!empty($usage_response['success'])) {
                $credits_remaining = isset($usage_response['data']['credits_remaining']) ? intval($usage_response['data']['credits_remaining']) : null;
                $billing_cycle = isset($usage_response['data']['billing_cycle']) ? sanitize_text_field($usage_response['data']['billing_cycle']) : null;
                $monthly_credit_allowance = isset($usage_response['data']['monthly_credit_allowance']) ? intval($usage_response['data']['monthly_credit_allowance']) : null;
                $monthly_credits_remaining = isset($usage_response['data']['monthly_credits_remaining']) ? intval($usage_response['data']['monthly_credits_remaining']) : null;
                $monthly_credit_limit = isset($usage_response['data']['monthly_credit_limit']) ? intval($usage_response['data']['monthly_credit_limit']) : null;
            }
        }

        include ALT_TEXT_PRO_PLUGIN_PATH . 'templates/bulk-process.php';
    }

    /**
     * Settings page
     */
    public function settings_page()
    {
        $settings = wp_parse_args(get_option('alt_text_pro_settings', array()), array(
            'api_key' => '',
            'auto_generate' => false,
            'overwrite_existing' => false,
            'context_enabled' => true,
            'blog_context' => '',
            'show_context_field' => false,
            'batch_size' => 1
        ));

        include ALT_TEXT_PRO_PLUGIN_PATH . 'templates/settings.php';
    }

    /**
     * Logs page
     */
    public function logs_page()
    {
        global $wpdb;

        $logs_table = $wpdb->prefix . 'alt_text_pro_logs';
        $per_page = 20;
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        $current_page = max(1, intval($_GET['paged'] ?? 1));
        $offset = ($current_page - 1) * $per_page;

        // Get logs with pagination
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $query = "SELECT l.*, p.post_title, p.guid 
             FROM $logs_table l 
             LEFT JOIN {$wpdb->posts} p ON l.attachment_id = p.ID 
             ORDER BY l.created_at DESC 
             LIMIT %d OFFSET %d";

        // phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared
        $logs = $wpdb->get_results($wpdb->prepare($query, $per_page, $offset));

        // Get total count for pagination
        // phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
        $total_logs = $wpdb->get_var("SELECT COUNT(*) FROM $logs_table");
        $total_pages = ceil($total_logs / $per_page);

        $site_date_prefix = current_time('Y-m-d') . '%';
        $site_month_prefix = current_time('Y-m') . '-%';

        // Get summary stats
        $stats = array(
            // phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
            'total_generated' => $wpdb->get_var("SELECT COUNT(*) FROM $logs_table"),
            // phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
            'total_credits_used' => $wpdb->get_var("SELECT SUM(credits_used) FROM $logs_table"),
            // phpcs:ignore PluginCheck.Security.DirectDB.UnescapedDBParameter, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
            'avg_processing_time' => $wpdb->get_var("SELECT AVG(processing_time) FROM $logs_table WHERE processing_time IS NOT NULL"),
            'today_generated' => $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$logs_table} WHERE created_at LIKE %s",
                $site_date_prefix
            )),
            'this_month_generated' => $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$logs_table} WHERE created_at LIKE %s",
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
        if (strpos((string) $post->post_mime_type, 'image/') !== 0) {
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
        if (isset($attachment['alt_text_pro_context'])) {
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
        <div class="alt-text-pro-media-field">
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
                <div class="alt-text-pro-context" style="margin: 10px 0;<?php echo $show_context ? '' : ' display: none;'; ?>">
                    <label for="alt_text_pro_context_<?php echo esc_attr($attachment_id); ?>">
                        <?php esc_html_e('Image Context (optional):', 'alt-text-pro'); ?>
                    </label>
                    <input type="text" id="alt_text_pro_context_<?php echo esc_attr($attachment_id); ?>"
                        name="attachments[<?php echo esc_attr($attachment_id); ?>][alt_text_pro_context]"
                        placeholder="<?php esc_attr_e('e.g., product photo, team meeting, etc.', 'alt-text-pro'); ?>"
                        style="width: 100%; margin-top: 5px;">
                    <p class="description" style="font-size: 11px; margin-top: 4px;">
                        <?php esc_html_e('Add specific context to make the generated draft more relevant to this page.', 'alt-text-pro'); ?>
                    </p>
                </div>

                <button type="button" class="button button-primary alt-text-pro-generate-btn"
                    data-attachment-id="<?php echo esc_attr($attachment_id); ?>">
                    <span style="font-weight: 600; margin-right: 4px;">AI</span>
                    <?php esc_html_e('Generate Alt-Text', 'alt-text-pro'); ?>
                </button>

                <div class="alt-text-pro-result" style="margin-top: 10px; display: none !important;">
                    <div class="alt-text-pro-loading" style="display: none !important;">
                        <span class="spinner is-active"></span>
                        <?php esc_html_e('Generating alt-text...', 'alt-text-pro'); ?>
                    </div>
                    <div class="alt-text-pro-success" style="display: none !important;">
                        <p class="generated-alt-text"></p>
                        <p class="description"><?php esc_html_e('Review this draft before applying it to the WordPress alt-text field.', 'alt-text-pro'); ?></p>
                        <button type="button" class="button alt-text-pro-apply-btn">
                            <?php esc_html_e('Apply Alt-Text', 'alt-text-pro'); ?>
                        </button>
                    </div>
                    <div class="alt-text-pro-error" style="display: none !important; color: #d63638;"></div>
                </div>
            <?php else: ?>
                <div class="alt-text-pro-notice">
                    <p><?php esc_html_e('API key not configured.', 'alt-text-pro'); ?></p>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-pro-settings')); ?>" class="button">
                        <?php esc_html_e('Configure Settings', 'alt-text-pro'); ?>
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

        if (strpos((string) $post->post_mime_type, 'image/') !== 0) {
            echo '<p>' . esc_html__('Alt-text generation is only available for images.', 'alt-text-pro') . '</p>';
            return;
        }

        $alt_text = get_post_meta($post->ID, '_wp_attachment_image_alt', true);
        // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- get_media_field_html() returns properly escaped HTML and wp_kses_post strips input tags
        echo $this->get_media_field_html($post->ID, $alt_text);
    }
}
