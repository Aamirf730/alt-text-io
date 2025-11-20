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

<script type="text/javascript">
jQuery(document).ready(function($) {
    // Existing JS logic for settings...
    // Test API connection
    $('#test-connection').on('click', function() {
        var $button = $(this);
        var $result = $('#connection-test-result');
        var apiKey = $('#api_key').val();
        
        if (!apiKey) {
            $result.html('<div class="notice notice-error inline"><p>' + altTextAI.strings.invalidKey + '</p></div>');
            return;
        }
        
        $button.prop('disabled', true).text('Testing...');
        $result.html('<div class="notice notice-info inline"><p>' + altTextAI.strings.generating + '</p></div>');
        
        $.ajax({
            url: altTextAI.ajaxUrl,
            type: 'POST',
            data: {
                action: 'alt_text_pro_test_connection',
                api_key: apiKey,
                nonce: altTextAI.nonce
            },
            success: function(response) {
                if (response.success) {
                    var userInfo = response.data.user_info;
                    var message = '<strong>' + response.data.message + '</strong>';
                    if (userInfo) {
                        message += ' (' + userInfo.plan + ', ' + userInfo.credits_remaining + ' credits)';
                    }
                    $result.html('<div class="notice notice-success inline"><p>' + message + '</p></div>');
                } else {
                    $result.html('<div class="notice notice-error inline"><p>' + response.data + '</p></div>');
                }
            },
            error: function() {
                $result.html('<div class="notice notice-error inline"><p><?php echo esc_js(__('Connection test failed', 'alt-text-pro')); ?></p></div>');
            },
            complete: function() {
                $button.prop('disabled', false).text('<?php echo esc_js(__('Test', 'alt-text-pro')); ?>');
            }
        });
    });

    // Export/Import logic (simplified from original file but functionality preserved)
    $('#export-settings').on('click', function() {
        var settings = {
            version: '<?php echo esc_js(ALT_TEXT_PRO_VERSION); ?>',
            exported_at: new Date().toISOString(),
            settings: {
                api_key: $('#api_key').val() ? '[CONFIGURED]' : '[NOT_CONFIGURED]',
                auto_generate: $('#auto_generate').is(':checked'),
                overwrite_existing: $('#overwrite_existing').is(':checked'),
                context_enabled: $('#context_enabled').is(':checked'),
                batch_size: parseInt($('#batch_size').val())
            }
        };
        var dataStr = JSON.stringify(settings, null, 2);
        var dataBlob = new Blob([dataStr], {type: 'application/json'});
        var url = URL.createObjectURL(dataBlob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'alt-text-pro-settings.json';
        link.click();
    });

    $('#import-settings').on('click', function() {
        $('#import-file').click();
    });

    $('#import-file').on('change', function(e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(e) {
            try {
                var settings = JSON.parse(e.target.result);
                if (settings.settings) {
                    if (settings.settings.auto_generate !== undefined) $('#auto_generate').prop('checked', settings.settings.auto_generate);
                    if (settings.settings.overwrite_existing !== undefined) $('#overwrite_existing').prop('checked', settings.settings.overwrite_existing);
                    if (settings.settings.context_enabled !== undefined) $('#context_enabled').prop('checked', settings.settings.context_enabled);
                    if (settings.settings.batch_size !== undefined) $('#batch_size').val(settings.settings.batch_size);
                    alert('<?php echo esc_js(__('Settings imported! Please save to apply.', 'alt-text-pro')); ?>');
                }
            } catch (error) {
                alert('<?php echo esc_js(__('Invalid file.', 'alt-text-pro')); ?>');
            }
        };
        reader.readAsText(file);
    });
});
</script>
