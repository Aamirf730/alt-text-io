<?php
/**
 * Bulk page: filters that narrow the run, "keep going in the background",
 * images waiting for review, and the cost estimate shown before Start.
 *
 * Variables from AltTextPro_Admin::bulk_process_page(): $pending_review,
 * $review_enabled.
 *
 * @package AltTextPro
 */

if (!defined('ABSPATH')) {
    exit;
}

$alt_text_pro_parent_types = AltTextPro_Bulk_Processor::get_parent_type_options();
$alt_text_pro_term_groups = AltTextPro_Bulk_Processor::get_term_filter_options();
?>
<details class="atp-subpanel atp-bulk-filters" id="bulk-filters">
    <summary><?php esc_html_e('Narrow the run', 'alt-text-pro'); ?> <span class="atp-choice-meta" id="bulk-filters-active"></span></summary>
    <p class="description atp-help"><?php esc_html_e('Filters apply to the counts above, the estimate, the "Selected" image list and the run itself.', 'alt-text-pro'); ?></p>
    <div class="atp-bulk-filter-grid">
        <div class="atp-field">
            <label class="atp-label" for="bulk-filter-date-from"><?php esc_html_e('Uploaded from', 'alt-text-pro'); ?></label>
            <input type="date" id="bulk-filter-date-from" class="atp-bulk-filter" data-filter="date_from">
        </div>
        <div class="atp-field">
            <label class="atp-label" for="bulk-filter-date-to"><?php esc_html_e('Uploaded to', 'alt-text-pro'); ?></label>
            <input type="date" id="bulk-filter-date-to" class="atp-bulk-filter" data-filter="date_to">
        </div>
        <div class="atp-field">
            <label class="atp-label" for="bulk-filter-parent-type"><?php esc_html_e('Attached to', 'alt-text-pro'); ?></label>
            <select id="bulk-filter-parent-type" class="atp-bulk-filter" data-filter="parent_type">
                <option value=""><?php esc_html_e('Any (or not attached)', 'alt-text-pro'); ?></option>
                <?php foreach ($alt_text_pro_parent_types as $alt_text_pro_type => $alt_text_pro_type_label): ?>
                    <option value="<?php echo esc_attr($alt_text_pro_type); ?>"><?php echo esc_html($alt_text_pro_type_label); ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="atp-field">
            <label class="atp-label" for="bulk-filter-term"><?php esc_html_e('Category of the post it is attached to', 'alt-text-pro'); ?></label>
            <select id="bulk-filter-term" class="atp-bulk-filter" data-filter="term">
                <option value=""><?php esc_html_e('Any category', 'alt-text-pro'); ?></option>
                <?php foreach ($alt_text_pro_term_groups as $alt_text_pro_group_label => $alt_text_pro_terms): ?>
                    <optgroup label="<?php echo esc_attr($alt_text_pro_group_label); ?>">
                        <?php foreach ($alt_text_pro_terms as $alt_text_pro_term_value => $alt_text_pro_term_name): ?>
                            <option value="<?php echo esc_attr($alt_text_pro_term_value); ?>"><?php echo esc_html($alt_text_pro_term_name); ?></option>
                        <?php endforeach; ?>
                    </optgroup>
                <?php endforeach; ?>
            </select>
        </div>
    </div>
    <p class="description atp-help"><?php esc_html_e('"Attached to" and category use the post an image was uploaded to (its parent in the Media Library).', 'alt-text-pro'); ?></p>
</details>

<div class="atp-subpanel atp-bulk-background">
    <label class="checkbox-group">
        <input type="checkbox" id="bulk_background" name="bulk_background" value="1">
        <span class="checkbox-label"><?php esc_html_e('Keep going in the background', 'alt-text-pro'); ?></span>
    </label>
    <p class="description atp-help">
        <?php esc_html_e('The run continues after you close this tab, a few images at a time, using WP-Cron. WP-Cron only runs when someone visits the site (or when your host runs it on a schedule), so on a quiet site the run can take longer or wait until the next visit. You can come back here to watch or stop it.', 'alt-text-pro'); ?>
    </p>
</div>

<?php if (!empty($pending_review) || !empty($review_enabled)): ?>
    <div class="atp-info-box">
        <span class="dashicons dashicons-visibility" aria-hidden="true"></span>
        <span>
            <?php
            if (!empty($pending_review)) {
                echo esc_html(sprintf(
                    /* translators: %s: number of images */
                    _n('%s image has suggested alt text waiting for review. It is not included in runs until you approve or reject it.', '%s images have suggested alt text waiting for review. They are not included in runs until you approve or reject them.', (int) $pending_review, 'alt-text-pro'),
                    number_format_i18n((int) $pending_review)
                ));
            } else {
                esc_html_e('"Review alt text before it goes live" is on: alt text from this run waits on the Review page until you approve it.', 'alt-text-pro');
            }
            ?>
        </span>
        <a href="<?php echo esc_url(admin_url('admin.php?page=' . AltTextPro_Review::PAGE_SLUG)); ?>" class="atp-upgrade-link"><?php esc_html_e('Open Review', 'alt-text-pro'); ?></a>
    </div>
<?php endif; ?>

<!-- Filled by bulk-tools.js: credits this run will use and how long it takes. -->
<div class="atp-info-box atp-bulk-estimate" id="bulk-estimate" role="status" aria-live="polite" style="display: none;">
    <span class="dashicons dashicons-calculator" aria-hidden="true"></span>
    <span id="bulk-estimate-text"></span>
</div>
