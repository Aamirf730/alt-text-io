<?php
/**
 * Settings Template for Alt-Text AI
 */

if (!defined('ABSPATH')) {
    exit;
}

// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Only used for active menu highlighting
$alt_text_pro_current_page = isset($_GET['page']) ? sanitize_text_field(wp_unslash($_GET['page'])) : '';
$alt_text_pro_settings_handler = new AltTextPro_Settings();
$alt_text_pro_usable_settings = $alt_text_pro_settings_handler->get_settings();
$alt_text_pro_has_key = !empty($alt_text_pro_usable_settings['api_key'])
    && AltTextPro_API_Client::validate_api_key_format($alt_text_pro_usable_settings['api_key']);
$alt_text_pro_api_key_placeholder = $alt_text_pro_has_key
    ? esc_attr__('Saved key hidden. Enter a new key to replace it.', 'alt-text-pro')
    : 'alt_...';
// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only flag set by the nonce-checked disconnect redirect
$alt_text_pro_disconnected = isset($_GET['alt_text_pro_disconnected']) ? sanitize_key(wp_unslash($_GET['alt_text_pro_disconnected'])) : '';
?>

<div class="wrap alt-text-pro-settings">
    <!-- Notices Container -->
    <div class="alt-text-pro-notices-container">
        <?php do_action('alt_text_pro_render_notices'); ?>
        <?php
        // Plugin pages suppress other admin notices, so show this form's own
        // results (saved, invalid or rejected key, encryption failure) here.
        // options.php records "Settings saved." under 'general', so show all.
        settings_errors();
        ?>
        <?php if ($alt_text_pro_disconnected === '1'): ?>
        <div class="notice notice-success"><p>
            <?php esc_html_e('Your Alt Text Pro account was disconnected from this site. The API key was removed.', 'alt-text-pro'); ?>
        </p></div>
        <?php elseif ($alt_text_pro_disconnected === '0'): ?>
        <div class="notice notice-error"><p>
            <?php esc_html_e('The API key could not be removed. Please try again.', 'alt-text-pro'); ?>
        </p></div>
        <?php endif; ?>
    </div>

    <!-- Header & Navigation -->
    <div class="alt-text-pro-header">
        <div class="alt-text-pro-logo">
            <img src="<?php echo esc_url(ALT_TEXT_PRO_PLUGIN_URL . 'assets/images/logo-alt-text-pro.png'); ?>"
                alt="Alt Text Pro" />
            <div>
                <h1>
                    <?php esc_html_e('Alt Text Pro', 'alt-text-pro'); ?>
                </h1>
                <span style="color: var(--text-secondary); font-size: 13px;">v
                    <?php echo esc_html(ALT_TEXT_PRO_VERSION); ?>
                </span>
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

    <form method="post" action="options.php" class="alt-text-pro-settings-form">
        <?php
settings_fields('alt_text_pro_settings');
// Note: We use custom HTML fields below
?>

        <div class="alt-text-pro-card">
            <div class="card-header">
                <h3>
                    <?php esc_html_e('API Configuration', 'alt-text-pro'); ?>
                </h3>
            </div>
            <div class="card-content">
                <div class="settings-field" style="margin-bottom: 24px;">
                    <label for="api_key" class="field-label"
                        style="display: block; margin-bottom: 8px; font-weight: 600;">
                        <?php esc_html_e('API Key', 'alt-text-pro'); ?> <span
                            style="color: var(--danger-color);">*</span>
                    </label>
                    <div style="display: flex; gap: 8px; align-items: center; max-width: 600px;">
                        <input type="password" id="api_key" name="alt_text_pro_settings[api_key]"
                            value="" placeholder="<?php echo esc_attr($alt_text_pro_api_key_placeholder); ?>" autocomplete="off"
                            data-has-key="<?php echo esc_attr($alt_text_pro_has_key ? '1' : '0'); ?>" />

                        <button type="button" class="button-secondary-custom" id="test-connection">
                            <?php esc_html_e('Test', 'alt-text-pro'); ?>
                        </button>
                    </div>
                    <p class="description" style="margin-top: 8px; color: var(--text-secondary); font-size: 13px;">
                        <?php
