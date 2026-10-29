<?php
/**
 * Dashboard Template for Alt-Text AI
 */

if (!defined('ABSPATH')) {
    exit;
}

?>

<div class="wrap alt-text-pro-dashboard atp-ui">
    <?php require ALT_TEXT_PRO_PLUGIN_PATH . 'templates/partials/header.php'; ?>

    <?php if (empty($settings['api_key'])): ?>
        <!-- Setup Card -->
        <div class="alt-text-pro-card">
            <div class="atp-empty-state">
                <span class="atp-icon-chip is-lg" aria-hidden="true"><span class="dashicons dashicons-admin-network"></span></span>
                <h2><?php esc_html_e('Connect to Alt Text Pro', 'alt-text-pro'); ?></h2>
                <p>
                    <?php esc_html_e('Generate editable alt-text drafts for your images with AI. Connect your account to get started.', 'alt-text-pro'); ?>
                </p>

                <div class="atp-actions is-center is-stack">
                    <button type="button" class="button-primary-custom open-modal"
                        data-modal="alt-text-pro-onboarding-modal">
                        <span class="dashicons dashicons-admin-links" aria-hidden="true"></span>
                        <span><?php esc_html_e('Connect Account', 'alt-text-pro'); ?></span>
                    </button>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-pro-settings')); ?>"
                        class="button-secondary-custom">
                        <span><?php esc_html_e('Settings', 'alt-text-pro'); ?></span>
                        <span class="dashicons dashicons-arrow-right-alt" aria-hidden="true"></span>
                    </a>
                </div>
            </div>
        </div>
    <?php
