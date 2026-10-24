<?php
/**
 * Settings Template for Alt-Text AI
 */

if (!defined('ABSPATH')) {
    exit;
}

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

<div class="wrap alt-text-pro-settings atp-ui">
    <?php
    // Plugin pages suppress other admin notices, so show this form's own
    // results (saved, invalid or rejected key, encryption failure) inside the
    // header's notices container. options.php records "Settings saved." under
    // 'general', so show all.
    $alt_text_pro_extra_notices = function () use ($alt_text_pro_disconnected) {
        settings_errors();
        if ($alt_text_pro_disconnected === '1') {
            echo '<div class="notice notice-success"><p>' . esc_html__('Your Alt Text Pro account was disconnected from this site. The API key was removed.', 'alt-text-pro') . '</p></div>';
        } elseif ($alt_text_pro_disconnected === '0') {
            echo '<div class="notice notice-error"><p>' . esc_html__('The API key could not be removed. Please try again.', 'alt-text-pro') . '</p></div>';
        }
    };
    require ALT_TEXT_PRO_PLUGIN_PATH . 'templates/partials/header.php';
    ?>

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
                <div class="settings-field atp-field">
                    <label for="api_key" class="field-label atp-label">
                        <?php esc_html_e('API Key', 'alt-text-pro'); ?> <span class="atp-required" aria-hidden="true">*</span>
                    </label>
                    <div class="atp-input-row">
                        <input type="password" id="api_key" name="alt_text_pro_settings[api_key]"
                            value="" placeholder="<?php echo esc_attr($alt_text_pro_api_key_placeholder); ?>" autocomplete="off"
                            data-has-key="<?php echo esc_attr($alt_text_pro_has_key ? '1' : '0'); ?>" />

                        <button type="button" class="button-secondary-custom" id="test-connection">
                            <span class="dashicons dashicons-admin-plugins" aria-hidden="true"></span>
                            <span><?php esc_html_e('Test', 'alt-text-pro'); ?></span>
                        </button>
                    </div>
                    <p class="description atp-help">
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
                    <p class="description atp-help">
                        <?php esc_html_e('An API key is already saved. Leave this blank to keep it, or paste a new key to replace it.', 'alt-text-pro'); ?>
                    </p>
                    <?php endif; ?>
                    <div class="atp-actions atp-field-actions">
                    <?php if ($alt_text_pro_has_key || !empty($settings['api_key'])): ?>
                        <!-- Submits the separate disconnect form below; forms cannot be nested. -->
                        <button type="submit" class="button-secondary-custom atp-btn-danger" id="alt-text-pro-disconnect"
                            form="alt-text-pro-disconnect-form"
                            data-confirm="<?php esc_attr_e('Disconnect your Alt Text Pro account from this site? The saved API key will be removed. Alt text already generated stays on your images.', 'alt-text-pro'); ?>">
                            <span class="dashicons dashicons-dismiss" aria-hidden="true"></span>
                            <span><?php esc_html_e('Disconnect account', 'alt-text-pro'); ?></span>
                        </button>
                    <?php endif; ?>
                    <?php if (!$alt_text_pro_has_key): ?>
                        <button type="button" class="button-secondary-custom open-modal"
                            data-modal="alt-text-pro-onboarding-modal">
                            <span class="dashicons dashicons-admin-links" aria-hidden="true"></span>
                            <span><?php esc_html_e('Start onboarding', 'alt-text-pro'); ?></span>
                        </button>
                    <?php
endif; ?>
                    </div>
                    <div id="connection-test-result" aria-live="polite"></div>
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
                <div class="settings-field atp-field">
                    <label for="blog_context" class="field-label atp-label">
                        <?php esc_html_e('Blog Context', 'alt-text-pro'); ?>
                    </label>
                    <textarea id="blog_context" name="alt_text_pro_settings[blog_context]" rows="3" maxlength="500"
                        placeholder="<?php esc_attr_e('e.g., travel blog about New Zealand, food blog focusing on Italian cuisine', 'alt-text-pro'); ?>"><?php echo esc_textarea($settings['blog_context'] ?? ''); ?></textarea>
                    <p class="description atp-help">
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
                <div class="settings-field atp-field">
                    <label for="batch_size" class="field-label atp-label">
                        <?php esc_html_e('Bulk Batch Size', 'alt-text-pro'); ?>
                    </label>
                    <div class="atp-input-row">
                        <input type="number" id="batch_size" name="alt_text_pro_settings[batch_size]" class="atp-input-number"
                            value="<?php echo esc_attr($settings['batch_size']); ?>" min="1" max="10" />
                        <span class="atp-muted">
                            <?php esc_html_e('images per batch', 'alt-text-pro'); ?>
                        </span>
                    </div>
                    <p class="description atp-help">
                        <?php esc_html_e('For credit-accurate cancellation, bulk processing runs one billable image at a time even if an older saved value is higher.', 'alt-text-pro'); ?>
                    </p>
                </div>
            </div>
        </div>

        <div class="atp-form-actions">
            <?php submit_button(esc_html__('Save Settings', 'alt-text-pro'), 'button-primary-custom', 'submit', false); ?>
            <div class="atp-actions is-stack">
                <button type="button" class="button-secondary-custom" id="export-settings">
                    <span class="dashicons dashicons-download" aria-hidden="true"></span>
                    <span><?php esc_html_e('Export', 'alt-text-pro'); ?></span>
                </button>
                <button type="button" class="button-secondary-custom" id="import-settings">
                    <span class="dashicons dashicons-upload" aria-hidden="true"></span>
                    <span><?php esc_html_e('Import', 'alt-text-pro'); ?></span>
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
