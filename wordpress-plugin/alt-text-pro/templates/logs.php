<?php
/**
 * Logs Template for Alt-Text AI
 */

if (!defined('ABSPATH')) {
    exit;
}

?>

<div class="wrap alt-text-pro-logs atp-ui">
    <?php require ALT_TEXT_PRO_PLUGIN_PATH . 'templates/partials/header.php'; ?>

    <!-- Stats Grid -->
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-header">
                <span class="stat-title"><?php esc_html_e('Total Generated', 'alt-text-pro'); ?></span>
                <span class="stat-icon" aria-hidden="true"><span class="dashicons dashicons-format-image"></span></span>
            </div>
            <div class="stat-value"><?php echo esc_html(number_format((int) $stats['total_generated'])); ?></div>
        </div>

        <div class="stat-card">
            <div class="stat-header">
                <span class="stat-title"><?php esc_html_e('Credits Used', 'alt-text-pro'); ?></span>
                <span class="stat-icon" aria-hidden="true"><span class="dashicons dashicons-chart-area"></span></span>
            </div>
            <div class="stat-value"><?php echo esc_html(number_format((int) $stats['total_credits_used'])); ?></div>
        </div>

        <div class="stat-card">
            <div class="stat-header">
                <span class="stat-title"><?php esc_html_e('Today', 'alt-text-pro'); ?></span>
                <span class="stat-icon" aria-hidden="true"><span class="dashicons dashicons-calendar-alt"></span></span>
            </div>
            <div class="stat-value"><?php echo esc_html(number_format((int) $stats['today_generated'])); ?></div>
        </div>

        <div class="stat-card">
            <div class="stat-header">
                <span class="stat-title"><?php esc_html_e('This Month', 'alt-text-pro'); ?></span>
                <span class="stat-icon" aria-hidden="true"><span class="dashicons dashicons-calendar"></span></span>
            </div>
            <div class="stat-value"><?php echo esc_html(number_format((int) $stats['this_month_generated'])); ?></div>
        </div>
    </div>

    <div class="alt-text-pro-card">
        <div class="card-header">
            <h3><?php esc_html_e('Generation History', 'alt-text-pro'); ?></h3>
            <div class="atp-actions">
                <!-- Searches the whole history on the server. -->
                <form method="get" action="<?php echo esc_url(admin_url('admin.php')); ?>" class="atp-actions" role="search">
                    <input type="hidden" name="page" value="alt-text-pro-logs">
                    <label class="screen-reader-text" for="search-logs"><?php esc_html_e('Search alt text', 'alt-text-pro'); ?></label>
                    <input type="search" id="search-logs" name="s" class="atp-input-sm" value="<?php echo esc_attr($search); ?>" placeholder="<?php esc_attr_e('Search alt text or image...', 'alt-text-pro'); ?>">
                    <?php if (!empty($outcome_labels)): ?>
                        <label class="screen-reader-text" for="logs-outcome"><?php esc_html_e('Result', 'alt-text-pro'); ?></label>
                        <select id="logs-outcome" name="outcome">
                            <option value=""><?php esc_html_e('All results', 'alt-text-pro'); ?></option>
                            <?php foreach ($outcome_labels as $alt_text_pro_outcome_key => $alt_text_pro_outcome_label): ?>
                                <option value="<?php echo esc_attr($alt_text_pro_outcome_key); ?>" <?php selected($outcome, $alt_text_pro_outcome_key); ?>><?php echo esc_html($alt_text_pro_outcome_label); ?></option>
                            <?php endforeach; ?>
                        </select>
                    <?php endif; ?>
                    <button type="submit" class="button-secondary-custom atp-btn-sm">
                        <span class="dashicons dashicons-search" aria-hidden="true"></span>
                        <span><?php esc_html_e('Search', 'alt-text-pro'); ?></span>
                    </button>
                    <?php if ($search !== '' || $outcome !== ''): ?>
                        <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-pro-logs')); ?>" class="atp-btn atp-btn-ghost atp-btn-sm"><?php esc_html_e('Clear', 'alt-text-pro'); ?></a>
                    <?php endif; ?>
                </form>
                <a href="<?php echo esc_url(wp_nonce_url(add_query_arg(array_filter(array('s' => $search !== '' ? rawurlencode($search) : '', 'outcome' => $outcome)), admin_url('admin-post.php?action=alt_text_pro_export_logs')), 'alt_text_pro_export_logs')); ?>"
                    class="button-secondary-custom atp-btn-sm" id="export-logs"
                    title="<?php esc_attr_e('Download the generation history as CSV. When you search, only matching entries are exported.', 'alt-text-pro'); ?>">
                    <span class="dashicons dashicons-download" aria-hidden="true"></span>
                    <span><?php esc_html_e('Export CSV', 'alt-text-pro'); ?></span>
                </a>
            </div>
        </div>

        <?php if (!empty($logs)): ?>
            <div class="logs-table-wrapper">
                <table class="widefat striped logs-table">
                    <thead>
                        <tr>
                            <th class="col-image"><?php esc_html_e('Image', 'alt-text-pro'); ?></th>
                            <th><?php esc_html_e('Details', 'alt-text-pro'); ?></th>
                            <th><?php esc_html_e('Alt Text', 'alt-text-pro'); ?></th>
                            <th class="col-credits"><?php esc_html_e('Credits', 'alt-text-pro'); ?></th>
                            <th class="col-date"><?php esc_html_e('Date', 'alt-text-pro'); ?></th>
                            <th class="col-actions"><?php esc_html_e('Actions', 'alt-text-pro'); ?></th>
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
                                        <img src="<?php echo esc_url($alt_text_pro_image_url); ?>" class="image-preview-small" alt="">
                                    <?php else: ?>
                                        <div class="image-preview-small">
                                            <span class="dashicons dashicons-format-image" aria-hidden="true"></span>
                                        </div>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <strong class="atp-log-title"><?php echo esc_html($alt_text_pro_log->post_title ?: esc_html__('Image', 'alt-text-pro')); ?></strong>
                                    <span class="atp-log-meta">ID:
                                        <?php echo esc_html($alt_text_pro_log->attachment_id); ?></span>
                                </td>
                                <td>
                                    <?php
                                    // Bulk-run result: failed and skipped images (with why),
                                    // suggestions waiting for review, undone or rejected.
                                    $alt_text_pro_outcome = (string) ($alt_text_pro_log->outcome ?? 'generated');
                                    if ($alt_text_pro_outcome !== 'generated' && isset($outcome_labels[$alt_text_pro_outcome])): ?>
                                        <p class="atp-log-status-row">
                                            <span class="atp-badge atp-outcome is-<?php echo esc_attr($alt_text_pro_outcome); ?>"><?php echo esc_html($outcome_labels[$alt_text_pro_outcome]); ?></span>
                                            <?php if ((string) ($alt_text_pro_log->outcome_reason ?? '') !== ''): ?>
                                                <span class="atp-log-meta"><?php echo esc_html($alt_text_pro_log->outcome_reason); ?></span>
                                            <?php endif; ?>
                                        </p>
                                    <?php endif; ?>
                                    <p class="atp-log-alt">
                                        <?php echo esc_html($alt_text_pro_log->alt_text); ?></p>
                                    <?php
                                    // Whether the text reached the image; rows logged before
                                    // 1.7.28 did not record it and show no status.
                                    $alt_text_pro_status = AltTextPro_Generation_Log::get_status_display($alt_text_pro_log->status ?? '');
                                    if ($alt_text_pro_status): ?>
                                        <p class="atp-log-status-row">
                                            <span class="atp-badge atp-log-status is-<?php echo esc_attr($alt_text_pro_status['class']); ?>"><?php echo esc_html($alt_text_pro_status['label']); ?></span>
                                            <?php if ($alt_text_pro_status['description'] !== ''): ?>
                                                <span class="atp-log-meta"><?php echo esc_html($alt_text_pro_status['description']); ?></span>
                                            <?php endif; ?>
                                        </p>
                                    <?php endif; ?>
                                    <button type="button" class="button-secondary-custom atp-btn-sm copy-alt-text"
                                        data-alt-text="<?php echo esc_attr($alt_text_pro_log->alt_text); ?>">
                                        <span class="dashicons dashicons-admin-page" aria-hidden="true"></span>
                                        <span class="atp-copy-label"><?php esc_html_e('Copy', 'alt-text-pro'); ?></span>
                                    </button>
                                </td>
                                <td>
                                    <span class="atp-badge"><?php echo esc_html($alt_text_pro_log->credits_used); ?></span>
                                </td>
                                <td>
                                    <span class="atp-log-title"><?php echo esc_html(date_i18n(get_option('date_format'), strtotime($alt_text_pro_log->created_at))); ?></span>
                                    <span class="atp-log-meta"><?php echo esc_html(human_time_diff(strtotime($alt_text_pro_log->created_at), current_time('timestamp'))); ?>
                                        <?php esc_html_e('ago', 'alt-text-pro'); ?></span>
                                </td>
                                <td>
                                    <a href="<?php echo esc_url(admin_url('post.php?post=' . $alt_text_pro_log->attachment_id . '&action=edit')); ?>"
                                        class="button-secondary-custom atp-btn-sm atp-btn-icon"
                                        title="<?php esc_attr_e('Edit Image', 'alt-text-pro'); ?>"
                                        aria-label="<?php esc_attr_e('Edit Image', 'alt-text-pro'); ?>">
                                        <span class="dashicons dashicons-edit" aria-hidden="true"></span>
                                    </a>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>

            <!-- Pagination -->
            <?php if ($total_pages > 1): ?>
                <div class="atp-pagination">
                    <div>
                        <?php
                        // translators: %1$d: Current page number, %2$d: Total number of pages
                        printf(esc_html__('Page %1$d of %2$d', 'alt-text-pro'), esc_html($current_page), esc_html($total_pages)); ?>
                    </div>
                    <div class="atp-actions">
                        <?php
                        $alt_text_pro_base_url = admin_url('admin.php?page=alt-text-pro-logs');
                        if ($search !== '') {
                            $alt_text_pro_base_url = add_query_arg('s', rawurlencode($search), $alt_text_pro_base_url);
                        }
                        if ($outcome !== '') {
                            $alt_text_pro_base_url = add_query_arg('outcome', $outcome, $alt_text_pro_base_url);
                        }
                        if ($current_page > 1) {
                            echo '<a href="' . esc_url(add_query_arg('paged', $current_page - 1, $alt_text_pro_base_url)) . '" class="button-secondary-custom atp-btn-sm"><span class="dashicons dashicons-arrow-left-alt2" aria-hidden="true"></span><span>' . esc_html__('Prev', 'alt-text-pro') . '</span></a>';
                        }
                        if ($current_page < $total_pages) {
                            echo '<a href="' . esc_url(add_query_arg('paged', $current_page + 1, $alt_text_pro_base_url)) . '" class="button-secondary-custom atp-btn-sm"><span>' . esc_html__('Next', 'alt-text-pro') . '</span><span class="dashicons dashicons-arrow-right-alt2" aria-hidden="true"></span></a>';
                        }
                        ?>
                    </div>
                </div>
            <?php endif; ?>

        <?php else: ?>
            <div class="atp-empty-state">
                <span class="atp-icon-chip is-lg" aria-hidden="true"><span class="dashicons dashicons-list-view"></span></span>
                <h3><?php echo esc_html($search !== '' || $outcome !== '' ? __('No entries match your search', 'alt-text-pro') : __('No logs found', 'alt-text-pro')); ?></h3>
                <p>
                    <?php esc_html_e('Start generating alt-text to see history here.', 'alt-text-pro'); ?></p>
                <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-pro-bulk')); ?>"
                    class="button-primary-custom">
                    <span class="dashicons dashicons-controls-play" aria-hidden="true"></span>
                    <span><?php esc_html_e('Start Generating', 'alt-text-pro'); ?></span>
                </a>
            </div>
        <?php endif; ?>
    </div>
</div>
