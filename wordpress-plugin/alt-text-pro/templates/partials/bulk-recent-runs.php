<?php
/**
 * Bulk page: the latest finished runs, with their failed and skipped images
 * (kept after a reload) and "Undo this run".
 *
 * Variable from AltTextPro_Admin::bulk_process_page(): $recent_runs.
 *
 * @package AltTextPro
 */

if (!defined('ABSPATH')) {
    exit;
}

if (empty($recent_runs)) {
    return;
}

$alt_text_pro_run_status_labels = array(
    'completed' => __('Finished', 'alt-text-pro'),
    'cancelled' => __('Stopped by you', 'alt-text-pro'),
    'stopped_no_credits' => __('Stopped: no credits left', 'alt-text-pro'),
    'stopped_error' => __('Stopped: account or service problem', 'alt-text-pro'),
);
?>
<div class="alt-text-pro-card" id="recent-runs-card">
    <div class="card-header">
        <h3><?php esc_html_e('Recent runs', 'alt-text-pro'); ?></h3>
    </div>
    <div class="card-content">
        <ul class="atp-recent-runs">
            <?php foreach ($recent_runs as $alt_text_pro_run): ?>
                <?php
                $alt_text_pro_counts = $alt_text_pro_run['counts'];
                $alt_text_pro_written = intval($alt_text_pro_counts['generated']) + intval($alt_text_pro_counts['undone']);
                if (array_sum(array_map('intval', $alt_text_pro_counts)) === 0) {
                    // No log rows for this run (logs not upgraded yet): use the run's own count.
                    $alt_text_pro_written = intval($alt_text_pro_run['successful'] ?? 0);
                }
                $alt_text_pro_issue_count = intval($alt_text_pro_counts['failed']) + intval($alt_text_pro_counts['skipped']);
                $alt_text_pro_finished = !empty($alt_text_pro_run['finished_at']) ? strtotime($alt_text_pro_run['finished_at']) : false;
                ?>
                <li class="atp-recent-run" data-run-ref="<?php echo esc_attr($alt_text_pro_run['ref']); ?>">
                    <div class="atp-recent-run-head">
                        <strong>
                            <?php
                            echo esc_html($alt_text_pro_finished
                                ? date_i18n(get_option('date_format') . ' ' . get_option('time_format'), $alt_text_pro_finished)
                                : __('Bulk run', 'alt-text-pro'));
                            ?>
                        </strong>
                        <span class="atp-badge"><?php echo esc_html($alt_text_pro_run_status_labels[$alt_text_pro_run['status']] ?? $alt_text_pro_run['status']); ?></span>
                        <?php if (($alt_text_pro_run['mode'] ?? '') === 'background'): ?>
                            <span class="atp-badge"><?php esc_html_e('Background', 'alt-text-pro'); ?></span>
                        <?php endif; ?>
                        <?php if (!empty($alt_text_pro_run['started_by'])): ?>
                            <span class="atp-log-meta">
                                <?php
                                echo esc_html(sprintf(
                                    /* translators: %s: user name */
                                    __('by %s', 'alt-text-pro'),
                                    $alt_text_pro_run['started_by']
                                ));
                                ?>
                            </span>
                        <?php endif; ?>
                    </div>
                    <p class="atp-recent-run-summary">
                        <?php
                        $alt_text_pro_parts = array(
                            sprintf(
                                /* translators: %s: number of images */
                                __('%s processed', 'alt-text-pro'),
                                number_format_i18n(intval($alt_text_pro_run['processed'] ?? 0))
                            ),
                            sprintf(
                                /* translators: %s: number of images */
                                __('%s got alt text', 'alt-text-pro'),
                                number_format_i18n($alt_text_pro_written)
                            ),
                        );
                        if (!empty($alt_text_pro_counts['suggested'])) {
                            $alt_text_pro_parts[] = sprintf(
                                /* translators: %s: number of images */
                                __('%s waiting for review', 'alt-text-pro'),
                                number_format_i18n(intval($alt_text_pro_counts['suggested']))
                            );
                        }
                        $alt_text_pro_parts[] = sprintf(
                            /* translators: %s: number of images */
                            __('%s failed', 'alt-text-pro'),
                            number_format_i18n(intval($alt_text_pro_counts['failed']))
                        );
                        $alt_text_pro_parts[] = sprintf(
                            /* translators: %s: number of images */
                            __('%s skipped', 'alt-text-pro'),
                            number_format_i18n(intval($alt_text_pro_counts['skipped']))
                        );
                        echo esc_html(implode(' · ', $alt_text_pro_parts));
                        ?>
                    </p>
                    <?php if (!empty($alt_text_pro_run['undone_at'])): ?>
                        <p class="atp-log-meta">
                            <?php
                            echo esc_html(sprintf(
                                /* translators: 1: images restored, 2: images kept because they were edited after the run */
                                __('Undone: %1$s restored, %2$s kept because they were changed after the run.', 'alt-text-pro'),
                                number_format_i18n(intval($alt_text_pro_run['undo_restored'] ?? 0)),
                                number_format_i18n(intval($alt_text_pro_run['undo_changed'] ?? 0))
                            ));
                            ?>
                        </p>
                    <?php endif; ?>
                    <div class="atp-actions">
                        <?php if ($alt_text_pro_issue_count > 0): ?>
                            <button type="button" class="button-secondary-custom atp-btn-sm atp-run-items-toggle" aria-expanded="false">
                                <span class="dashicons dashicons-list-view" aria-hidden="true"></span>
                                <span><?php esc_html_e('Show failed and skipped images', 'alt-text-pro'); ?></span>
                            </button>
                        <?php endif; ?>
                        <?php if (!empty($alt_text_pro_run['can_undo'])): ?>
                            <button type="button" class="button-secondary-custom atp-btn-sm atp-btn-danger atp-run-undo"
                                data-count="<?php echo esc_attr((string) (intval($alt_text_pro_counts['generated']) + intval($alt_text_pro_counts['suggested']))); ?>">
                                <span class="dashicons dashicons-undo" aria-hidden="true"></span>
                                <span><?php esc_html_e('Undo this run', 'alt-text-pro'); ?></span>
                            </button>
                        <?php endif; ?>
                    </div>
                    <div class="atp-run-items" hidden></div>
                    <p class="atp-run-undo-status atp-log-meta" role="status" aria-live="polite"></p>
                </li>
            <?php endforeach; ?>
        </ul>
        <p class="description atp-help">
            <?php esc_html_e('Undo puts back the alt text each image had before the run. Images whose alt text was changed after the run keep the newer text. Undo uses no credits.', 'alt-text-pro'); ?>
        </p>
    </div>
</div>
