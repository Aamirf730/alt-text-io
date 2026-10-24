<?php
/**
 * Logs Template for Alt-Text AI
 */

if (!defined('ABSPATH')) {
    exit;
}

// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Only used for active menu highlighting
$alt_text_pro_current_page = isset($_GET['page']) ? sanitize_text_field(wp_unslash($_GET['page'])) : '';
?>

<div class="wrap alt-text-pro-logs">
    <!-- Notices Container -->
    <div class="alt-text-pro-notices-container">
        <?php do_action('alt_text_pro_render_notices'); ?>
    </div>

    <!-- Header & Navigation -->
    <div class="alt-text-pro-header">
        <div class="alt-text-pro-logo">
            <img src="<?php echo esc_url(ALT_TEXT_PRO_PLUGIN_URL . 'assets/images/logo-alt-text-pro.png'); ?>"
                alt="Alt Text Pro" />
            <div>
                <h1><?php esc_html_e('Alt Text Pro', 'alt-text-pro'); ?></h1>
                <span
                    style="color: var(--text-secondary); font-size: 13px;">v<?php echo esc_html(ALT_TEXT_PRO_VERSION); ?></span>
            </div>
        </div>
        <div class="alt-text-pro-nav">
            <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-pro')); ?>"
                class="alt-text-pro-nav-item <?php echo esc_attr($alt_text_pro_current_page === 'alt-text-pro' ? 'active' : ''); ?>">
                <span class="dashicons dashicons-dashboard"></span>
                <?php esc_html_e('Dashboard', 'alt-text-pro'); ?>
            </a>
            <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-pro-bulk')); ?>"
                class="alt-text-pro-nav-item <?php echo esc_attr($alt_text_pro_current_page === 'alt-text-pro-bulk' ? 'active' : ''); ?>">
                <span class="dashicons dashicons-images-alt2"></span>
                <?php esc_html_e('Bulk Process', 'alt-text-pro'); ?>
            </a>
            <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-pro-logs')); ?>"
                class="alt-text-pro-nav-item <?php echo esc_attr($alt_text_pro_current_page === 'alt-text-pro-logs' ? 'active' : ''); ?>">
                <span class="dashicons dashicons-list-view"></span>
                <?php esc_html_e('Logs', 'alt-text-pro'); ?>
            </a>
            <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-pro-settings')); ?>"
                class="alt-text-pro-nav-item <?php echo esc_attr($alt_text_pro_current_page === 'alt-text-pro-settings' ? 'active' : ''); ?>">
                <span class="dashicons dashicons-admin-settings"></span>
                <?php esc_html_e('Settings', 'alt-text-pro'); ?>
            </a>
        </div>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-header">
                <span class="stat-title"><?php esc_html_e('Total Generated', 'alt-text-pro'); ?></span>
                <div class="stat-icon"><span class="dashicons dashicons-format-image"></span></div>
            </div>
            <div class="stat-value"><?php echo esc_html(number_format((int) $stats['total_generated'])); ?></div>
        </div>

        <div class="stat-card">
            <div class="stat-header">
                <span class="stat-title"><?php esc_html_e('Credits Used', 'alt-text-pro'); ?></span>
                <div class="stat-icon"><span class="dashicons dashicons-chart-area"></span></div>
            </div>
            <div class="stat-value"><?php echo esc_html(number_format((int) $stats['total_credits_used'])); ?></div>
        </div>

        <div class="stat-card">
            <div class="stat-header">
                <span class="stat-title"><?php esc_html_e('Today', 'alt-text-pro'); ?></span>
                <div class="stat-icon"><span class="dashicons dashicons-calendar-alt"></span></div>
            </div>
            <div class="stat-value"><?php echo esc_html(number_format((int) $stats['today_generated'])); ?></div>
        </div>

        <div class="stat-card">
            <div class="stat-header">
                <span class="stat-title"><?php esc_html_e('This Month', 'alt-text-pro'); ?></span>
                <div class="stat-icon"><span class="dashicons dashicons-calendar"></span></div>
            </div>
            <div class="stat-value"><?php echo esc_html(number_format((int) $stats['this_month_generated'])); ?></div>
        </div>
    </div>

    <div class="alt-text-pro-card">
        <div class="card-header">
            <h3><?php esc_html_e('Generation History', 'alt-text-pro'); ?></h3>
            <div style="display: flex; gap: 12px; align-items: center;">
                <input type="text" id="search-logs" placeholder="<?php esc_attr_e('Search...', 'alt-text-pro'); ?>"
                    style="padding: 6px 12px; border-radius: 4px; border: 1px solid #ddd;">
                <a href="<?php echo esc_url(wp_nonce_url(admin_url('admin-post.php?action=alt_text_pro_export_logs'), 'alt_text_pro_export_logs')); ?>"
                    class="button-secondary-custom" id="export-logs"
                    title="<?php esc_attr_e('Download the generation history as CSV. When you search, only matching entries are exported.', 'alt-text-pro'); ?>"
                    style="padding: 6px 12px !important; font-size: 12px !important;">
                    <span class="dashicons dashicons-download"></span>
                    <?php esc_html_e('Export CSV', 'alt-text-pro'); ?>
                </a>
            </div>
        </div>

        <?php if (!empty($logs)): ?>
            <div class="logs-table-wrapper">
                <table class="wp-list-table widefat fixed striped logs-table">
                    <thead>
                        <tr>
                            <th style="width: 80px;"><?php esc_html_e('Image', 'alt-text-pro'); ?></th>
                            <th><?php esc_html_e('Details', 'alt-text-pro'); ?></th>
                            <th><?php esc_html_e('Alt Text', 'alt-text-pro'); ?></th>
                            <th style="width: 100px;"><?php esc_html_e('Credits', 'alt-text-pro'); ?></th>
                            <th style="width: 150px;"><?php esc_html_e('Date', 'alt-text-pro'); ?></th>
                            <th style="width: 120px;"><?php esc_html_e('Actions', 'alt-text-pro'); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($logs as $alt_text_pro_log): ?>
                            <tr class="log-row" data-alt-text="<?php echo esc_attr(strtolower($alt_text_pro_log->alt_text)); ?>"
                                data-date="<?php echo esc_attr($alt_text_pro_log->created_at); ?>">
                                <td>
                                    <?php
                                    $alt_text_pro_image_url = wp_get_attachment_image_url($alt_text_pro_log->attachment_id, 'thumbnail');
                                    if ($alt_text_pro_image_url): ?>
                                        <img src="<?php echo esc_url($alt_text_pro_image_url); ?>" class="image-preview-small">
                                    <?php else: ?>
                                        <div class="image-preview-small"
                                            style="display: flex; align-items: center; justify-content: center;">
                                            <span class="dashicons dashicons-format-image" style="color: #ccc;"></span>
                                        </div>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <strong
                                        style="display: block; margin-bottom: 4px;"><?php echo esc_html($alt_text_pro_log->post_title ?: esc_html__('Image', 'alt-text-pro')); ?></strong>
                                    <span style="color: var(--text-secondary); font-size: 12px;">ID:
                                        <?php echo esc_html($alt_text_pro_log->attachment_id); ?></span>
                                </td>
                                <td>
                                    <p style="margin: 0 0 8px 0; font-style: italic; color: var(--text-secondary);">
                                        <?php echo esc_html($alt_text_pro_log->alt_text); ?></p>
                                    <button type="button" class="button-link copy-alt-text"
                                        data-alt-text="<?php echo esc_attr($alt_text_pro_log->alt_text); ?>"
                                        style="text-decoration: none; font-size: 12px;">
                                        <span class="dashicons dashicons-admin-page" style="font-size: 14px;"></span>
                                        <?php esc_html_e('Copy', 'alt-text-pro'); ?>
                                    </button>
                                </td>
                                <td>
                                    <span
                                        class="status-badge warning"><?php echo esc_html($alt_text_pro_log->credits_used); ?></span>
                                </td>
                                <td>
                                    <span
                                        style="display: block; font-weight: 500;"><?php echo esc_html(date_i18n(get_option('date_format'), strtotime($alt_text_pro_log->created_at))); ?></span>
                                    <span
                                        style="font-size: 12px; color: var(--text-secondary);"><?php echo esc_html(human_time_diff(strtotime($alt_text_pro_log->created_at), current_time('timestamp'))); ?>
                                        <?php esc_html_e('ago', 'alt-text-pro'); ?></span>
                                </td>
                                <td>
                                    <div style="display: flex; gap: 8px;">
                                        <a href="<?php echo esc_url(admin_url('post.php?post=' . $alt_text_pro_log->attachment_id . '&action=edit')); ?>"
                                            class="button-secondary-custom"
                                            style="padding: 4px 8px !important; font-size: 12px !important;"
                                            title="<?php esc_attr_e('Edit Image', 'alt-text-pro'); ?>">
                                            <span class="dashicons dashicons-edit"></span>
                                        </a>
                                    </div>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>

            <!-- Pagination -->
            <?php if ($total_pages > 1): ?>
                <div
                    style="padding: 20px; background: var(--bg-light); border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                    <div style="color: var(--text-secondary); font-size: 13px;">
                        <?php
                        // translators: %1$d: Current page number, %2$d: Total number of pages
                        printf(esc_html__('Page %1$d of %2$d', 'alt-text-pro'), esc_html($current_page), esc_html($total_pages)); ?>
                    </div>
                    <div style="display: flex; gap: 4px;">
                        <?php
                        $alt_text_pro_base_url = admin_url('admin.php?page=alt-text-pro-logs');
                        if ($current_page > 1) {
                            echo '<a href="' . esc_url($alt_text_pro_base_url . '&paged=' . ($current_page - 1)) . '" class="button-secondary-custom" style="padding: 6px 12px !important;">&laquo; ' . esc_html__('Prev', 'alt-text-pro') . '</a>';
                        }
                        if ($current_page < $total_pages) {
                            echo '<a href="' . esc_url($alt_text_pro_base_url . '&paged=' . ($current_page + 1)) . '" class="button-secondary-custom" style="padding: 6px 12px !important;">' . esc_html__('Next', 'alt-text-pro') . ' &raquo;</a>';
                        }
                        ?>
                    </div>
                </div>
            <?php endif; ?>

        <?php else: ?>
            <div style="padding: 60px 20px; text-align: center;">
                <div
                    style="width: 60px; height: 60px; background: var(--bg-light); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                    <span class="dashicons dashicons-list-view"
                        style="font-size: 30px; color: var(--text-secondary);"></span>
                </div>
                <h3 style="margin-bottom: 10px;"><?php esc_html_e('No logs found', 'alt-text-pro'); ?></h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">
                    <?php esc_html_e('Start generating alt-text to see history here.', 'alt-text-pro'); ?></p>
                <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-pro-bulk')); ?>"
                    class="button-primary-custom">
                    <?php esc_html_e('Start Generating', 'alt-text-pro'); ?>
                </a>
            </div>
        <?php endif; ?>
    </div>
</div>
