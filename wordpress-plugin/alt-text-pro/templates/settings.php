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
    <!-- Header & Navigation -->
    <div class="alt-text-pro-header">
        <div class="alt-text-pro-logo">
            <img src="<?php echo esc_url(ALT_TEXT_PRO_PLUGIN_URL . 'assets/images/logo-alt-text-pro.png'); ?>" alt="Alt Text Pro" />
            <div>
                <h1><?php esc_html_e('Alt Text Pro', 'alt-text-pro'); ?></h1>
                <span style="color: var(--text-secondary); font-size: 13px;">v<?php echo esc_html(ALT_TEXT_PRO_VERSION); ?></span>
            </div>
        </div>
        <div class="alt-text-pro-nav">
            <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-pro')); ?>" class="alt-text-pro-nav-item <?php echo esc_attr($alt_text_pro_current_page === 'alt-text-pro' ? 'active' : ''); ?>">
                <span class="dashicons dashicons-dashboard"></span>
                <?php esc_html_e('Dashboard', 'alt-text-pro'); ?>
            </a>
            <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-pro-bulk')); ?>" class="alt-text-pro-nav-item <?php echo esc_attr($alt_text_pro_current_page === 'alt-text-pro-bulk' ? 'active' : ''); ?>">
                <span class="dashicons dashicons-images-alt2"></span>
                <?php esc_html_e('Bulk Process', 'alt-text-pro'); ?>
            </a>
            <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-pro-logs')); ?>" class="alt-text-pro-nav-item <?php echo esc_attr($alt_text_pro_current_page === 'alt-text-pro-logs' ? 'active' : ''); ?>">
                <span class="dashicons dashicons-list-view"></span>
                <?php esc_html_e('Logs', 'alt-text-pro'); ?>
            </a>
            <a href="<?php echo esc_url(admin_url('admin.php?page=alt-text-pro-settings')); ?>" class="alt-text-pro-nav-item <?php echo esc_attr($alt_text_pro_current_page === 'alt-text-pro-settings' ? 'active' : ''); ?>">
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
                <h3><?php esc_html_e('API Configuration', 'alt-text-pro'); ?></h3>
            </div>
            <div class="card-content">
                <div class="settings-field" style="margin-bottom: 24px;">
                    <label for="api_key" class="field-label" style="display: block; margin-bottom: 8px; font-weight: 600;">
                        <?php esc_html_e('API Key', 'alt-text-pro'); ?> <span style="color: var(--danger-color);">*</span>
                    </label>
                    <div style="display: flex; gap: 8px; align-items: center; max-width: 600px;">
                        <input type="password" 
                               id="api_key" 
                               name="alt_text_pro_settings[api_key]" 
                               value="<?php echo esc_attr($settings['api_key']); ?>" 
                               placeholder="alt_..." 
                               autocomplete="off" />
                        
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
                    <?php if (empty($settings['api_key'])): ?>
                        <p style="margin-top: 10px;">
                            <button type="button" class="button-secondary-custom open-modal" data-modal="alt-text-pro-onboarding-modal">
                                <?php esc_html_e('Start onboarding', 'alt-text-pro'); ?>
                            </button>
                        </p>
                    <?php endif; ?>
                    <div id="connection-test-result" style="margin-top: 12px;"></div>
                </div>
            </div>
        </div>

        <div class="alt-text-pro-card">
            <div class="card-header">
                <h3><?php esc_html_e('Generation Preferences', 'alt-text-pro'); ?></h3>
            </div>
            <div class="card-content">
                <div class="settings-field">
                    <label class="checkbox-group">
                        <input type="checkbox" 
                               id="auto_generate" 
                               name="alt_text_pro_settings[auto_generate]" 
                               value="1" 
                               <?php checked(1, $settings['auto_generate']); ?> />
                        <span class="checkbox-label"><?php esc_html_e('Auto-generate on upload', 'alt-text-pro'); ?></span>
                    </label>
                    <p class="checkbox-desc">
                        <?php esc_html_e('Automatically generate alt-text when you upload new images to the Media Library.', 'alt-text-pro'); ?>
                    </p>
                </div>

                <div class="settings-field">
                    <label class="checkbox-group">
                        <input type="checkbox" 
                               id="overwrite_existing" 
                               name="alt_text_pro_settings[overwrite_existing]" 
                               value="1" 
                               <?php checked(1, $settings['overwrite_existing']); ?> />
                        <span class="checkbox-label"><?php esc_html_e('Overwrite existing alt-text', 'alt-text-pro'); ?></span>
                    </label>
                    <p class="checkbox-desc">
                        <?php esc_html_e('If enabled, existing alt text will be replaced when you regenerate. If disabled, images with existing alt text will be skipped during bulk processing.', 'alt-text-pro'); ?>
                    </p>
                </div>

                <div class="settings-field">
                    <label class="checkbox-group">
                        <input type="checkbox" 
                               id="context_enabled" 
                               name="alt_text_pro_settings[context_enabled]" 
                               value="1" 
                               <?php checked(1, $settings['context_enabled']); ?> />
                        <span class="checkbox-label"><?php esc_html_e('Enable Context Field', 'alt-text-pro'); ?></span>
                    </label>
                    <p class="checkbox-desc">
                        <?php esc_html_e('Show a context input field in the media editor to provide hints for generation (e.g., "Product shot", "Team photo").', 'alt-text-pro'); ?>
                    </p>
                </div>
            </div>
        </div>

        <div class="alt-text-pro-card">
            <div class="card-header">
                <h3><?php esc_html_e('Advanced Settings', 'alt-text-pro'); ?></h3>
            </div>
            <div class="card-content">
                <div class="settings-field">
                    <label for="batch_size" class="field-label" style="display: block; margin-bottom: 8px; font-weight: 600;">
                        <?php esc_html_e('Bulk Batch Size', 'alt-text-pro'); ?>
                    </label>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="number" 
                               id="batch_size" 
                               name="alt_text_pro_settings[batch_size]" 
                               value="<?php echo esc_attr($settings['batch_size']); ?>" 
                               min="1" 
                               max="50" 
                               style="width: 100px;" />
                        <span style="color: var(--text-secondary);"><?php esc_html_e('images per batch', 'alt-text-pro'); ?></span>
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
        <button type="button" class="close-modal modal-close" aria-label="<?php esc_attr_e('Close', 'alt-text-pro'); ?>">&times;</button>

        <div class="modal-header">
            <h2 id="alt-text-pro-onboarding-title">
                <span class="dashicons dashicons-admin-network" style="font-size: 24px; width: 24px; height: 24px; color: var(--primary-color); vertical-align: middle; margin-right: 8px;"></span>
                <?php esc_html_e('Connect Alt Text Pro', 'alt-text-pro'); ?>
            </h2>
            <p class="modal-subtitle"><?php esc_html_e('Unlock AI-powered alt text generation for your media library.', 'alt-text-pro'); ?></p>
        </div>

        <div class="modal-body">
            <div class="onboarding-step">
                <div class="step-label"><?php esc_html_e('Step 1', 'alt-text-pro'); ?></div>
                <p><?php esc_html_e('Get your API key from the dashboard.', 'alt-text-pro'); ?></p>
                <a class="button button-secondary-custom wide" href="https://www.alt-text.pro/dashboard" target="_blank" rel="noreferrer">
                    <span class="dashicons dashicons-external"></span>
                    <?php esc_html_e('Get API Key', 'alt-text-pro'); ?>
                </a>
            </div>

            <div class="step-connector">
                <span><?php esc_html_e('then', 'alt-text-pro'); ?></span>
            </div>

            <div class="onboarding-step">
                <div class="step-label"><?php esc_html_e('Step 2', 'alt-text-pro'); ?></div>
                <div class="onboarding-field">
                    <label for="onboarding_api_key"><?php esc_html_e('Paste your API key below', 'alt-text-pro'); ?></label>
                    <div class="input-wrapper">
                        <span class="dashicons dashicons-key input-icon"></span>
                        <input type="password" id="onboarding_api_key" placeholder="alt_..." autocomplete="off" />
                    </div>
                </div>
                <div id="onboarding-message" class="onboarding-message" aria-live="polite"></div>
            </div>
        </div>

        <div class="modal-footer">
            <button type="button" class="button button-primary-custom wide" id="onboarding-save">
                <?php esc_html_e('Connect & Save', 'alt-text-pro'); ?>
            </button>
            <button type="button" class="button button-link close-modal"><?php esc_html_e('I\'ll do this later', 'alt-text-pro'); ?></button>
        </div>
    </div>
</div>