else: ?>

        <?php if ($usage_stats === null): ?>
            <!-- Account could not be loaded: never show made-up plan or credit numbers. -->
            <div class="alt-text-pro-card is-warning">
                <div class="atp-callout">
                    <span class="atp-icon-chip is-warning" aria-hidden="true"><span class="dashicons dashicons-warning"></span></span>
                    <div class="atp-callout-body">
                        <h3><?php esc_html_e('We could not load your Alt Text Pro account', 'alt-text-pro'); ?></h3>
                        <p>
                            <?php
                            echo esc_html(
                                !empty($usage_error)
                                    ? $usage_error
                                    : __('The service did not respond. Your API key may have been rotated or revoked, or the service may be busy.', 'alt-text-pro')
                            );
                            ?>
                        </p>
                    </div>
                    <div class="atp-actions">
                        <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-pro')); ?>" class="button-secondary-custom">
                            <span class="dashicons dashicons-update" aria-hidden="true"></span>
                            <span><?php esc_html_e('Try again', 'alt-text-pro'); ?></span>
                        </a>
                        <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-pro-settings')); ?>" class="button-primary-custom">
                            <span class="dashicons dashicons-admin-network" aria-hidden="true"></span>
                            <span><?php esc_html_e('Reconnect account', 'alt-text-pro'); ?></span>
                        </a>
                    </div>
                </div>
            </div>
        <?php endif; ?>

        <!-- Status & Credits -->
        <div class="stats-grid">
            <?php if ($usage_stats !== null): ?>
            <?php
    // Calculate account credit display from API usage data. Every number
    // comes from the service; nothing is assumed when a field is missing.
    $alt_text_pro_monthly_credit_limit = isset($usage_stats['monthly_credit_limit']) ? intval($usage_stats['monthly_credit_limit']) : 0;
    $alt_text_pro_monthly_allowance = isset($usage_stats['monthly_credit_allowance']) ? intval($usage_stats['monthly_credit_allowance']) : 0;
    $alt_text_pro_plan_allowance = $alt_text_pro_monthly_credit_limit > 0
        ? $alt_text_pro_monthly_credit_limit
        : ($alt_text_pro_monthly_allowance > 0 ? $alt_text_pro_monthly_allowance : (isset($usage_stats['total_credits']) ? intval($usage_stats['total_credits']) : 0));
    $alt_text_pro_monthly_credits_used = isset($usage_stats['monthly_credits_used'])
        ? intval($usage_stats['monthly_credits_used'])
        : (isset($usage_stats['credits_used']) ? intval($usage_stats['credits_used']) : 0);
    // Spendable now: plan credits left this cycle plus bonus and pack credits.
    $alt_text_pro_credits_available = isset($usage_stats['monthly_credits_remaining'])
        ? intval($usage_stats['monthly_credits_remaining'])
        : (isset($usage_stats['credits_remaining']) ? intval($usage_stats['credits_remaining']) : 0);
    $alt_text_pro_plan_credits_left = isset($usage_stats['plan_credits_remaining']) && $usage_stats['plan_credits_remaining'] !== null
        ? intval($usage_stats['plan_credits_remaining'])
        : max(0, $alt_text_pro_plan_allowance - $alt_text_pro_monthly_credits_used);
    $alt_text_pro_extra_credits = intval($usage_stats['bonus_credits_remaining'] ?? 0) + intval($usage_stats['purchased_credits_remaining'] ?? 0);
    $alt_text_pro_billing_cycle = isset($usage_stats['billing_cycle']) ? sanitize_text_field($usage_stats['billing_cycle']) : '';
    $alt_text_pro_usage_percentage = $alt_text_pro_plan_allowance > 0 ? ($alt_text_pro_monthly_credits_used / $alt_text_pro_plan_allowance) * 100 : 0;
    $alt_text_pro_usage_percentage = min(100, max(0, $alt_text_pro_usage_percentage));

    $alt_text_pro_plan_id = sanitize_key($usage_stats['subscription_plan'] ?? 'free');
    // Fallback names for an older service response without plan_name.
    $alt_text_pro_plan_names = array(
        'free' => __('Free', 'alt-text-pro'),
        'tier1' => __('Starter', 'alt-text-pro'),
        'tier2' => __('Growth', 'alt-text-pro'),
        'tier3' => __('Pro', 'alt-text-pro'),
        'tier4' => __('Agency', 'alt-text-pro'),
        'lite' => __('Lite', 'alt-text-pro'),
        'standard' => __('Standard', 'alt-text-pro'),
        'pro' => __('Pro', 'alt-text-pro'),
        'agency' => __('Agency', 'alt-text-pro'),
        'small_pack' => __('Credit Pack', 'alt-text-pro'),
        'credit_pack' => __('Credit Pack', 'alt-text-pro'),
        'bulk_pack' => __('Credit Pack', 'alt-text-pro'),
        'pay_as_go' => __('Credit Pack', 'alt-text-pro'),
    );
    $alt_text_pro_plan_name = !empty($usage_stats['plan_name'])
        ? sanitize_text_field($usage_stats['plan_name'])
        : ($alt_text_pro_plan_names[$alt_text_pro_plan_id] ?? ucwords(str_replace('_', ' ', $alt_text_pro_plan_id)));
    $alt_text_pro_one_time_plans = array('free', 'small_pack', 'credit_pack', 'bulk_pack', 'pay_as_go');
    if ($alt_text_pro_billing_cycle === 'annual' && !in_array($alt_text_pro_plan_id, $alt_text_pro_one_time_plans, true)) {
        $alt_text_pro_plan_name = sprintf(
            // translators: %s: Plan name
            __('%s Annual', 'alt-text-pro'),
            $alt_text_pro_plan_name
        );
    } elseif ($alt_text_pro_billing_cycle === 'monthly' && !in_array($alt_text_pro_plan_id, $alt_text_pro_one_time_plans, true)) {
        $alt_text_pro_plan_name = sprintf(
            // translators: %s: Plan name
            __('%s Monthly', 'alt-text-pro'),
            $alt_text_pro_plan_name
        );
    }
