<?php
/**
 * Review page: suggested alt text waiting for approval.
 *
 * Variables: $items, $total, $current_page, $total_pages, $review_enabled,
 * $replacing_total.
 */

if (!defined('ABSPATH')) {
    exit;
}

$alt_text_pro_source_labels = array(
    'bulk' => __('Bulk run', 'alt-text-pro'),
    'upload' => __('Upload', 'alt-text-pro'),
    'post' => __('Posts list', 'alt-text-pro'),
);
$alt_text_pro_replacing = 0;
foreach ($items as $alt_text_pro_item) {
    if (trim($alt_text_pro_item['current_alt']) !== '') {
        $alt_text_pro_replacing++;
    }
}
?>

<div class="wrap alt-text-pro-review atp-ui">
    <?php require ALT_TEXT_PRO_PLUGIN_PATH . 'templates/partials/header.php'; ?>

    <div class="alt-text-pro-card">
        <div class="card-header">
            <h3><?php esc_html_e('Review alt text', 'alt-text-pro'); ?></h3>
            <?php if ($total > 0): ?>
                <div class="atp-actions">
                    <button type="button" class="button-primary-custom atp-btn-sm" id="atp-review-approve-all"
                        data-total="<?php echo esc_attr((string) $total); ?>"
                        data-replacing="<?php echo esc_attr((string) $replacing_total); ?>">
                        <span class="dashicons dashicons-yes" aria-hidden="true"></span>
                        <span><?php esc_html_e('Approve all', 'alt-text-pro'); ?></span>
                    </button>
                </div>
            <?php endif; ?>
        </div>
        <div class="card-content">
            <p class="description atp-help">
                <?php
                echo esc_html($review_enabled
                    ? __('"Review alt text before it goes live" is on. Alt text from bulk runs, uploads and the Posts list waits here until you approve it. Images waiting here are not generated (or billed) again.', 'alt-text-pro')
                    : __('"Review alt text before it goes live" is off, so new alt text is saved straight away. Suggestions made while it was on are still listed here.', 'alt-text-pro'));
                ?>
                <?php if (current_user_can('manage_options')): ?>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-pro-settings')); ?>"><?php esc_html_e('Change in Settings', 'alt-text-pro'); ?></a>
                <?php endif; ?>
            </p>

            <p id="atp-review-status" class="atp-review-status" role="status" aria-live="polite">
                <?php
                echo esc_html(sprintf(
                    /* translators: %s: number of suggestions */
                    _n('%s suggestion is waiting for review.', '%s suggestions are waiting for review.', $total, 'alt-text-pro'),
                    number_format_i18n($total)
                ));
                ?>
            </p>

            <?php if (!empty($items)): ?>
                <div class="logs-table-wrapper">
                    <table class="widefat striped atp-review-table">
                        <thead>
                            <tr>
                                <th class="col-image"><?php esc_html_e('Image', 'alt-text-pro'); ?></th>
                                <th><?php esc_html_e('Current alt text', 'alt-text-pro'); ?></th>
                                <th><?php esc_html_e('Suggested alt text', 'alt-text-pro'); ?></th>
                                <th class="col-actions"><?php esc_html_e('Actions', 'alt-text-pro'); ?></th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($items as $alt_text_pro_item): ?>
                                <tr class="atp-review-row" data-attachment-id="<?php echo esc_attr((string) $alt_text_pro_item['id']); ?>">
                                    <td>
                                        <?php if ($alt_text_pro_item['thumb'] !== ''): ?>
                                            <img src="<?php echo esc_url($alt_text_pro_item['thumb']); ?>" class="image-preview-small" alt="">
                                        <?php else: ?>
                                            <div class="image-preview-small"><span class="dashicons dashicons-format-image" aria-hidden="true"></span></div>
                                        <?php endif; ?>
                                    </td>
                                    <td>
                                        <strong class="atp-log-title">
                                            <a href="<?php echo esc_url((string) get_edit_post_link($alt_text_pro_item['id'])); ?>"><?php echo esc_html($alt_text_pro_item['title'] !== '' ? $alt_text_pro_item['title'] : sprintf(
                                                /* translators: %d: attachment ID */
                                                __('Image #%d', 'alt-text-pro'),
                                                $alt_text_pro_item['id']
                                            )); ?></a>
                                        </strong>
                                        <?php if (trim($alt_text_pro_item['current_alt']) !== ''): ?>
                                            <p class="atp-log-alt"><?php echo esc_html($alt_text_pro_item['current_alt']); ?></p>
                                        <?php else: ?>
                                            <p class="atp-log-alt atp-muted"><?php esc_html_e('No alt text yet', 'alt-text-pro'); ?></p>
                                        <?php endif; ?>
                                        <span class="atp-log-meta">
                                            <?php echo esc_html($alt_text_pro_source_labels[$alt_text_pro_item['source']] ?? ''); ?>
                                        </span>
                                    </td>
                                    <td>
                                        <label class="screen-reader-text" for="atp-suggestion-<?php echo esc_attr((string) $alt_text_pro_item['id']); ?>"><?php esc_html_e('Suggested alt text', 'alt-text-pro'); ?></label>
                                        <textarea id="atp-suggestion-<?php echo esc_attr((string) $alt_text_pro_item['id']); ?>" class="atp-review-text" rows="3"
                                            data-original="<?php echo esc_attr($alt_text_pro_item['suggested_alt']); ?>"><?php echo esc_textarea($alt_text_pro_item['suggested_alt']); ?></textarea>
                                    </td>
                                    <td>
                                        <div class="atp-actions">
                                            <button type="button" class="button-primary-custom atp-btn-sm atp-review-approve">
                                                <span class="dashicons dashicons-yes" aria-hidden="true"></span>
                                                <span><?php esc_html_e('Approve', 'alt-text-pro'); ?></span>
                                            </button>
                                            <button type="button" class="button-secondary-custom atp-btn-sm atp-review-reject">
                                                <span class="dashicons dashicons-no-alt" aria-hidden="true"></span>
                                                <span><?php esc_html_e('Reject', 'alt-text-pro'); ?></span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>

                <?php if ($alt_text_pro_replacing > 0): ?>
                    <p class="description atp-help">
                        <?php esc_html_e('Approving replaces the current alt text. Approved bulk-run alt text can still be undone from Recent runs on the Bulk page.', 'alt-text-pro'); ?>
                    </p>
                <?php endif; ?>

                <?php if ($total_pages > 1): ?>
                    <div class="atp-pagination">
                        <div>
                            <?php
                            // translators: %1$d: Current page number, %2$d: Total number of pages
                            printf(esc_html__('Page %1$d of %2$d', 'alt-text-pro'), esc_html((string) $current_page), esc_html((string) $total_pages));
                            ?>
                        </div>
                        <div class="atp-actions">
                            <?php
                            $alt_text_pro_base_url = admin_url('admin.php?page=' . AltTextPro_Review::PAGE_SLUG);
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
                    <span class="atp-icon-chip is-lg" aria-hidden="true"><span class="dashicons dashicons-yes-alt"></span></span>
                    <h3><?php esc_html_e('Nothing to review', 'alt-text-pro'); ?></h3>
                    <p><?php esc_html_e('Suggested alt text appears here when "Review alt text before it goes live" is on.', 'alt-text-pro'); ?></p>
                </div>
            <?php endif; ?>
        </div>
    </div>
</div>
