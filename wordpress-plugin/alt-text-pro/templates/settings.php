<?php
/**
 * Settings Template for Alt-Text AI
 */

if (!defined('ABSPATH')) {
    exit;
}

// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Only used for active menu highlighting
$alt_text_pro_current_page = isset($_GET['page']) ? sanitize_text_field(wp_unslash($_GET['page'])) : '';
?>

<div class="wrap alt-text-pro-settings">
    <!-- Notices Container -->
    <div class="alt-text-pro-notices-container">
        <?php do_action('alt_text_pro_render_notices'); ?>
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
                        <?php
// Check whether a valid API key is already stored without exposing it in the DOM.
$settings_handler = new AltTextPro_Settings();
$has_key = false;
if (!empty($settings['api_key'])) {
    $decrypted = $settings_handler->decrypt_api_key($settings['api_key']);
    if ($decrypted !== false && AltTextPro_API_Client::validate_api_key_format($decrypted)) {
        $has_key = true;
    }
    elseif (AltTextPro_API_Client::validate_api_key_format($settings['api_key'])) {
        $has_key = true;
    }
}
$api_key_placeholder = $has_key
    ? esc_attr__('Saved key hidden. Enter a new key to replace it.', 'alt-text-pro')
    : 'alt_...';
?>
                        <input type="password" id="api_key" name="alt_text_pro_settings[api_key]"
                            value="" placeholder="<?php echo $api_key_placeholder; ?>" autocomplete="off"
                            data-has-key="<?php echo esc_attr($has_key ? '1' : '0'); ?>" />

                        <button type="button" class="button-secondary-custom" id="test-connection">
                            <?php esc_html_e('Test', 'alt-text-pro'); ?>
                        </button>
                    </div>
                    <p class="description" style="margin-top: 8px; color: var(--text-secondary); font-size: 13px;">
                        <?php
echo wp_kses_post(
    sprintf(
    // translators: %s: URL to the Alt Text Pro dashboard
    __('Find your API key in your <a href="%1$s" target="_blank">Alt Text Pro dashboard</a>.', 'alt-text-pro'),
    esc_url('https://www.alt-text.pro/dashboard')
)
); ?>
                    </p>
                    <?php if ($has_key): ?>
                    <p class="description" style="margin-top: 8px; color: var(--text-secondary); font-size: 13px;">
                        <?php esc_html_e('An API key is already saved. Leave this blank to keep it, or paste a new key to replace it.', 'alt-text-pro'); ?>
                    </p>
                    <?php endif; ?>
                    <?php if (!$has_key): ?>
                    <p style="margin-top: 10px;">
                        <button type="button" class="button-secondary-custom open-modal"
                            data-modal="alt-text-pro-onboarding-modal"
                            onclick="var m=document.getElementById('alt-text-pro-onboarding-modal');if(m){m.classList.add('active');document.body.classList.add('modal-open');}">
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
                    <textarea id="blog_context" name="alt_text_pro_settings[blog_context]" rows="3"
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
                            value="<?php echo esc_attr($settings['batch_size']); ?>" min="1" max="50"
                            style="width: 100px;" />
                        <span style="color: var(--text-secondary);">
                            <?php esc_html_e('images per batch', 'alt-text-pro'); ?>
                        </span>
                    </div>
                    <p class="description" style="margin-top: 8px; color: var(--text-secondary); font-size: 13px;">
                        <?php esc_html_e('Lower this number if you experience timeouts during bulk processing.', 'alt-text-pro'); ?>
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
</div>

<!-- Onboarding modal -->
<div id="alt-text-pro-onboarding-modal" class="alt-text-pro-modal modal" aria-hidden="true">
    <div class="modal-overlay close-modal" tabindex="-1"></div>
    <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="alt-text-pro-onboarding-title">
        <button type="button" class="close-modal modal-close"
            aria-label="<?php esc_attr_e('Close', 'alt-text-pro'); ?>">&times;</button>

        <div class="modal-header">
            <h2 id="alt-text-pro-onboarding-title">
                <span class="dashicons dashicons-admin-network"
                    style="font-size: 24px; width: 24px; height: 24px; color: var(--primary-color); vertical-align: middle; margin-right: 8px;"></span>
                <?php esc_html_e('Connect Alt Text Pro', 'alt-text-pro'); ?>
            </h2>
            <p class="modal-subtitle">
                <?php esc_html_e('Connect your account to start generating AI-powered alt text.', 'alt-text-pro'); ?>
            </p>
        </div>

        <div class="modal-body">
            <!-- Connect account (recommended) -->
            <div class="onboarding-step">
                <div class="step-label" style="background: var(--primary-color); color: #fff;">
                    <?php esc_html_e('Recommended', 'alt-text-pro'); ?>
                </div>
                <p style="margin-bottom: 12px;">
                    <?php esc_html_e('Sign in or create a free account to automatically connect your plugin.', 'alt-text-pro'); ?>
                </p>
                <button type="button" class="button button-primary-custom wide" id="auto-connect-btn">
                    <span class="dashicons dashicons-admin-links"
                        style="margin-right: 6px; line-height: inherit;"></span>
                    <?php esc_html_e('Connect Account', 'alt-text-pro'); ?>
                </button>
                <div id="auto-connect-status" style="margin-top: 10px; display: none;"></div>
            </div>

            <div class="step-connector">
                <span>
                    <?php esc_html_e('or', 'alt-text-pro'); ?>
                </span>
            </div>

            <!-- Manual API Key entry (fallback) -->
            <div class="onboarding-step">
                <div class="step-label">
                    <?php esc_html_e('Manual', 'alt-text-pro'); ?>
                </div>
                <div class="onboarding-field">
                    <label for="onboarding_api_key">
                        <?php esc_html_e('Paste your API key', 'alt-text-pro'); ?>
                    </label>
                    <div class="input-wrapper">
                        <span class="dashicons dashicons-key input-icon"></span>
                        <input type="password" id="onboarding_api_key" placeholder="alt_..." autocomplete="off" />
                    </div>
                    <p class="description" style="margin-top: 6px; font-size: 12px; color: var(--text-secondary);">
                        <?php
echo wp_kses_post(
    sprintf(
    // translators: %s: URL to the Alt Text Pro dashboard
    __('Get your key from the <a href="%1$s" target="_blank">dashboard</a>.', 'alt-text-pro'),
    esc_url('https://www.alt-text.pro/dashboard')
)
); ?>
                    </p>
                </div>
                <div id="onboarding-message" class="onboarding-message" aria-live="polite"></div>
            </div>
        </div>

        <div class="modal-footer">
            <button type="button" class="button button-primary-custom wide" id="onboarding-save">
                <?php esc_html_e('Save API Key', 'alt-text-pro'); ?>
            </button>
            <button type="button" class="button button-link close-modal">
                <?php esc_html_e('I\'ll do this later', 'alt-text-pro'); ?>
            </button>
        </div>
    </div>
</div>