?>

            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-title"><?php esc_html_e('Credits', 'alt-text-pro'); ?></span>
                    <span class="stat-icon" aria-hidden="true"><span class="dashicons dashicons-chart-pie"></span></span>
                </div>
                <div class="stat-value">
                    <span><?php echo esc_html(number_format_i18n($alt_text_pro_credits_available)); ?></span>
                    <span class="stat-value-meta"><?php esc_html_e('available', 'alt-text-pro'); ?></span>
                </div>

                <?php $alt_text_pro_low_credits = $alt_text_pro_credits_available <= 10; ?>
                <div class="usage-progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: <?php echo esc_attr($alt_text_pro_usage_percentage); ?>%">
                        </div>
                    </div>
                    <div class="progress-label">
                        <span>
                            <?php
                            echo esc_html(
                                sprintf(
                                    /* translators: 1: plan credits left this month, 2: monthly plan allowance */
                                    __('%1$s of %2$s plan credits left this month', 'alt-text-pro'),
                                    number_format_i18n($alt_text_pro_plan_credits_left),
                                    number_format_i18n($alt_text_pro_plan_allowance)
                                )
                            );
                            ?>
                        </span>
                        <?php if ($alt_text_pro_extra_credits > 0): ?>
                            <span>
                                <?php
                                echo esc_html(
                                    sprintf(
                                        /* translators: %s: bonus and credit pack credits */
                                        __('+ %s bonus or pack credits', 'alt-text-pro'),
                                        number_format_i18n($alt_text_pro_extra_credits)
                                    )
                                );
                                ?>
                            </span>
                        <?php endif; ?>
                    </div>
                </div>
                <div class="stat-footer">
                    <a href="<?php echo esc_url(ALT_TEXT_PRO_PRICING_URL); ?>" target="_blank" rel="noopener noreferrer" class="atp-upgrade-link<?php echo $alt_text_pro_low_credits ? ' is-urgent' : ''; ?>">
                        <span><?php esc_html_e('Buy credits or upgrade', 'alt-text-pro'); ?></span>
                        <span class="dashicons dashicons-external" aria-hidden="true"></span>
                    </a>
                </div>
            </div>
            <?php endif; ?>

            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-title"><?php esc_html_e('Generated on This Site', 'alt-text-pro'); ?></span>
                    <span class="stat-icon" aria-hidden="true"><span class="dashicons dashicons-format-image"></span></span>
                </div>
                <div class="stat-value"><?php echo esc_html(number_format($total_generated ?: 0)); ?></div>
                <div class="stat-desc"><?php esc_html_e('Lifetime total on this site', 'alt-text-pro'); ?></div>
            </div>

            <?php if ($usage_stats !== null): ?>
            <div class="stat-card">
                <div class="stat-header">
                    <span class="stat-title"><?php esc_html_e('Plan', 'alt-text-pro'); ?></span>
                    <span class="stat-icon" aria-hidden="true"><span class="dashicons dashicons-awards"></span></span>
                </div>
                <div class="stat-value is-text">
                    <?php echo esc_html($alt_text_pro_plan_name); ?>
                </div>
                <?php if (!empty($usage_stats['account_email'])): ?>
                    <div class="stat-desc">
                        <?php
                        echo esc_html(sprintf(
                            /* translators: %s: email address of the connected Alt Text Pro account */
                            __('Connected as %s', 'alt-text-pro'),
                            sanitize_email($usage_stats['account_email'])
                        ));
                        ?>
                    </div>
                <?php endif; ?>
                <div class="stat-footer">
                    <a href="<?php echo esc_url(ALT_TEXT_PRO_DASHBOARD_URL); ?>" target="_blank" rel="noopener noreferrer">
                        <span><?php esc_html_e('Manage Subscription', 'alt-text-pro'); ?></span>
                        <span class="dashicons dashicons-external" aria-hidden="true"></span>
                    </a>
                    <a href="<?php echo esc_url(ALT_TEXT_PRO_PRICING_URL); ?>" target="_blank" rel="noopener noreferrer">
                        <span><?php esc_html_e('Upgrade plan', 'alt-text-pro'); ?></span>
                        <span class="dashicons dashicons-external" aria-hidden="true"></span>
                    </a>
                </div>
            </div>
            <?php endif; ?>
        </div>

        <?php if ($usage_stats !== null && sanitize_key($usage_stats['subscription_status'] ?? '') === 'past_due'): ?>
            <!-- A renewal charge failed; Polar retries it while the plan stays active. -->
            <div class="alt-text-pro-card is-warning">
                <div class="atp-callout">
                    <span class="atp-icon-chip is-warning" aria-hidden="true"><span class="dashicons dashicons-warning"></span></span>
                    <div class="atp-callout-body">
                        <h3><?php esc_html_e('Your last renewal payment failed', 'alt-text-pro'); ?></h3>
                        <p><?php esc_html_e('Your plan stays active while the payment is retried. Update your card in Billing & receipts on your Alt Text Pro dashboard to keep your plan and monthly credits.', 'alt-text-pro'); ?></p>
                    </div>
                    <div class="atp-actions">
                        <a href="<?php echo esc_url(ALT_TEXT_PRO_DASHBOARD_URL); ?>" target="_blank" rel="noopener noreferrer" class="button-primary-custom">
                            <span><?php esc_html_e('Update card', 'alt-text-pro'); ?></span>
                            <span class="dashicons dashicons-external" aria-hidden="true"></span>
                        </a>
                    </div>
                </div>
            </div>
        <?php endif; ?>

        <?php if ($usage_stats !== null && $alt_text_pro_low_credits): ?>
            <!-- Zero or low credits: the way to pay is right here. -->
            <div class="alt-text-pro-card is-warning">
                <div class="atp-callout">
                    <span class="atp-icon-chip is-warning" aria-hidden="true"><span class="dashicons dashicons-warning"></span></span>
                    <div class="atp-callout-body">
                        <h3>
                            <?php
                            echo esc_html($alt_text_pro_credits_available <= 0
                                ? __('You are out of credits', 'alt-text-pro')
                                : sprintf(
                                    /* translators: %s: credits left */
                                    _n('Only %s credit left', 'Only %s credits left', $alt_text_pro_credits_available, 'alt-text-pro'),
                                    number_format_i18n($alt_text_pro_credits_available)
                                ));
                            ?>
                        </h3>
                        <p><?php esc_html_e('Each image uses one credit. Buy a credit pack or upgrade your plan to keep generating alt text.', 'alt-text-pro'); ?></p>
                    </div>
                    <div class="atp-actions">
                        <a href="<?php echo esc_url(ALT_TEXT_PRO_PRICING_URL); ?>" target="_blank" rel="noopener noreferrer" class="button-primary-custom">
                            <span><?php esc_html_e('Buy credits or upgrade', 'alt-text-pro'); ?></span>
                            <span class="dashicons dashicons-external" aria-hidden="true"></span>
                        </a>
                    </div>
                </div>
            </div>
        <?php endif; ?>

        <!-- Quick Actions -->
        <div class="alt-text-pro-card">
            <div class="card-header">
                <h3><?php esc_html_e('Quick Actions', 'alt-text-pro'); ?></h3>
            </div>
            <div class="card-content">
                <div class="action-grid">
                    <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-pro-bulk')); ?>" class="action-btn">
                        <span class="atp-icon-chip" aria-hidden="true"><span class="dashicons dashicons-images-alt2"></span></span>
                        <span><?php esc_html_e('Bulk Process', 'alt-text-pro'); ?></span>
                    </a>
                    <a href="<?php echo esc_url(admin_url('upload.php')); ?>" class="action-btn">
                        <span class="atp-icon-chip" aria-hidden="true"><span class="dashicons dashicons-admin-media"></span></span>
                        <span><?php esc_html_e('Media Library', 'alt-text-pro'); ?></span>
                    </a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-pro-logs')); ?>" class="action-btn">
                        <span class="atp-icon-chip" aria-hidden="true"><span class="dashicons dashicons-list-view"></span></span>
                        <span><?php esc_html_e('View Logs', 'alt-text-pro'); ?></span>
                    </a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-pro-settings')); ?>" class="action-btn">
                        <span class="atp-icon-chip" aria-hidden="true"><span class="dashicons dashicons-admin-settings"></span></span>
                        <span><?php esc_html_e('Settings', 'alt-text-pro'); ?></span>
                    </a>
                </div>
            </div>
        </div>

        <?php if ($images_without_alt > 0): ?>
            <div class="alt-text-pro-card">
                <div class="atp-callout">
                    <span class="atp-icon-chip" aria-hidden="true"><span class="dashicons dashicons-lightbulb"></span></span>
                    <div class="atp-callout-body">
                        <h3><?php esc_html_e('Optimization Opportunity', 'alt-text-pro'); ?></h3>
                        <p>
                            <?php
        echo wp_kses_post(
            sprintf(
            // translators: %d: Number of images
            __('You have <strong>%1$d images</strong> missing alt text.', 'alt-text-pro'),
            esc_html($images_without_alt)
        )
        ); ?>
                        </p>
                    </div>
                    <div class="atp-actions">
                        <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-pro-bulk')); ?>"
                            class="button-primary-custom">
                            <span class="dashicons dashicons-controls-play" aria-hidden="true"></span>
                            <span><?php esc_html_e('Fix Now', 'alt-text-pro'); ?></span>
                        </a>
                    </div>
                </div>
            </div>
        <?php
    endif; ?>

    <?php
endif; ?>
</div>

<?php require ALT_TEXT_PRO_PLUGIN_PATH . 'templates/onboarding-modal.php'; ?>
