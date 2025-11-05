<?php
/**
 * Dashboard Template for Alt-Text AI
 */

if (!defined('ABSPATH')) {
    exit;
}
?>

<div class="wrap alt-text-ai-dashboard">
    <div class="alt-text-ai-header">
        <div class="alt-text-ai-header-content">
            <div class="alt-text-ai-logo">
                <span class="dashicons dashicons-format-image"></span>
                <h1><?php _e('Alt Text Pro Dashboard', 'alt-text-ai'); ?></h1>
            </div>
            <div class="alt-text-ai-header-actions">
                <a href="<?php echo admin_url('admin.php?page=alt-text-ai-settings'); ?>" class="button button-secondary">
                    <span class="dashicons dashicons-admin-settings"></span>
                    <?php _e('Settings', 'alt-text-ai'); ?>
                </a>
                <a href="<?php echo admin_url('admin.php?page=alt-text-ai-bulk'); ?>" class="button button-primary">
                    <span class="dashicons dashicons-images-alt2"></span>
                    <?php _e('Bulk Process', 'alt-text-ai'); ?>
                </a>
            </div>
        </div>
    </div>

    <?php if (!empty($settings['api_key'])): ?>
        <!-- Connection Status -->
        <div class="alt-text-ai-status-card">
            <?php if ($connection_status && $connection_status['success']): ?>
                <div class="status-indicator status-connected">
                    <span class="dashicons dashicons-yes-alt"></span>
                    <span><?php _e('Connected to Alt Text Pro', 'alt-text-ai'); ?></span>
                </div>
            <?php else: ?>
                <div class="status-indicator status-error">
                    <span class="dashicons dashicons-warning"></span>
                    <span><?php _e('Connection Error', 'alt-text-ai'); ?></span>
                    <?php if ($connection_status): ?>
                        <small><?php echo esc_html($connection_status['message']); ?></small>
                    <?php endif; ?>
                </div>
            <?php endif; ?>
        </div>

        <!-- Statistics Cards -->
        <div class="alt-text-ai-stats-grid">
            <!-- Usage Stats -->
            <?php if ($usage_stats): ?>
                <div class="stats-card usage-card">
                    <div class="stats-card-header">
                        <h3><?php _e('Your Plan', 'alt-text-ai'); ?></h3>
                        <span class="dashicons dashicons-chart-area"></span>
                    </div>
                    <div class="stats-card-content">
                        <div class="plan-info">
                            <div class="plan-name"><?php echo esc_html($usage_stats['subscription_plan'] ?? $usage_stats['current_plan'] ?? 'Free'); ?></div>
                            <div class="credits-remaining">
                                <span class="credits-number"><?php echo number_format($usage_stats['credits_remaining']); ?></span>
                                <span class="credits-label"><?php _e('credits remaining', 'alt-text-ai'); ?></span>
                            </div>
                        </div>
                        <div class="usage-progress">
                            <?php 
                            $total_processed = $usage_stats['total_processed'] ?? 0;
                            $credits_remaining = $usage_stats['credits_remaining'] ?? 0;
                            $total_credits = $total_processed + $credits_remaining;
                            $usage_percentage = $total_credits > 0 ? ($total_processed / $total_credits) * 100 : 0;
                            ?>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: <?php echo min(100, $usage_percentage); ?>%"></div>
                            </div>
                            <div class="progress-text">
                                <?php printf(__('%d of %d credits used', 'alt-text-ai'), $total_processed, $total_credits); ?>
                            </div>
                        </div>
                    </div>
                    <div class="stats-card-footer">
                        <a href="https://www.alt-text.pro/dashboard" target="_blank" class="button button-link">
                            <?php _e('Manage Plan', 'alt-text-ai'); ?>
                            <span class="dashicons dashicons-external"></span>
                        </a>
                    </div>
                </div>
            <?php endif; ?>

            <!-- Local Statistics -->
            <div class="stats-card local-stats-card">
                <div class="stats-card-header">
                    <h3><?php _e('Site Statistics', 'alt-text-ai'); ?></h3>
                    <span class="dashicons dashicons-analytics"></span>
                </div>
                <div class="stats-card-content">
                    <div class="stat-item">
                        <div class="stat-number"><?php echo number_format($total_generated ?: 0); ?></div>
                        <div class="stat-label"><?php _e('Alt-texts generated', 'alt-text-ai'); ?></div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number"><?php echo number_format($total_credits_used ?: 0); ?></div>
                        <div class="stat-label"><?php _e('Credits used', 'alt-text-ai'); ?></div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number"><?php echo number_format($images_without_alt ?: 0); ?></div>
                        <div class="stat-label"><?php _e('Images need alt-text', 'alt-text-ai'); ?></div>
                    </div>
                </div>
                <?php if ($images_without_alt > 0): ?>
                    <div class="stats-card-footer">
                        <a href="<?php echo admin_url('admin.php?page=alt-text-ai-bulk'); ?>" class="button button-primary">
                            <?php _e('Process Missing Alt-Text', 'alt-text-ai'); ?>
                        </a>
                    </div>
                <?php endif; ?>
            </div>

            <!-- Quick Actions -->
            <div class="stats-card actions-card">
                <div class="stats-card-header">
                    <h3><?php _e('Quick Actions', 'alt-text-ai'); ?></h3>
                    <span class="dashicons dashicons-admin-tools"></span>
                </div>
                <div class="stats-card-content">
                    <div class="action-buttons">
                        <a href="<?php echo admin_url('upload.php'); ?>" class="action-button">
                            <span class="dashicons dashicons-admin-media"></span>
                            <span><?php _e('Media Library', 'alt-text-ai'); ?></span>
                        </a>
                        <a href="<?php echo admin_url('admin.php?page=alt-text-ai-bulk'); ?>" class="action-button">
                            <span class="dashicons dashicons-images-alt2"></span>
                            <span><?php _e('Bulk Process', 'alt-text-ai'); ?></span>
                        </a>
                        <a href="<?php echo admin_url('admin.php?page=alt-text-ai-logs'); ?>" class="action-button">
                            <span class="dashicons dashicons-list-view"></span>
                            <span><?php _e('View Logs', 'alt-text-ai'); ?></span>
                        </a>
                        <button type="button" class="action-button" id="refresh-usage-stats">
                            <span class="dashicons dashicons-update"></span>
                            <span><?php _e('Refresh Stats', 'alt-text-ai'); ?></span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Recent Activity -->
        <?php if (!empty($recent_generations)): ?>
            <div class="alt-text-ai-section">
                <div class="section-header">
                    <h2><?php _e('Recent Activity', 'alt-text-ai'); ?></h2>
                    <a href="<?php echo admin_url('admin.php?page=alt-text-ai-logs'); ?>" class="button button-secondary">
                        <?php _e('View All', 'alt-text-ai'); ?>
                    </a>
                </div>
                <div class="recent-activity-list">
                    <?php foreach ($recent_generations as $generation): ?>
                        <div class="activity-item">
                            <div class="activity-icon">
                                <span class="dashicons dashicons-format-image"></span>
                            </div>
                            <div class="activity-content">
                                <div class="activity-title">
                                    <?php if ($generation->post_title): ?>
                                        <strong><?php echo esc_html($generation->post_title); ?></strong>
                                    <?php else: ?>
                                        <strong><?php printf(__('Image #%d', 'alt-text-ai'), $generation->attachment_id); ?></strong>
                                    <?php endif; ?>
                                </div>
                                <div class="activity-alt-text">
                                    "<?php echo esc_html(wp_trim_words($generation->alt_text, 15)); ?>"
                                </div>
                                <div class="activity-meta">
                                    <span class="activity-date">
                                        <?php echo human_time_diff(strtotime($generation->created_at), current_time('timestamp')); ?> <?php _e('ago', 'alt-text-ai'); ?>
                                    </span>
                                    <span class="activity-credits">
                                        <?php printf(__('%d credit used', 'alt-text-ai'), $generation->credits_used); ?>
                                    </span>
                                </div>
                            </div>
                            <div class="activity-actions">
                                <a href="<?php echo admin_url('post.php?post=' . $generation->attachment_id . '&action=edit'); ?>" class="button button-small">
                                    <?php _e('Edit', 'alt-text-ai'); ?>
                                </a>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        <?php endif; ?>

        <!-- Tips and Help -->
        <div class="alt-text-ai-section">
            <div class="section-header">
                <h2><?php _e('Tips & Best Practices', 'alt-text-ai'); ?></h2>
            </div>
            <div class="tips-grid">
                <div class="tip-card">
                    <div class="tip-icon">
                        <span class="dashicons dashicons-lightbulb"></span>
                    </div>
                    <div class="tip-content">
                        <h4><?php _e('Provide Context', 'alt-text-ai'); ?></h4>
                        <p><?php _e('Add context information when generating alt-text to get more accurate and relevant descriptions.', 'alt-text-ai'); ?></p>
                    </div>
                </div>
                <div class="tip-card">
                    <div class="tip-icon">
                        <span class="dashicons dashicons-performance"></span>
                    </div>
                    <div class="tip-content">
                        <h4><?php _e('Batch Processing', 'alt-text-ai'); ?></h4>
                        <p><?php _e('Use bulk processing to efficiently generate alt-text for multiple images at once.', 'alt-text-ai'); ?></p>
                    </div>
                </div>
                <div class="tip-card">
                    <div class="tip-icon">
                        <span class="dashicons dashicons-edit"></span>
                    </div>
                    <div class="tip-content">
                        <h4><?php _e('Review and Edit', 'alt-text-ai'); ?></h4>
                        <p><?php _e('Always review generated alt-text and edit if needed to ensure it fits your content perfectly.', 'alt-text-ai'); ?></p>
                    </div>
                </div>
            </div>
        </div>

    <?php else: ?>
        <!-- Setup Required -->
        <div class="alt-text-ai-setup-required">
            <div class="setup-card">
                <div class="setup-icon">
                    <span class="dashicons dashicons-admin-settings"></span>
                </div>
                <div class="setup-content">
                    <h2><?php _e('Welcome to Alt Text Pro!', 'alt-text-ai'); ?></h2>
                    <p><?php _e('To get started, you need to configure your API key. This connects your WordPress site to the Alt Text Pro service.', 'alt-text-ai'); ?></p>
                    
                    <div class="setup-steps">
                        <div class="setup-step">
                            <div class="step-number">1</div>
                            <div class="step-content">
                                <h4><?php _e('Get Your API Key', 'alt-text-ai'); ?></h4>
                                <p><?php _e('Visit the Alt Text Pro dashboard to get your API key.', 'alt-text-ai'); ?></p>
                                <a href="https://www.alt-text.pro/dashboard" target="_blank" class="button button-secondary">
                                    <?php _e('Get API Key', 'alt-text-ai'); ?>
                                    <span class="dashicons dashicons-external"></span>
                                </a>
                            </div>
                        </div>
                        <div class="setup-step">
                            <div class="step-number">2</div>
                            <div class="step-content">
                                <h4><?php _e('Configure Settings', 'alt-text-ai'); ?></h4>
                                <p><?php _e('Enter your API key and configure your preferences.', 'alt-text-ai'); ?></p>
                                <a href="<?php echo admin_url('admin.php?page=alt-text-ai-settings'); ?>" class="button button-primary">
                                    <?php _e('Configure Settings', 'alt-text-ai'); ?>
                                </a>
                            </div>
                        </div>
                        <div class="setup-step">
                            <div class="step-number">3</div>
                            <div class="step-content">
                                <h4><?php _e('Start Generating', 'alt-text-ai'); ?></h4>
                                <p><?php _e('Begin generating alt-text for your images automatically or manually.', 'alt-text-ai'); ?></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    <?php endif; ?>
</div>

<script type="text/javascript">
jQuery(document).ready(function($) {
    // Refresh usage stats
    $('#refresh-usage-stats').on('click', function() {
        var $button = $(this);
        var $icon = $button.find('.dashicons');
        
        $button.prop('disabled', true);
        $icon.addClass('rotating');
        
        $.ajax({
            url: altTextAI.ajaxUrl,
            type: 'POST',
            data: {
                action: 'alt_text_ai_get_usage',
                nonce: altTextAI.nonce
            },
            success: function(response) {
                if (response.success) {
                    location.reload();
                } else {
                    alert(response.data || 'Failed to refresh stats');
                }
            },
            error: function() {
                alert('Failed to refresh stats');
            },
            complete: function() {
                $button.prop('disabled', false);
                $icon.removeClass('rotating');
            }
        });
    });
});
</script>