echo wp_kses_post(
    sprintf(
    // translators: %s: URL to the Alt Text Pro dashboard
    __('Find your API key in your <a href="%1$s" target="_blank" rel="noopener noreferrer">Alt Text Pro dashboard</a>.', 'alt-text-pro'),
    esc_url('https://www.alt-text.pro/dashboard')
)
); ?>
                    </p>
                    <?php if ($alt_text_pro_has_key): ?>
                    <p class="description" style="margin-top: 8px; color: var(--text-secondary); font-size: 13px;">
                        <?php esc_html_e('An API key is already saved. Leave this blank to keep it, or paste a new key to replace it.', 'alt-text-pro'); ?>
                    </p>
                    <?php endif; ?>
                    <?php if ($alt_text_pro_has_key || !empty($settings['api_key'])): ?>
                    <p style="margin-top: 10px;">
                        <!-- Submits the separate disconnect form below; forms cannot be nested. -->
                        <button type="submit" class="button-secondary-custom" id="alt-text-pro-disconnect"
                            form="alt-text-pro-disconnect-form"
                            data-confirm="<?php esc_attr_e('Disconnect your Alt Text Pro account from this site? The saved API key will be removed. Alt text already generated stays on your images.', 'alt-text-pro'); ?>">
                            <span class="dashicons dashicons-dismiss"></span>
                            <?php esc_html_e('Disconnect account', 'alt-text-pro'); ?>
                        </button>
                    </p>
                    <?php endif; ?>
                    <?php if (!$alt_text_pro_has_key): ?>
                    <p style="margin-top: 10px;">
                        <button type="button" class="button-secondary-custom open-modal"
                            data-modal="alt-text-pro-onboarding-modal">
                            <?php esc_html_e('Start onboarding', 'alt-text-pro'); ?>
                        </button>
                    </p>
                    <?php
