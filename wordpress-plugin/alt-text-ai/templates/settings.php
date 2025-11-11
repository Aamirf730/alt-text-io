<?php
/**
 * Settings Template for Alt-Text AI
 */

if (!defined('ABSPATH')) {
    exit;
}
?>

<div class="wrap alt-text-ai-settings">
    <div class="alt-text-ai-header">
        <div class="alt-text-ai-header-content">
            <div class="alt-text-ai-logo">
                <img src="<?php echo esc_url(ALT_TEXT_AI_PLUGIN_URL . 'assets/images/logo-alt-text-pro.png'); ?>" alt="Alt Text Pro" />
                <h1><?php _e('Alt Text Pro Settings', 'alt-text-ai'); ?></h1>
            </div>
            <div class="alt-text-ai-header-actions">
                <a href="<?php echo admin_url('admin.php?page=alt-text-ai'); ?>" class="button button-secondary">
                    <span class="dashicons dashicons-arrow-left-alt"></span>
                    <?php _e('Back to Dashboard', 'alt-text-ai'); ?>
                </a>
            </div>
        </div>
    </div>

    <div class="alt-text-ai-settings-container">
        <div class="settings-main">
            <form method="post" action="options.php" class="alt-text-ai-settings-form">
                <?php 
                settings_fields('alt_text_ai_settings');
                // Note: We use custom HTML fields below, so we don't call do_settings_sections()
                // This ensures the form submits properly via WordPress Settings API
                ?>
                
                <!-- API Configuration Section -->
                <div class="settings-section">
                    <div class="section-header">
                        <h2><?php _e('API Configuration', 'alt-text-ai'); ?></h2>
                        <p class="section-description">
                            <?php _e('Connect your WordPress site to the Alt Text Pro service.', 'alt-text-ai'); ?>
                        </p>
                    </div>
                    
                    <div class="settings-field">
                        <label for="api_key" class="field-label">
                            <?php _e('API Key', 'alt-text-ai'); ?>
                            <span class="required">*</span>
                        </label>
                        <div class="field-input">
                            <div class="api-key-input-group">
                                <input type="password" 
                                       id="api_key" 
                                       name="alt_text_ai_settings[api_key]" 
                                       value="<?php echo esc_attr($settings['api_key']); ?>" 
                                       class="regular-text" 
                                       placeholder="alt_... or altai_..." 
                                       autocomplete="off" />
                                <button type="button" class="button button-secondary toggle-visibility" id="toggle-api-key" aria-label="<?php _e('Show API key', 'alt-text-ai'); ?>">
                                    <span class="dashicons dashicons-visibility"></span>
                                </button>
                                <button type="button" class="button button-secondary test-connection" id="test-connection">
                                    <span class="dashicons dashicons-admin-plugins"></span>
                                    <?php _e('Test', 'alt-text-ai'); ?>
                                </button>
                            </div>
                            <div id="connection-test-result" class="connection-result"></div>
                        </div>
                        <div class="field-description">
                            <?php printf(
                                __('Enter your Alt Text Pro API key. You can find this in your <a href="%s" target="_blank">Alt Text Pro dashboard</a>.', 'alt-text-ai'),
                                'https://www.alt-text.pro/dashboard'
                            ); ?>
                        </div>
                    </div>
                </div>

                <!-- Generation Settings Section -->
                <div class="settings-section">
                    <div class="section-header">
                        <h2><?php _e('Generation Settings', 'alt-text-ai'); ?></h2>
                        <p class="section-description">
                            <?php _e('Configure how and when alt-text is generated for your images.', 'alt-text-ai'); ?>
                        </p>
                    </div>
                    
                    <div class="settings-field">
                        <div class="field-input">
                            <label class="checkbox-label">
                                <input type="checkbox" 
                                       id="auto_generate" 
                                       name="alt_text_ai_settings[auto_generate]" 
                                       value="1" 
                                       <?php checked(1, $settings['auto_generate']); ?> />
                                <span class="checkmark"></span>
                                <span class="label-text">
                                    <?php _e('Auto-generate alt-text on upload', 'alt-text-ai'); ?>
                                </span>
                            </label>
                        </div>
                        <div class="field-description">
                            <?php _e('Automatically generate alt-text when new images are uploaded. This will use your API credits.', 'alt-text-ai'); ?>
                        </div>
                    </div>
                    
                    <div class="settings-field">
                        <div class="field-input">
                            <label class="checkbox-label">
                                <input type="checkbox" 
                                       id="overwrite_existing" 
                                       name="alt_text_ai_settings[overwrite_existing]" 
                                       value="1" 
                                       <?php checked(1, $settings['overwrite_existing']); ?> />
                                <span class="checkmark"></span>
                                <span class="label-text">
                                    <?php _e('Overwrite existing alt-text', 'alt-text-ai'); ?>
                                </span>
                            </label>
                        </div>
                        <div class="field-description">
                            <?php _e('Replace existing alt-text when regenerating. When disabled, images with existing alt-text will be skipped.', 'alt-text-ai'); ?>
                        </div>
                    </div>
                    
                    <div class="settings-field">
                        <div class="field-input">
                            <label class="checkbox-label">
                                <input type="checkbox" 
                                       id="context_enabled" 
                                       name="alt_text_ai_settings[context_enabled]" 
                                       value="1" 
                                       <?php checked(1, $settings['context_enabled']); ?> />
                                <span class="checkmark"></span>
                                <span class="label-text">
                                    <?php _e('Enable context-aware generation', 'alt-text-ai'); ?>
                                </span>
                            </label>
                        </div>
                        <div class="field-description">
                            <?php _e('Provide additional context (like page title, filename) to improve alt-text quality.', 'alt-text-ai'); ?>
                        </div>
                    </div>
                </div>

                <!-- Processing Settings Section -->
                <div class="settings-section">
                    <div class="section-header">
                        <h2><?php _e('Processing Settings', 'alt-text-ai'); ?></h2>
                        <p class="section-description">
                            <?php _e('Configure bulk processing and performance settings.', 'alt-text-ai'); ?>
                        </p>
                    </div>
                    
                    <div class="settings-field">
                        <label for="batch_size" class="field-label">
                            <?php _e('Batch Size', 'alt-text-ai'); ?>
                        </label>
                        <div class="field-input">
                            <div class="number-input-group">
                                <input type="number" 
                                       id="batch_size" 
                                       name="alt_text_ai_settings[batch_size]" 
                                       value="<?php echo esc_attr($settings['batch_size']); ?>" 
                                       min="1" 
                                       max="50" 
                                       class="small-text" />
                                <span class="input-suffix"><?php _e('images per batch', 'alt-text-ai'); ?></span>
                            </div>
                        </div>
                        <div class="field-description">
                            <?php _e('Number of images to process in each batch during bulk operations. Lower numbers are more reliable but slower.', 'alt-text-ai'); ?>
                        </div>
                    </div>
                </div>

                <!-- Save Settings -->
                <div class="settings-actions">
                    <div class="primary-actions">
                        <?php submit_button(__('Save Settings', 'alt-text-ai'), 'primary', 'submit', false); ?>
                        <button type="button" class="button button-secondary" id="reset-settings">
                            <?php _e('Reset to Defaults', 'alt-text-ai'); ?>
                        </button>
                    </div>
                    <div class="secondary-actions">
                        <button type="button" class="button button-link" id="export-settings">
                            <span class="dashicons dashicons-download"></span>
                            <?php _e('Export Settings', 'alt-text-ai'); ?>
                        </button>
                        <button type="button" class="button button-link" id="import-settings">
                            <span class="dashicons dashicons-upload"></span>
                            <?php _e('Import Settings', 'alt-text-ai'); ?>
                        </button>
                        <input type="file" id="import-file" accept=".json" style="display: none;">
                    </div>
                </div>
            </form>
        </div>

        <!-- Settings Sidebar -->
        <div class="settings-sidebar">
            <!-- Help Card -->
            <div class="sidebar-card help-card">
                <div class="card-header">
                    <h3><?php _e('Need Help?', 'alt-text-ai'); ?></h3>
                </div>
                <div class="card-content">
                    <div class="help-links">
                        <a href="https://www.alt-text.pro/docs" target="_blank" class="help-link">
                            <span class="dashicons dashicons-book"></span>
                            <?php _e('Documentation', 'alt-text-ai'); ?>
                        </a>
                        <a href="https://www.alt-text.pro/support" target="_blank" class="help-link">
                            <span class="dashicons dashicons-sos"></span>
                            <?php _e('Support', 'alt-text-ai'); ?>
                        </a>
                        <a href="https://www.alt-text.pro/dashboard" target="_blank" class="help-link">
                            <span class="dashicons dashicons-dashboard"></span>
                            <?php _e('Account Dashboard', 'alt-text-ai'); ?>
                        </a>
                    </div>
                </div>
            </div>

            <!-- Status Card -->
            <div class="sidebar-card status-card">
                <div class="card-header">
                    <h3><?php _e('Plugin Status', 'alt-text-ai'); ?></h3>
                </div>
                <div class="card-content">
                    <div class="status-items">
                        <div class="status-item">
                            <span class="status-label"><?php _e('Version:', 'alt-text-ai'); ?></span>
                            <span class="status-value"><?php echo ALT_TEXT_AI_VERSION; ?></span>
                        </div>
                        <div class="status-item">
                            <span class="status-label"><?php _e('API Status:', 'alt-text-ai'); ?></span>
                            <span class="status-value" id="api-status">
                                <?php if (!empty($settings['api_key'])): ?>
                                    <span class="status-connected"><?php _e('Configured', 'alt-text-ai'); ?></span>
                                <?php else: ?>
                                    <span class="status-error"><?php _e('Not Configured', 'alt-text-ai'); ?></span>
                                <?php endif; ?>
                            </span>
                        </div>
                        <div class="status-item">
                            <span class="status-label"><?php _e('Auto Generation:', 'alt-text-ai'); ?></span>
                            <span class="status-value">
                                <?php echo $settings['auto_generate'] ? __('Enabled', 'alt-text-ai') : __('Disabled', 'alt-text-ai'); ?>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tips Card -->
            <div class="sidebar-card tips-card">
                <div class="card-header">
                    <h3><?php _e('Pro Tips', 'alt-text-ai'); ?></h3>
                </div>
                <div class="card-content">
                    <div class="tips-list">
                        <div class="tip-item">
                            <span class="dashicons dashicons-lightbulb"></span>
                            <span><?php _e('Test your API connection after entering your key to ensure everything is working correctly.', 'alt-text-ai'); ?></span>
                        </div>
                        <div class="tip-item">
                            <span class="dashicons dashicons-performance"></span>
                            <span><?php _e('Start with a smaller batch size (5-10) for bulk processing to avoid timeouts.', 'alt-text-ai'); ?></span>
                        </div>
                        <div class="tip-item">
                            <span class="dashicons dashicons-backup"></span>
                            <span><?php _e('Export your settings before making major changes to easily restore them if needed.', 'alt-text-ai'); ?></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<script type="text/javascript">
