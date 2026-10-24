<?php
/**
 * Shared notices container, page header and navigation for plugin pages.
 *
 * Optional variable: $alt_text_pro_extra_notices (callable) prints page-specific
 * notices inside the container.
 *
 * @package AltTextPro
 */

if (!defined('ABSPATH')) {
    exit;
}

// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Only used for active menu highlighting
$alt_text_pro_current_page = isset($_GET['page']) ? sanitize_text_field(wp_unslash($_GET['page'])) : '';
$alt_text_pro_nav_items = array(
    array('alt-text-pro', 'dashicons-dashboard', __('Dashboard', 'alt-text-pro'), 'manage_options'),
    array('alt-text-pro-bulk', 'dashicons-images-alt2', __('Bulk Process', 'alt-text-pro'), 'upload_files'),
    array('alt-text-pro-logs', 'dashicons-list-view', __('Logs', 'alt-text-pro'), 'manage_options'),
    array('alt-text-pro-settings', 'dashicons-admin-settings', __('Settings', 'alt-text-pro'), 'manage_options'),
);
?>
<!-- Notices Container. WordPress moves notices after .wp-header-end, which keeps them here. -->
<div class="alt-text-pro-notices-container">
    <hr class="wp-header-end">
    <?php do_action('alt_text_pro_render_notices'); ?>
    <?php
    if (isset($alt_text_pro_extra_notices) && is_callable($alt_text_pro_extra_notices)) {
        call_user_func($alt_text_pro_extra_notices);
    }
    ?>
</div>

<!-- Header & Navigation -->
<div class="alt-text-pro-header">
    <div class="alt-text-pro-logo">
        <img src="<?php echo esc_url(ALT_TEXT_PRO_PLUGIN_URL . 'assets/images/logo-mark.svg'); ?>" alt="" width="44" height="44" />
        <div class="alt-text-pro-brand">
            <h1><?php esc_html_e('Alt Text Pro', 'alt-text-pro'); ?></h1>
            <span class="alt-text-pro-version">v<?php echo esc_html(ALT_TEXT_PRO_VERSION); ?></span>
        </div>
    </div>
    <nav class="alt-text-pro-nav" aria-label="<?php esc_attr_e('Alt Text Pro', 'alt-text-pro'); ?>">
        <?php foreach ($alt_text_pro_nav_items as $alt_text_pro_nav_item): ?>
            <?php
            if (!current_user_can($alt_text_pro_nav_item[3])) {
                continue;
            }
            $alt_text_pro_is_active = $alt_text_pro_current_page === $alt_text_pro_nav_item[0];
            ?>
            <a href="<?php echo esc_url(admin_url('admin.php?page=' . $alt_text_pro_nav_item[0])); ?>"
                class="alt-text-pro-nav-item<?php echo esc_attr($alt_text_pro_is_active ? ' active' : ''); ?>"
                <?php if ($alt_text_pro_is_active): ?>aria-current="page"<?php endif; ?>>
                <span class="dashicons <?php echo esc_attr($alt_text_pro_nav_item[1]); ?>" aria-hidden="true"></span>
                <span><?php echo esc_html($alt_text_pro_nav_item[2]); ?></span>
            </a>
        <?php endforeach; ?>
    </nav>
</div>