endif; ?>
                    <div id="connection-test-result" style="margin-top: 12px;"></div>
                </div>
            </div>
        </div>

        <div class="alt-text-pro-card">
            <div class="card-header">
                <h3>
                    <?php esc_html_e('Generation Preferences', 'alt-text-pro'); ?>
                </h3>
            </div>
            <div class="card-content">
                <div class="settings-field">
                    <label class="checkbox-group">
                        <input type="hidden" name="alt_text_pro_settings[auto_generate]" value="0" />
                        <input type="checkbox" id="auto_generate" name="alt_text_pro_settings[auto_generate]" value="1"
                            <?php checked(1, $settings['auto_generate']); ?> />
                        <span class="checkbox-label">
                            <?php esc_html_e('Auto-generate on upload', 'alt-text-pro'); ?>
                        </span>
                    </label>
                    <p class="checkbox-desc">
                        <?php esc_html_e('Automatically generate alt-text when you upload new images to the Media Library.', 'alt-text-pro'); ?>
                    </p>
                </div>

                <div class="settings-field">
                    <label class="checkbox-group">
                        <input type="hidden" name="alt_text_pro_settings[overwrite_existing]" value="0" />
                        <input type="checkbox" id="overwrite_existing" name="alt_text_pro_settings[overwrite_existing]"
                            value="1" <?php checked(1, $settings['overwrite_existing']); ?> />
                        <span class="checkbox-label">
                            <?php esc_html_e('Overwrite existing alt-text', 'alt-text-pro'); ?>
                        </span>
                    </label>
                    <p class="checkbox-desc">
                        <?php esc_html_e('If enabled, existing alt text will be replaced when you regenerate. If disabled, images with existing alt text will be skipped during bulk processing.', 'alt-text-pro'); ?>
                    </p>
                </div>

                <div class="settings-field">
                    <label class="checkbox-group">
                        <input type="hidden" name="alt_text_pro_settings[show_context_field]" value="0" />
                        <input type="checkbox" id="show_context_field" name="alt_text_pro_settings[show_context_field]"
                            value="1" <?php checked(1, $settings['show_context_field'] ?? false); ?> />
                        <span class="checkbox-label">
                            <?php esc_html_e('Show Context Field on Images', 'alt-text-pro'); ?>
                        </span>
                    </label>
                    <p class="checkbox-desc">
                        <?php esc_html_e('When enabled, displays a context input field on individual image edit pages where you can add specific context for each image.', 'alt-text-pro'); ?>
                    </p>
                </div>
            </div>
        </div>

        <div class="alt-text-pro-card">
            <div class="card-header">
                <h3>
                    <?php esc_html_e('Context Settings', 'alt-text-pro'); ?>
                </h3>
            </div>
            <div class="card-content">
                <div class="settings-field" style="margin-bottom: 24px;">
                    <label for="blog_context" class="field-label"
                        style="display: block; margin-bottom: 8px; font-weight: 600;">
                        <?php esc_html_e('Blog Context', 'alt-text-pro'); ?>
                    </label>
                    <textarea id="blog_context" name="alt_text_pro_settings[blog_context]" rows="3" maxlength="500"
                        style="width: 100%; max-width: 600px;"
                        placeholder="<?php esc_attr_e('e.g., travel blog about New Zealand, food blog focusing on Italian cuisine', 'alt-text-pro'); ?>"><?php echo esc_textarea($settings['blog_context'] ?? ''); ?></textarea>
                    <p class="description" style="margin-top: 8px; color: var(--text-secondary); font-size: 13px;">
                        <?php esc_html_e('Provide general context about your blog to help AI generate more relevant alt text. This context will be included with every image generation request.', 'alt-text-pro'); ?>
                    </p>
                </div>
            </div>
        </div>

        <div class="alt-text-pro-card">
            <div class="card-header">
                <h3>
                    <?php esc_html_e('Advanced Settings', 'alt-text-pro'); ?>
                </h3>
            </div>
            <div class="card-content">
                <div class="settings-field">
                    <label for="batch_size" class="field-label"
                        style="display: block; margin-bottom: 8px; font-weight: 600;">
                        <?php esc_html_e('Bulk Batch Size', 'alt-text-pro'); ?>
                    </label>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="number" id="batch_size" name="alt_text_pro_settings[batch_size]"
                            value="<?php echo esc_attr($settings['batch_size']); ?>" min="1" max="10"
                            style="width: 100px;" />
                        <span style="color: var(--text-secondary);">
                            <?php esc_html_e('images per batch', 'alt-text-pro'); ?>
                        </span>
                    </div>
                    <p class="description" style="margin-top: 8px; color: var(--text-secondary); font-size: 13px;">
                        <?php esc_html_e('For credit-accurate cancellation, bulk processing runs one billable image at a time even if an older saved value is higher.', 'alt-text-pro'); ?>
                    </p>
                </div>
            </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 24px;">
            <div>
                <?php submit_button(esc_html__('Save Settings', 'alt-text-pro'), 'primary button-primary-custom', 'submit', false); ?>
            </div>
            <div style="display: flex; gap: 12px;">
                <button type="button" class="button-secondary-custom" id="export-settings">
                    <span class="dashicons dashicons-download"></span>
                    <?php esc_html_e('Export', 'alt-text-pro'); ?>
                </button>
                <button type="button" class="button-secondary-custom" id="import-settings">
                    <span class="dashicons dashicons-upload"></span>
                    <?php esc_html_e('Import', 'alt-text-pro'); ?>
                </button>
                <input type="file" id="import-file" accept=".json" style="display: none;">
            </div>
        </div>
    </form>

    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" id="alt-text-pro-disconnect-form" style="display: none;">
        <input type="hidden" name="action" value="alt_text_pro_disconnect" />
        <?php wp_nonce_field('alt_text_pro_disconnect', 'alt_text_pro_disconnect_nonce', false); ?>
    </form>
</div>

<?php require ALT_TEXT_PRO_PLUGIN_PATH . 'templates/onboarding-modal.php'; ?>