jQuery(document).ready(function($) {
    // Note: API key toggle is handled by admin.js

    // Test API connection
    $('#test-connection').on('click', function() {
        var $button = $(this);
        var $result = $('#connection-test-result');
        var apiKey = $('#api_key').val();
        
        if (!apiKey) {
            $result.html('<div class="notice notice-error"><p>' + altTextAI.strings.invalidKey + '</p></div>');
            return;
        }
        
        $button.prop('disabled', true).find('.dashicons').addClass('rotating');
        $result.html('<div class="notice notice-info"><p>' + altTextAI.strings.generating + '</p></div>');
        
        $.ajax({
            url: altTextAI.ajaxUrl,
            type: 'POST',
            data: {
                action: 'alt_text_ai_test_connection',
                api_key: apiKey,
                nonce: altTextAI.nonce
            },
            success: function(response) {
                if (response.success) {
                    var userInfo = response.data.user_info;
                    var message = '<strong>' + response.data.message + '</strong>';
                    if (userInfo) {
                        message += '<br><small>Plan: ' + userInfo.plan + ' | Credits: ' + userInfo.credits_remaining + '</small>';
                    }
                    $result.html('<div class="notice notice-success"><p>' + message + '</p></div>');
                    $('#api-status').html('<span class="status-connected"><?php _e("Connected", "alt-text-ai"); ?></span>');
                } else {
                    $result.html('<div class="notice notice-error"><p>' + response.data + '</p></div>');
                }
            },
            error: function() {
                $result.html('<div class="notice notice-error"><p><?php _e("Connection test failed", "alt-text-ai"); ?></p></div>');
            },
            complete: function() {
                $button.prop('disabled', false).find('.dashicons').removeClass('rotating');
            }
        });
    });

    // Reset settings
    $('#reset-settings').on('click', function() {
        if (confirm('<?php _e("Are you sure you want to reset all settings to defaults? This cannot be undone.", "alt-text-ai"); ?>')) {
            $.ajax({
                url: altTextAI.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'alt_text_ai_reset_settings',
                    nonce: altTextAI.nonce
                },
                success: function(response) {
                    if (response.success) {
                        location.reload();
                    } else {
                        alert(response.data || '<?php _e("Failed to reset settings", "alt-text-ai"); ?>');
                    }
                },
                error: function() {
                    alert('<?php _e("Failed to reset settings", "alt-text-ai"); ?>');
                }
            });
        }
    });

    // Export settings
    $('#export-settings').on('click', function() {
        var settings = {
            version: '<?php echo ALT_TEXT_AI_VERSION; ?>',
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
        link.download = 'alt-text-ai-settings-' + new Date().toISOString().split('T')[0] + '.json';
        link.click();
        URL.revokeObjectURL(url);
    });

    // Import settings
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
                    // Apply settings to form (excluding API key)
                    if (settings.settings.auto_generate !== undefined) {
                        $('#auto_generate').prop('checked', settings.settings.auto_generate);
                    }
                    if (settings.settings.overwrite_existing !== undefined) {
                        $('#overwrite_existing').prop('checked', settings.settings.overwrite_existing);
                    }
                    if (settings.settings.context_enabled !== undefined) {
                        $('#context_enabled').prop('checked', settings.settings.context_enabled);
                    }
                    if (settings.settings.batch_size !== undefined) {
                        $('#batch_size').val(settings.settings.batch_size);
                    }
                    alert('<?php _e("Settings imported successfully! Don\'t forget to save.", "alt-text-ai"); ?>');
                } else {
                    alert('<?php _e("Invalid settings file format.", "alt-text-ai"); ?>');
                }
            } catch (error) {
                alert('<?php _e("Failed to parse settings file.", "alt-text-ai"); ?>');
            }
        };
        reader.readAsText(file);
    });
});
</script>
