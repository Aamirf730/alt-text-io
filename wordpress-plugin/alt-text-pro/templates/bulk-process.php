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

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-title"><?php esc_html_e('Total Images', 'alt-text-pro'); ?></span>
                </div>
                <div class="stat-value"><?php echo esc_html(number_format($total_images)); ?></div>
            </div>
            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-title"><?php esc_html_e('Missing Alt-Text', 'alt-text-pro'); ?></span>
                </div>
                <div class="stat-value" style="color: var(--warning-color);">
                    <?php echo esc_html(number_format($total_without_alt)); ?>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-title"><?php esc_html_e('Optimized', 'alt-text-pro'); ?></span>
                </div>
                <div class="stat-value" style="color: var(--success-color);">
                    <?php echo esc_html(number_format($total_images - $total_without_alt)); ?>
                </div>
            </div>
        </div>

        <div class="alt-text-pro-card">
            <div class="card-header">
                <h3><?php esc_html_e('Bulk Generation', 'alt-text-pro'); ?></h3>
            </div>
            <div class="card-content">
                <form id="bulk-process-form">
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
                            <?php esc_html_e('Cancel', 'alt-text-pro'); ?>
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Progress Card (Hidden by default) -->
        <div class="alt-text-pro-card" id="progress-card" style="display: none;">
            <div class="card-header">
                <h3><?php esc_html_e('Progress', 'alt-text-pro'); ?></h3>
                <span id="progress-status" class="status-badge warning">Initializing...</span>
            </div>
            <div class="card-content">
                <div class="usage-progress-container" id="process-progress-container">
                    <div class="progress-bar" style="height: 12px;">
                        <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
                    </div>
                    <div class="progress-label">
                        <span id="progress-text">0%</span>
                        <span id="processed-count">0 / 0</span>
                    </div>
                </div>

                <div id="process-summary-container"
                    style="display: none; padding: 15px; background: var(--bg-light); border-radius: var(--radius-sm); margin-bottom: 20px; text-align: center;">
                    <div id="process-summary-text" style="font-weight: 600; font-size: 16px; margin-bottom: 5px;"></div>
                    <div id="process-summary-details" style="color: var(--text-secondary); font-size: 14px;"></div>
                </div>

                <div
                    style="margin-top: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px;">
                    <div class="stat-card" style="padding: 16px; align-items: center; text-align: center;">
                        <span
                            style="font-size: 12px; color: var(--text-secondary); text-transform: uppercase;"><?php esc_html_e('Successful', 'alt-text-pro'); ?></span>
                        <span id="successful-count"
                            style="font-size: 24px; font-weight: 700; color: var(--success-color);">0</span>
                    </div>
                    <div class="stat-card" style="padding: 16px; align-items: center; text-align: center;">
                        <span
                            style="font-size: 12px; color: var(--text-secondary); text-transform: uppercase;"><?php esc_html_e('Errors', 'alt-text-pro'); ?></span>
                        <span id="error-count"
                            style="font-size: 24px; font-weight: 700; color: var(--danger-color);">0</span>
                    </div>
                    <div class="stat-card" style="padding: 16px; align-items: center; text-align: center;">
                        <span
                            style="font-size: 12px; color: var(--text-secondary); text-transform: uppercase;"><?php esc_html_e('Est. Time', 'alt-text-pro'); ?></span>
                        <span id="estimated-time" style="font-size: 18px; font-weight: 600;">-</span>
                    </div>
                </div>

                <div id="progress-log"
                    style="margin-top: 20px; max-height: 200px; overflow-y: auto; background: var(--bg-light); padding: 12px; border-radius: var(--radius-sm); font-family: monospace; font-size: 12px; color: var(--text-secondary);">
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