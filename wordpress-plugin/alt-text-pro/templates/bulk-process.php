<?php
/**
 * Bulk Process Template for Alt-Text AI
 */

if (!defined('ABSPATH')) {
    exit;
}

?>

<div class="wrap alt-text-pro-bulk-process atp-ui">
    <?php require ALT_TEXT_PRO_PLUGIN_PATH . 'templates/partials/header.php'; ?>

    <?php
    $alt_text_pro_settings = get_option('alt_text_pro_settings', array());
    if (empty($has_valid_key)):
        ?>
        <div class="alt-text-pro-card">
            <div class="atp-empty-state">
                <span class="atp-icon-chip is-lg" aria-hidden="true"><span class="dashicons dashicons-admin-network"></span></span>
                <h3><?php esc_html_e('API Key Required', 'alt-text-pro'); ?></h3>
                <p>
                    <?php esc_html_e('You need to configure your API key before you can use bulk processing.', 'alt-text-pro'); ?>
                </p>
                <?php if (current_user_can('manage_options')): ?>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-pro-settings')); ?>"
                        class="button-primary-custom">
                        <span class="dashicons dashicons-admin-network" aria-hidden="true"></span>
                        <span><?php esc_html_e('Configure API Key', 'alt-text-pro'); ?></span>
                    </a>
                <?php else: ?>
                    <p><?php esc_html_e('Ask a site administrator to connect the Alt Text Pro account.', 'alt-text-pro'); ?></p>
                <?php endif; ?>
            </div>
        </div>
    <?php else: ?>

        <?php
        $bulk_display_credits_remaining = $monthly_credits_remaining !== null ? $monthly_credits_remaining : $credits_remaining;
        $bulk_display_monthly_limit = $monthly_credit_limit !== null ? $monthly_credit_limit : $monthly_credit_allowance;
        $alt_text_pro_out_of_credits = $bulk_display_credits_remaining !== null && $bulk_display_credits_remaining <= 0;
        $alt_text_pro_account_blocked = in_array($usage_error_code ?? '', array('account_suspended', 'invalid_api_key', 'account_not_found', 'forbidden'), true);
        $alt_text_pro_run_active = !empty($active_run);
        // A run that is already stopping cannot be resumed, only stopped.
        $alt_text_pro_run_resumable = $alt_text_pro_run_active
            && !empty($active_run['is_owner'])
            && ($active_run['status'] ?? '') !== 'cancelling';
        $alt_text_pro_start_blocked = $alt_text_pro_out_of_credits || $alt_text_pro_account_blocked || $alt_text_pro_run_active;
        ?>

        <?php if ($alt_text_pro_run_active): ?>
            <!-- A run is still going: resume it (its owner) or stop it (an administrator). -->
            <div class="alt-text-pro-card is-warning" id="active-run-card">
                <div class="atp-callout">
                    <span class="atp-icon-chip is-warning" aria-hidden="true"><span class="dashicons dashicons-update"></span></span>
                    <div class="atp-callout-body">
                        <h3>
                            <?php
                            echo esc_html(!empty($active_run['is_owner'])
                                ? __('Your bulk run is still in progress', 'alt-text-pro')
                                : sprintf(
                                    /* translators: %s: name of the user who started the run */
                                    __('A bulk run started by %s is in progress', 'alt-text-pro'),
                                    $active_run['started_by'] !== '' ? $active_run['started_by'] : __('another user', 'alt-text-pro')
                                ));
                            ?>
                        </h3>
                        <p>
                            <?php
                            echo esc_html(sprintf(
                                /* translators: 1: images processed, 2: images in the run */
                                __('%1$s of %2$s images processed. Only one bulk run can be active on a site.', 'alt-text-pro'),
                                number_format_i18n(intval($active_run['processed'])),
                                number_format_i18n(intval($active_run['processable_images']))
                            ));
                            ?>
                            <?php if ($alt_text_pro_run_resumable): ?>
                                <?php esc_html_e('Resume it here, or stop it to start a different run.', 'alt-text-pro'); ?>
                            <?php elseif (!empty($active_run['is_owner'])): ?>
                                <?php esc_html_e('It is stopping after its last image. Stop it to finish.', 'alt-text-pro'); ?>
                            <?php endif; ?>
                        </p>
                    </div>
                    <div class="atp-actions">
                        <?php if ($alt_text_pro_run_resumable): ?>
                            <button type="button" class="button-primary-custom" id="resume-bulk-process">
                                <span class="dashicons dashicons-controls-play" aria-hidden="true"></span>
                                <span><?php esc_html_e('Resume run', 'alt-text-pro'); ?></span>
                            </button>
                        <?php endif; ?>
                        <?php if (!empty($active_run['can_cancel'])): ?>
                            <button type="button" class="button-secondary-custom atp-btn-danger" id="cancel-active-run">
                                <span class="dashicons dashicons-controls-pause" aria-hidden="true"></span>
                                <span><?php esc_html_e('Stop run', 'alt-text-pro'); ?></span>
                            </button>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
        <?php endif; ?>

        <div class="alt-text-pro-card">
            <div class="card-header">
                <h3><?php esc_html_e('Bulk Generation', 'alt-text-pro'); ?></h3>
            </div>
            <div class="card-content">
                <form id="bulk-process-form">
                    <?php if ($bulk_display_credits_remaining !== null): ?>
                        <div class="atp-info-box">
                            <span class="dashicons dashicons-chart-pie" aria-hidden="true"></span>
                            <span>
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
                            </span>
                            <a href="<?php echo esc_url(ALT_TEXT_PRO_PRICING_URL); ?>" target="_blank" rel="noopener noreferrer" class="atp-upgrade-link">
                                <?php esc_html_e('Buy credits or upgrade', 'alt-text-pro'); ?>
                            </a>
                        </div>
                    <?php endif; ?>

                    <?php if ($alt_text_pro_out_of_credits): ?>
                        <div class="atp-info-box is-error" role="alert">
                            <span class="dashicons dashicons-warning" aria-hidden="true"></span>
                            <span>
                                <?php esc_html_e('You have no credits left, so bulk processing cannot start. Buy a credit pack or upgrade your plan, then reload this page.', 'alt-text-pro'); ?>
                                <a href="<?php echo esc_url(ALT_TEXT_PRO_PRICING_URL); ?>" target="_blank" rel="noopener noreferrer" class="atp-upgrade-link">
                                    <?php esc_html_e('Buy credits or upgrade', 'alt-text-pro'); ?>
                                </a>
                            </span>
                        </div>
                    <?php elseif ($alt_text_pro_account_blocked): ?>
                        <div class="atp-info-box is-error" role="alert">
                            <span class="dashicons dashicons-warning" aria-hidden="true"></span>
                            <span><?php echo esc_html($usage_error); ?></span>
                        </div>
                    <?php endif; ?>

                    <div class="atp-choice-list" role="radiogroup" aria-label="<?php esc_attr_e('Images to process', 'alt-text-pro'); ?>">
                        <label class="checkbox-group">
                            <input type="radio" name="process_type" value="missing" checked>
                            <span
                                class="checkbox-label"><?php esc_html_e('Process images missing alt-text', 'alt-text-pro'); ?></span>
                            <span class="atp-choice-meta">(<?php echo esc_html($total_without_alt); ?>
                                images)</span>
                        </label>

                        <label class="checkbox-group">
                            <input type="radio" name="process_type" value="all">
                            <span class="checkbox-label"><?php esc_html_e('Process all images', 'alt-text-pro'); ?></span>
                            <span class="atp-choice-meta">(<?php echo esc_html($total_images); ?>
                                images)</span>
                        </label>

                        <label class="checkbox-group">
                            <input type="radio" name="process_type" value="selected">
                            <span
                                class="checkbox-label"><?php esc_html_e('Process selected images', 'alt-text-pro'); ?></span>
                            <span class="selection-count atp-choice-meta"></span>
                        </label>
                    </div>

                    <div id="overwrite-option-container" class="atp-subpanel" style="display: none;">
                        <h4><?php esc_html_e('Options', 'alt-text-pro'); ?></h4>
                        <label class="checkbox-group">
                            <input type="checkbox" id="overwrite_existing" name="overwrite_existing" <?php checked($alt_text_pro_settings['overwrite_existing'] ?? false); ?>>
                            <span class="checkbox-label"><?php esc_html_e('Overwrite existing', 'alt-text-pro'); ?></span>
                        </label>
                    </div>

                    <p class="description atp-help">
                        <?php
                        echo esc_html(AltTextPro_Settings::is_enabled('email_bulk_complete')
                            ? __('You will get an email when the run finishes. You can turn this off in Settings.', 'alt-text-pro')
                            : __('Completion emails are off. You can turn them on in Settings.', 'alt-text-pro'));
                        ?>
                    </p>

                    <div class="atp-actions">
                        <button type="button" id="start-bulk-process" class="button-primary-custom"
                            data-blocked="<?php echo esc_attr($alt_text_pro_start_blocked ? '1' : '0'); ?>"
                            data-blocked-reason="<?php echo esc_attr(($alt_text_pro_run_active && !$alt_text_pro_out_of_credits && !$alt_text_pro_account_blocked) ? 'run' : ''); ?>"
                            <?php disabled($alt_text_pro_start_blocked); ?>
                            onclick="if(typeof bulkProcessor !== 'undefined' && bulkProcessor.startProcessing) { bulkProcessor.startProcessing(); return false; } else { console.error('Alt Text Pro: bulkProcessor not available'); return false; }">
                            <span class="dashicons dashicons-controls-play" aria-hidden="true"></span>
                            <span><?php esc_html_e('Start Processing', 'alt-text-pro'); ?></span>
                        </button>
                        <button type="button" id="cancel-bulk-process" class="button-secondary-custom atp-btn-danger"
                            style="display: none !important;"
                            onclick="if(typeof bulkProcessor !== 'undefined' && bulkProcessor.cancelProcessing) { bulkProcessor.cancelProcessing(); return false; } else { console.error('Alt Text Pro: bulkProcessor not available'); return false; }">
                            <span class="dashicons dashicons-controls-pause" aria-hidden="true"></span>
                            <span><?php esc_html_e('Stop after current image', 'alt-text-pro'); ?></span>
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
                <span id="progress-status" class="status-badge warning" aria-live="polite"><?php esc_html_e('Initializing...', 'alt-text-pro'); ?></span>
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
                    <span class="atp-icon-chip bulk-current-task-icon" aria-hidden="true"><span class="dashicons dashicons-format-image"></span></span>
                    <div class="bulk-current-task-copy">
                        <span class="bulk-current-task-label"><?php esc_html_e('CURRENT TASK', 'alt-text-pro'); ?></span>
                        <strong id="active-image-position"><?php esc_html_e('Preparing your images', 'alt-text-pro'); ?></strong>
                        <span id="active-image-stage"><?php esc_html_e('The first image will begin shortly.', 'alt-text-pro'); ?></span>
                    </div>
                    <span class="bulk-current-task-state atp-badge" id="active-image-state"><?php esc_html_e('Preparing', 'alt-text-pro'); ?></span>
                </div>

                <div id="process-summary-container"
                    class="bulk-process-summary">
                    <div id="process-summary-text"></div>
                    <div id="process-summary-details"></div>
                </div>

                <div class="bulk-progress-stats" aria-label="<?php esc_attr_e('Processing statistics', 'alt-text-pro'); ?>">
                    <div class="bulk-progress-stat">
                        <span class="bulk-progress-stat-head">
                            <span class="dashicons dashicons-update" aria-hidden="true"></span>
                            <span class="bulk-progress-stat-label"><?php esc_html_e('Processed', 'alt-text-pro'); ?></span>
                        </span>
                        <strong id="processed-stat-count">0</strong>
                    </div>
                    <div class="bulk-progress-stat is-success">
                        <span class="bulk-progress-stat-head">
                            <span class="dashicons dashicons-yes-alt" aria-hidden="true"></span>
                            <span class="bulk-progress-stat-label"><?php esc_html_e('Generated', 'alt-text-pro'); ?></span>
                        </span>
                        <strong id="successful-count">0</strong>
                    </div>
                    <div class="bulk-progress-stat is-error">
                        <span class="bulk-progress-stat-head">
                            <span class="dashicons dashicons-warning" aria-hidden="true"></span>
                            <span class="bulk-progress-stat-label"><?php esc_html_e('Needs attention', 'alt-text-pro'); ?></span>
                        </span>
                        <strong id="error-count">0</strong>
                    </div>
                    <div class="bulk-progress-stat is-remaining">
                        <span class="bulk-progress-stat-head">
                            <span class="dashicons dashicons-images-alt2" aria-hidden="true"></span>
                            <span class="bulk-progress-stat-label"><?php esc_html_e('Remaining', 'alt-text-pro'); ?></span>
                        </span>
                        <strong id="remaining-stat-count">0</strong>
                    </div>
                </div>

                <p class="bulk-stop-hint"><span class="dashicons dashicons-info-outline" aria-hidden="true"></span><?php esc_html_e('Stopping prevents the next image from starting. If one is already generating, it will finish and be included in the final count.', 'alt-text-pro'); ?></p>

                <div class="bulk-activity">
                    <div class="bulk-activity-header"><span><?php esc_html_e('Activity', 'alt-text-pro'); ?></span><small><?php esc_html_e('Newest events appear here', 'alt-text-pro'); ?></small></div>
                    <div id="progress-log" role="log" aria-live="polite" aria-relevant="additions text">
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
                <div class="atp-actions atp-field-actions">
                    <button type="button" class="button-primary-custom" onclick="location.reload()">
                        <span class="dashicons dashicons-update" aria-hidden="true"></span>
                        <span><?php esc_html_e('Start New Process', 'alt-text-pro'); ?></span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Image Selection Sidebar (Hidden by default). Loaded page by page
             so any image can be found and regenerated. -->
        <div class="alt-text-pro-card" id="image-selection-sidebar" style="display: none;">
            <div class="card-header">
                <h3><?php esc_html_e('Select Images', 'alt-text-pro'); ?></h3>
                <div class="atp-actions">
                    <button type="button" class="button-secondary-custom atp-btn-sm" id="select-all-images">
                        <?php esc_html_e('All on this page', 'alt-text-pro'); ?>
                    </button>
                    <button type="button" class="button-secondary-custom atp-btn-sm" id="deselect-all-images">
                        <?php esc_html_e('None', 'alt-text-pro'); ?>
                    </button>
                </div>
            </div>
            <div class="card-content">
                <div class="atp-image-picker-controls">
                    <label class="screen-reader-text" for="image-search"><?php esc_html_e('Search images', 'alt-text-pro'); ?></label>
                    <input type="search" id="image-search" class="atp-input-sm" placeholder="<?php esc_attr_e('Search title or alt text...', 'alt-text-pro'); ?>">
                    <label class="screen-reader-text" for="image-filter"><?php esc_html_e('Show', 'alt-text-pro'); ?></label>
                    <select id="image-filter">
                        <option value="missing"><?php esc_html_e('Missing alt text', 'alt-text-pro'); ?></option>
                        <option value="has_alt"><?php esc_html_e('Has alt text', 'alt-text-pro'); ?></option>
                        <option value="all"><?php esc_html_e('All images', 'alt-text-pro'); ?></option>
                    </select>
                </div>
                <p class="description atp-help">
                    <?php esc_html_e('Selected images are regenerated even if they already have alt text. Your selection is kept when you search or change page.', 'alt-text-pro'); ?>
                </p>
                <div id="image-list" class="atp-image-list" aria-live="polite"></div>
                <div class="atp-pagination" id="image-pagination" style="display: none;">
                    <div id="image-page-label"></div>
                    <div class="atp-actions">
                        <button type="button" class="button-secondary-custom atp-btn-sm" id="image-page-prev">
                            <span class="dashicons dashicons-arrow-left-alt2" aria-hidden="true"></span>
                            <span><?php esc_html_e('Prev', 'alt-text-pro'); ?></span>
                        </button>
                        <button type="button" class="button-secondary-custom atp-btn-sm" id="image-page-next">
                            <span><?php esc_html_e('Next', 'alt-text-pro'); ?></span>
                            <span class="dashicons dashicons-arrow-right-alt2" aria-hidden="true"></span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

    <?php endif; ?>
</div>
