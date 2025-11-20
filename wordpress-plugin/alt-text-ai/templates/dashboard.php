<?php
/**
 * Dashboard Template for Alt-Text AI
 */

if (!defined('ABSPATH')) {
    exit;
}

// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Only used for active menu highlighting
$alt_text_ai_current_page = isset($_GET['page']) ? sanitize_text_field(wp_unslash($_GET['page'])) : '';
?>

<div class="wrap alt-text-ai-dashboard">
    <!-- Header & Navigation -->
    <div class="alt-text-ai-header">
        <div class="alt-text-ai-logo">
            <img src="<?php echo esc_url(ALT_TEXT_AI_PLUGIN_URL . 'assets/images/logo-alt-text-pro.png'); ?>" alt="Alt Text Pro" />
            <div>
                <h1><?php esc_html_e('Alt Text Pro', 'alt-text-ai'); ?></h1>
                <span style="color: var(--text-secondary); font-size: 13px;">v<?php echo esc_html(ALT_TEXT_AI_VERSION); ?></span>
            </div>
        </div>
        <div class="alt-text-ai-nav">
            <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-ai')); ?>" class="alt-text-ai-nav-item <?php echo esc_attr($alt_text_ai_current_page === 'alt-text-ai' ? 'active' : ''); ?>">
                <span class="dashicons dashicons-dashboard"></span>
                <?php esc_html_e('Dashboard', 'alt-text-ai'); ?>
            </a>
            <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-ai-bulk')); ?>" class="alt-text-ai-nav-item <?php echo esc_attr($alt_text_ai_current_page === 'alt-text-ai-bulk' ? 'active' : ''); ?>">
                <span class="dashicons dashicons-images-alt2"></span>
                <?php esc_html_e('Bulk Process', 'alt-text-ai'); ?>
            </a>
            <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-ai-logs')); ?>" class="alt-text-ai-nav-item <?php echo esc_attr($alt_text_ai_current_page === 'alt-text-ai-logs' ? 'active' : ''); ?>">
                <span class="dashicons dashicons-list-view"></span>
                <?php esc_html_e('Logs', 'alt-text-ai'); ?>
            </a>
            <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-ai-settings')); ?>" class="alt-text-ai-nav-item <?php echo esc_attr($alt_text_ai_current_page === 'alt-text-ai-settings' ? 'active' : ''); ?>">
                <span class="dashicons dashicons-admin-settings"></span>
                <?php esc_html_e('Settings', 'alt-text-ai'); ?>
            </a>
        </div>
    </div>

    <?php if (empty($settings['api_key'])): ?>
        <!-- Setup Card -->
        <div class="alt-text-ai-card">
            <div class="card-content" style="text-align: center; padding: 60px 20px;">
                <span class="dashicons dashicons-admin-network" style="font-size: 48px; width: 48px; height: 48px; color: var(--primary-color); margin-bottom: 20px;"></span>
                <h2 style="margin-bottom: 10px;"><?php esc_html_e('Connect to Alt Text Pro', 'alt-text-ai'); ?></h2>
                <p style="max-width: 500px; margin: 0 auto 30px; color: var(--text-secondary); font-size: 16px;">
                    <?php esc_html_e('Get accurate alt text for your images automatically using AI. Connect your account to get started.', 'alt-text-ai'); ?>
                </p>
                
                <div style="display: flex; gap: 16px; justify-content: center;">
                    <a href="https://www.alt-text.pro/dashboard" target="_blank" class="button-secondary-custom">
                        <?php esc_html_e('Get API Key', 'alt-text-ai'); ?>
                        <span class="dashicons dashicons-external"></span>
                    </a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-ai-settings')); ?>" class="button-primary-custom">
                        <?php esc_html_e('Configure Settings', 'alt-text-ai'); ?>
                        <span class="dashicons dashicons-arrow-right-alt"></span>
                    </a>
                </div>
            </div>
        </div>
    <?php else: ?>
        
        <!-- Status & Credits -->
        <div class="stats-grid">
            <?php 
            // Calculate credits logic
            $alt_text_ai_credits_remaining = isset($usage_stats['credits_remaining']) ? intval($usage_stats['credits_remaining']) : 0;
            $alt_text_ai_total_credits = isset($usage_stats['total_credits']) ? intval($usage_stats['total_credits']) : 100;
            $alt_text_ai_credits_used = isset($usage_stats['credits_used']) ? intval($usage_stats['credits_used']) : max(0, $alt_text_ai_total_credits - $alt_text_ai_credits_remaining);
            $alt_text_ai_usage_percentage = $alt_text_ai_total_credits > 0 ? ($alt_text_ai_credits_used / $alt_text_ai_total_credits) * 100 : 0;
            $alt_text_ai_usage_percentage = min(100, max(0, $alt_text_ai_usage_percentage));
            
            $alt_text_ai_plan_id = $usage_stats['subscription_plan'] ?? 'free';
            ?>
            
            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-title"><?php esc_html_e('Credits', 'alt-text-ai'); ?></span>
                    <div class="stat-icon"><span class="dashicons dashicons-chart-pie"></span></div>
                </div>
                <div class="stat-value"><?php echo esc_html(number_format($alt_text_ai_credits_remaining)); ?></div>
                <div class="stat-desc"><?php esc_html_e('Credits remaining this month', 'alt-text-ai'); ?></div>
                
                <div class="usage-progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: <?php echo esc_attr($alt_text_ai_usage_percentage); ?>%"></div>
                    </div>
                    <div class="progress-label">
                        <span><?php echo esc_html(number_format($alt_text_ai_credits_used)); ?> <?php esc_html_e('used', 'alt-text-ai'); ?></span>
                        <span><?php echo esc_html(number_format($alt_text_ai_total_credits)); ?> <?php esc_html_e('total', 'alt-text-ai'); ?></span>
                    </div>
                </div>
            </div>

            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-title"><?php esc_html_e('Generated', 'alt-text-ai'); ?></span>
                    <div class="stat-icon"><span class="dashicons dashicons-format-image"></span></div>
                </div>
                <div class="stat-value"><?php echo esc_html(number_format($total_generated ?: 0)); ?></div>
                <div class="stat-desc"><?php esc_html_e('Total alt-texts generated', 'alt-text-ai'); ?></div>
            </div>

            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-title"><?php esc_html_e('Plan', 'alt-text-ai'); ?></span>
                    <div class="stat-icon"><span class="dashicons dashicons-awards"></span></div>
                </div>
                <div class="stat-value" style="text-transform: capitalize; font-size: 24px;">
                    <?php echo esc_html(str_replace('_', ' ', $alt_text_ai_plan_id)); ?>
                </div>
                <div class="stat-desc">
                    <a href="https://www.alt-text.pro/dashboard" target="_blank" style="text-decoration: none; color: var(--primary-color);">
                        <?php esc_html_e('Manage Subscription', 'alt-text-ai'); ?> &rarr;
                    </a>
                </div>
            </div>
        </div>

        <!-- Quick Actions -->
        <div class="alt-text-ai-card">
            <div class="card-header">
                <h3><?php esc_html_e('Quick Actions', 'alt-text-ai'); ?></h3>
            </div>
            <div class="card-content">
                <div class="action-grid">
                    <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-ai-bulk')); ?>" class="action-btn">
                        <span class="dashicons dashicons-images-alt2"></span>
                        <span><?php esc_html_e('Bulk Process', 'alt-text-ai'); ?></span>
                    </a>
                    <a href="<?php echo esc_url(admin_url('upload.php')); ?>" class="action-btn">
                        <span class="dashicons dashicons-admin-media"></span>
                        <span><?php esc_html_e('Media Library', 'alt-text-ai'); ?></span>
                    </a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-ai-logs')); ?>" class="action-btn">
                        <span class="dashicons dashicons-list-view"></span>
                        <span><?php esc_html_e('View Logs', 'alt-text-ai'); ?></span>
                    </a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-ai-settings')); ?>" class="action-btn">
                        <span class="dashicons dashicons-admin-settings"></span>
                        <span><?php esc_html_e('Settings', 'alt-text-ai'); ?></span>
                    </a>
                </div>
            </div>
        </div>

        <?php if ($images_without_alt > 0): ?>
        <div class="alt-text-ai-card" style="border-left: 4px solid var(--warning-color);">
            <div class="card-content" style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="margin: 0 0 8px 0;"><?php esc_html_e('Optimization Opportunity', 'alt-text-ai'); ?></h3>
                    <p style="margin: 0; color: var(--text-secondary);">
                        <?php 
                        echo wp_kses_post(
                            sprintf(
                                // translators: %d: Number of images
                                __('You have <strong>%1$d images</strong> missing alt text.', 'alt-text-ai'),
                                esc_html($images_without_alt)
                            )
                        ); ?>
                    </p>
                </div>
                <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-ai-bulk')); ?>" class="button-primary-custom">
                    <?php esc_html_e('Fix Now', 'alt-text-ai'); ?>
                </a>
            </div>
        </div>
        <?php endif; ?>

    <?php endif; ?>
</div>

<script type="text/javascript">
jQuery(document).ready(function($) {
    // Refresh stats logic if needed
});
</script>
