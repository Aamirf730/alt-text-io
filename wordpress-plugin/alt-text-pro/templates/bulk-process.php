<?php
/**
 * Bulk Process Template for Alt-Text AI
 */

if (!defined('ABSPATH')) {
    exit;
}

// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Only used for active menu highlighting
$alt_text_pro_current_page = isset($_GET['page']) ? sanitize_text_field(wp_unslash($_GET['page'])) : '';
?>

<div class="wrap alt-text-pro-bulk-process">
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

    <?php
    $alt_text_pro_settings = get_option('alt_text_pro_settings', array());
    if (empty($alt_text_pro_settings['api_key'])):
        ?>
        <div class="alt-text-pro-card" style="border-left: 4px solid var(--warning-color);">
            <div class="card-content" style="text-align: center; padding: 40px;">
                <h3 style="margin-bottom: 10px;"><?php esc_html_e('API Key Required', 'alt-text-pro'); ?></h3>
                <p style="margin-bottom: 20px; color: var(--text-secondary);">
                    <?php esc_html_e('You need to configure your API key before you can use bulk processing.', 'alt-text-pro'); ?>
                </p>
                <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-pro-settings')); ?>"
                    class="button-primary-custom">
                    <?php esc_html_e('Configure API Key', 'alt-text-pro'); ?>
                </a>
            </div>
        </div>
    <?php else: ?>

        <div class="alt-text-pro-card">
            <div class="card-header">
                <h3><?php esc_html_e('Bulk Generation', 'alt-text-pro'); ?></h3>
            </div>
            <div class="card-content">
                <form id="bulk-process-form">
                    <?php
                    $bulk_display_credits_remaining = $monthly_credits_remaining !== null ? $monthly_credits_remaining : $credits_remaining;
                    $bulk_display_monthly_limit = $monthly_credit_limit !== null ? $monthly_credit_limit : $monthly_credit_allowance;
                    ?>
                    <?php if ($bulk_display_credits_remaining !== null): ?>
                        <div
                            style="margin-bottom: 20px; padding: 14px 16px; background: var(--bg-light); border-radius: var(--radius-sm); color: var(--text-secondary); font-size: 14px;">
                            <?php if ($billing_cycle === 'annual' && !empty($bulk_display_monthly_limit)): ?>
                                <?php
                                echo esc_html(
                                    sprintf(
                                        /* translators: 1: Credits left this month, 2: Monthly allowance */
                                        __('You have %1$s credits left this month out of your %2$s monthly allowance.', 'alt-text-pro'),
                                        number_format_i18n($bulk_display_credits_remaining),
                                        number_format_i18n($bulk_display_monthly_limit)
                                    )
                                );
                                ?>
                            <?php else: ?>
                                <?php
                                echo esc_html(
                                    sprintf(
                                        /* translators: %s: Remaining credits */
                                        __('You currently have %s credits available for bulk processing.', 'alt-text-pro'),
                                        number_format_i18n($bulk_display_credits_remaining)
                                    )
                                );
                                ?>
                            <?php endif; ?>
                        </div>
                    <?php endif; ?>

                    <div style="margin-bottom: 24px;">
                        <label class="checkbox-group" style="margin-bottom: 12px;">
                            <input type="radio" name="process_type" value="missing" checked>
                            <span
                                class="checkbox-label"><?php esc_html_e('Process images missing alt-text', 'alt-text-pro'); ?></span>
                            <span
                                style="color: var(--text-secondary); font-size: 13px; margin-left: 8px;">(<?php echo esc_html($total_without_alt); ?>
                                images)</span>
                        </label>

                        <label class="checkbox-group" style="margin-bottom: 12px;">
                            <input type="radio" name="process_type" value="all">
                            <span class="checkbox-label"><?php esc_html_e('Process all images', 'alt-text-pro'); ?></span>
                            <span
                                style="color: var(--text-secondary); font-size: 13px; margin-left: 8px;">(<?php echo esc_html($total_images); ?>
                                images)</span>
                        </label>

                        <label class="checkbox-group">
                            <input type="radio" name="process_type" value="selected">
                            <span
                                class="checkbox-label"><?php esc_html_e('Process selected images', 'alt-text-pro'); ?></span>
                            <span class="selection-count"
                                style="color: var(--text-secondary); font-size: 13px; margin-left: 8px;"></span>
                        </label>
                    </div>

                    <div id="overwrite-option-container"
                        style="background: var(--bg-light); padding: 20px; border-radius: var(--radius-md); margin-bottom: 24px; display: none;">
                        <h4 style="margin-top: 0; margin-bottom: 16px; font-size: 14px;">
                            <?php esc_html_e('Options', 'alt-text-pro'); ?>
                        </h4>

                        <div style="display: flex; flex-wrap: wrap; gap: 24px;">
                            <div style="display: flex; align-items: center;">
                                <label class="checkbox-group" style="margin: 0;">
                                    <input type="checkbox" id="overwrite_existing" name="overwrite_existing" <?php checked($alt_text_pro_settings['overwrite_existing'] ?? false); ?>>
                                    <span class="checkbox-label"
                                        style="font-size: 13px;"><?php esc_html_e('Overwrite existing', 'alt-text-pro'); ?></span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 12px;">
                        <button type="button" id="start-bulk-process" class="button-primary-custom"
                            onclick="if(typeof bulkProcessor !== 'undefined' && bulkProcessor.startProcessing) { bulkProcessor.startProcessing(); return false; } else { console.error('Alt Text Pro: bulkProcessor not available'); return false; }">
                            <span class="dashicons dashicons-controls-play"></span>
                            <?php esc_html_e('Start Processing', 'alt-text-pro'); ?>
                        </button>
                        <button type="button" id="cancel-bulk-process" class="button-secondary-custom"
                            style="display: none !important; color: var(--danger-color) !important; border-color: var(--danger-color) !important;"
                            onclick="if(typeof bulkProcessor !== 'undefined' && bulkProcessor.cancelProcessing) { bulkProcessor.cancelProcessing(); return false; } else { console.error('Alt Text Pro: bulkProcessor not available'); return false; }">
                            <span class="dashicons dashicons-no"></span>
                            <?php esc_html_e('Stop after current image', 'alt-text-pro'); ?>
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Progress Card (Hidden by default) -->
        <div class="alt-text-pro-card" id="progress-card" style="display: none;">
            <div class="card-header">
                <div class="bulk-progress-title">
                    <span class="bulk-live-indicator" aria-hidden="true"></span>
                    <div>
                        <span class="bulk-live-label"><?php esc_html_e('LIVE PROCESSING', 'alt-text-pro'); ?></span>
                        <h3><?php esc_html_e('Generating alt text', 'alt-text-pro'); ?></h3>
                    </div>
                </div>
                <span id="progress-status" class="status-badge warning">Initializing...</span>
            </div>
            <div class="card-content">
                <div class="bulk-progress-overview usage-progress-container" id="process-progress-container">
                    <div class="bulk-progress-overview-header">
                        <div>
                            <span class="bulk-progress-kicker"><?php esc_html_e('Overall progress', 'alt-text-pro'); ?></span>
                            <div class="bulk-progress-count" id="processed-count">0 / 0</div>
                        </div>
                        <div class="bulk-progress-percent"><span id="progress-text">0%</span><small><?php esc_html_e('complete', 'alt-text-pro'); ?></small></div>
                    </div>
                    <div class="progress-bar bulk-progress-bar">
                        <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
                    </div>
                    <div class="bulk-progress-meta">
                        <span><span class="dashicons dashicons-images-alt2" aria-hidden="true"></span> <strong id="live-remaining-count">0</strong> <?php esc_html_e('images left in this run', 'alt-text-pro'); ?></span>
                        <span id="process-limit-note" style="display: none;"></span>
                    </div>
                </div>

                <div class="bulk-current-task" id="bulk-current-task">
                    <div class="bulk-current-task-icon"><span class="dashicons dashicons-format-image" aria-hidden="true"></span></div>
                    <div class="bulk-current-task-copy">
                        <span class="bulk-current-task-label"><?php esc_html_e('CURRENT TASK', 'alt-text-pro'); ?></span>
                        <strong id="active-image-position"><?php esc_html_e('Preparing your images', 'alt-text-pro'); ?></strong>
                        <span id="active-image-stage"><?php esc_html_e('The first image will begin shortly.', 'alt-text-pro'); ?></span>
                    </div>
                    <span class="bulk-current-task-state" id="active-image-state"><?php esc_html_e('Preparing', 'alt-text-pro'); ?></span>
                </div>

                <div id="process-summary-container"
                    class="bulk-process-summary">
                    <div id="process-summary-text"></div>
                    <div id="process-summary-details"></div>
                </div>

                <div class="bulk-progress-stats" aria-label="<?php esc_attr_e('Processing statistics', 'alt-text-pro'); ?>">
                    <div class="bulk-progress-stat">
                        <span class="dashicons dashicons-update" aria-hidden="true"></span>
                        <span class="bulk-progress-stat-label"><?php esc_html_e('Processed', 'alt-text-pro'); ?></span>
                        <strong id="processed-stat-count">0</strong>
                    </div>
                    <div class="bulk-progress-stat success">
                        <span class="dashicons dashicons-yes-alt" aria-hidden="true"></span>
                        <span class="bulk-progress-stat-label"><?php esc_html_e('Generated', 'alt-text-pro'); ?></span>
                        <strong id="successful-count">0</strong>
                    </div>
                    <div class="bulk-progress-stat error">
                        <span class="dashicons dashicons-warning" aria-hidden="true"></span>
                        <span class="bulk-progress-stat-label"><?php esc_html_e('Needs attention', 'alt-text-pro'); ?></span>
                        <strong id="error-count">0</strong>
                    </div>
                    <div class="bulk-progress-stat remaining">
                        <span class="dashicons dashicons-images-alt2" aria-hidden="true"></span>
                        <span class="bulk-progress-stat-label"><?php esc_html_e('Remaining', 'alt-text-pro'); ?></span>
                        <strong id="remaining-stat-count">0</strong>
                    </div>
                </div>

                <p class="bulk-stop-hint"><span class="dashicons dashicons-info-outline" aria-hidden="true"></span><?php esc_html_e('Stopping prevents the next image from starting. If one is already generating, it will finish and be included in the final count.', 'alt-text-pro'); ?></p>

                <div class="bulk-activity">
                    <div class="bulk-activity-header"><span><?php esc_html_e('Activity', 'alt-text-pro'); ?></span><small><?php esc_html_e('Newest events appear here', 'alt-text-pro'); ?></small></div>
                    <div id="progress-log">
                    </div>
                </div>
            </div>
        </div>

        <!-- Results Card (Hidden by default) -->
        <div class="alt-text-pro-card" id="results-card" style="display: none;">
            <div class="card-header">
                <h3><?php esc_html_e('Results', 'alt-text-pro'); ?></h3>
            </div>
            <div class="card-content">
                <div id="results-summary"></div>
                <div id="results-errors"></div>
                <div style="margin-top: 20px; text-align: center;">
                    <button type="button" class="button-primary-custom" onclick="location.reload()">
                        <?php esc_html_e('Start New Process', 'alt-text-pro'); ?>
                    </button>
                </div>
            </div>
        </div>

        <!-- Image Selection Sidebar (Hidden by default) -->
        <div class="alt-text-pro-card" id="image-selection-sidebar" style="display: none;">
            <div class="card-header">
                <h3><?php esc_html_e('Select Images', 'alt-text-pro'); ?></h3>
                <div style="display: flex; gap: 8px;">
                    <button type="button" class="button-secondary-custom" id="select-all-images"
                        style="padding: 6px 12px !important; font-size: 12px !important;">
                        <?php esc_html_e('All', 'alt-text-pro'); ?>
                    </button>
                    <button type="button" class="button-secondary-custom" id="deselect-all-images"
                        style="padding: 6px 12px !important; font-size: 12px !important;">
                        <?php esc_html_e('None', 'alt-text-pro'); ?>
                    </button>
                </div>
            </div>
            <div class="card-content">
                <div id="image-list" style="max-height: 400px; overflow-y: auto;">
                    <?php if (!empty($images_without_alt)): ?>
                        <?php foreach (array_slice($images_without_alt, 0, 50) as $alt_text_pro_image):
                            $alt_text_pro_image_url = wp_get_attachment_image_url($alt_text_pro_image->ID, 'thumbnail');
                            ?>
                            <div
                                style="display: flex; align-items: center; gap: 12px; padding: 8px; border-bottom: 1px solid var(--border-color);">
                                <input type="checkbox" name="selected_images[]"
                                    value="<?php echo esc_attr($alt_text_pro_image->ID); ?>">
                                <img src="<?php echo esc_url($alt_text_pro_image_url ?: ''); ?>"
                                    style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; background: #eee;">
                                <div
                                    style="font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;">
                                    <?php echo esc_html($alt_text_pro_image->post_title ?: 'Image #' . $alt_text_pro_image->ID); ?>
                                </div>
                            </div>
                        <?php endforeach; ?>

                        <?php if (count($images_without_alt) > 50): ?>
                            <div style="text-align: center; padding: 10px;">
                                <small><?php
                                printf(
                                    // translators: %d: Number of additional images
                                    esc_html__('%1$d more images...', 'alt-text-pro'),
                                    count($images_without_alt) - 50
                                ); ?></small>
                            </div>
                        <?php endif; ?>
                    <?php else: ?>
                        <p style="text-align: center; color: var(--text-secondary);">
                            <?php esc_html_e('No images found without alt text.', 'alt-text-pro'); ?>
                        </p>
                    <?php endif; ?>
                </div>
            </div>
        </div>

    <?php endif; ?>
</div>
