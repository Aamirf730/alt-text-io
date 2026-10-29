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
            echo '<div class="notice notice-success"><p>' . esc_html__('Your Alt Text Pro account was disconnected from this site and the API key was removed here. The key still works on your other sites; rotate it in your Alt Text Pro dashboard if you want to revoke it everywhere.', 'alt-text-pro') . '</p></div>';
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
                    <?php if (!empty($account_email)): ?>
                    <p class="description atp-help atp-connected-as">
                        <?php
                        echo wp_kses(
                            sprintf(
                                /* translators: %s: email address of the connected Alt Text Pro account */
                                __('This site is connected to the Alt Text Pro account <strong>%s</strong>.', 'alt-text-pro'),
                                esc_html($account_email)
                            ),
                            array('strong' => array())
                        );
                        ?>
                    </p>
                    <?php endif; ?>
                    <p class="description atp-help">
                        <?php esc_html_e('An API key is already saved. Leave this blank to keep it, or paste a new key to replace it.', 'alt-text-pro'); ?>
                    </p>
                    <?php endif; ?>
                    <div class="atp-actions atp-field-actions">
                    <?php if ($alt_text_pro_has_key || !empty($settings['api_key'])): ?>
                        <!-- Submits the separate disconnect form below; forms cannot be nested. -->
                        <button type="submit" class="button-secondary-custom atp-btn-danger" id="alt-text-pro-disconnect"
                            form="alt-text-pro-disconnect-form"
                            data-confirm="<?php esc_attr_e('Disconnect your Alt Text Pro account from this site? The API key is removed from this site only; it is shared by all your sites and stays valid on them. Alt text already generated stays on your images.', 'alt-text-pro'); ?>">
                            <span class="dashicons dashicons-dismiss" aria-hidden="true"></span>
                            <span><?php esc_html_e('Disconnect account', 'alt-text-pro'); ?></span>
                        </button>
                    <?php endif; ?>
                        <button type="button" class="button-secondary-custom open-modal"
                            data-modal="alt-text-pro-onboarding-modal">
                            <span class="dashicons dashicons-admin-links" aria-hidden="true"></span>
                            <span>
                                <?php
                                echo esc_html($alt_text_pro_has_key
                                    ? __('Connect a different account', 'alt-text-pro')
                                    : __('Start onboarding', 'alt-text-pro'));
                                ?>
                            </span>
                        </button>
                    </div>
                    <div id="connection-test-result" aria-live="polite"></div>
                    <?php if ($alt_text_pro_has_key): ?>
                    <p class="description atp-help">
                        <?php esc_html_e('Disconnecting removes the key from this site only. One API key is shared by all your sites, so it keeps working elsewhere until you rotate it in your Alt Text Pro dashboard.', 'alt-text-pro'); ?>
                    </p>
                    <?php endif; ?>
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
                        <input type="hidden" name="alt_text_pro_settings[fill_post_content_alt]" value="0" />
                        <input type="checkbox" id="fill_post_content_alt" name="alt_text_pro_settings[fill_post_content_alt]"
                            value="1" <?php checked(1, !empty($settings['fill_post_content_alt'])); ?> />
                        <span class="checkbox-label">
                            <?php esc_html_e('Fill empty alt text in post content', 'alt-text-pro'); ?>
                        </span>
                    </label>
                    <p class="checkbox-desc">
                        <?php esc_html_e('When a page is shown, images inside posts whose alt text is empty or missing get the alt text saved in the Media Library. This also works for most Elementor and Divi images, including Theme Builder templates. Alt text written in the post or the builder is never overwritten, and the saved post is not changed. To keep one image\'s alt empty on purpose, tick "Decorative image" for it in the Media Library.', 'alt-text-pro'); ?>
                    </p>
                </div>

                <div class="settings-field atp-field">
                    <label for="language" class="field-label atp-label">
                        <?php esc_html_e('Alt text language', 'alt-text-pro'); ?>
                    </label>
                    <select id="language" name="alt_text_pro_settings[language]">
                        <option value="" <?php selected('', (string) ($settings['language'] ?? '')); ?>>
                            <?php
                            echo esc_html(sprintf(
                                /* translators: %s: the site's language code, such as de_DE */
                                __('Same as the site language (%s)', 'alt-text-pro'),
                                get_locale()
                            ));
                            ?>
                        </option>
                        <?php foreach (AltTextPro_Settings::get_language_options() as $alt_text_pro_locale => $alt_text_pro_language_name): ?>
                            <option value="<?php echo esc_attr($alt_text_pro_locale); ?>" <?php selected($alt_text_pro_locale, (string) ($settings['language'] ?? '')); ?>>
                                <?php echo esc_html($alt_text_pro_language_name); ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                    <p class="description atp-help">
                        <?php esc_html_e('Alt text is written in this language. Languages the service does not support yet fall back to English. With "Same as the site language" on a WPML or Polylang site, an image that has its own language is described in that language.', 'alt-text-pro'); ?>
                    </p>
                </div>

                <div class="settings-field">
                    <label class="checkbox-group">
                        <input type="hidden" name="alt_text_pro_settings[email_bulk_complete]" value="0" />
                        <input type="checkbox" id="email_bulk_complete" name="alt_text_pro_settings[email_bulk_complete]"
                            value="1" <?php checked(1, !empty($settings['email_bulk_complete'])); ?> />
                        <span class="checkbox-label">
                            <?php esc_html_e('Email me when a bulk run finishes', 'alt-text-pro'); ?>
                        </span>
                    </label>
                    <p class="checkbox-desc">
                        <?php esc_html_e('WordPress sends a short summary to the email address of the user who started the run when it finishes or stops. The email is sent by your site, not by Alt Text Pro.', 'alt-text-pro'); ?>
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
                <div class="settings-field">
                    <label class="checkbox-group">
                        <input type="hidden" name="alt_text_pro_settings[context_enabled]" value="0" />
                        <input type="checkbox" id="context_enabled" name="alt_text_pro_settings[context_enabled]"
                            value="1" <?php checked(1, !empty($settings['context_enabled'])); ?> />
                        <span class="checkbox-label">
                            <?php esc_html_e('Send image context', 'alt-text-pro'); ?>
                        </span>
                    </label>
                    <p class="checkbox-desc">
                        <?php esc_html_e('Sends the titles of posts that use the image and the image file name with each request, which makes descriptions more relevant. Turn this off to send only the image (and the blog context below, if set).', 'alt-text-pro'); ?>
                    </p>
                </div>

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

        <!-- Image details filled from new alt text (title, caption, description). -->
        <div class="alt-text-pro-card alt-text-pro-image-details-card">
            <div class="card-header">
                <h3>
                    <?php esc_html_e('Image title, caption and description', 'alt-text-pro'); ?>
                </h3>
            </div>
            <div class="card-content">
                <p class="description atp-help">
                    <?php esc_html_e('When Alt Text Pro saves new alt text for an image (on upload, in a bulk run, from the Posts list, or when you apply a generated draft without changing it), it can copy the same text into these fields. Text someone wrote there is never replaced.', 'alt-text-pro'); ?>
                </p>

                <div class="settings-field">
                    <label class="checkbox-group">
                        <input type="hidden" name="alt_text_pro_settings[fill_title_from_alt]" value="0" />
                        <input type="checkbox" id="fill_title_from_alt" name="alt_text_pro_settings[fill_title_from_alt]"
                            value="1" <?php checked(1, !empty($settings['fill_title_from_alt'])); ?> />
                        <span class="checkbox-label">
                            <?php esc_html_e('Fill the image title', 'alt-text-pro'); ?>
                        </span>
                    </label>
                    <p class="checkbox-desc">
                        <?php esc_html_e('Only while the title is still the file name WordPress gave it, such as "IMG_1234".', 'alt-text-pro'); ?>
                    </p>
                </div>

                <div class="settings-field">
                    <label class="checkbox-group">
                        <input type="hidden" name="alt_text_pro_settings[fill_caption_from_alt]" value="0" />
                        <input type="checkbox" id="fill_caption_from_alt" name="alt_text_pro_settings[fill_caption_from_alt]"
                            value="1" <?php checked(1, !empty($settings['fill_caption_from_alt'])); ?> />
                        <span class="checkbox-label">
                            <?php esc_html_e('Fill the caption', 'alt-text-pro'); ?>
                        </span>
                    </label>
                    <p class="checkbox-desc">
                        <?php esc_html_e('Only when the caption is empty. Some themes show the caption under the image, next to the same alt text for screen readers.', 'alt-text-pro'); ?>
                    </p>
                </div>

                <div class="settings-field">
                    <label class="checkbox-group">
                        <input type="hidden" name="alt_text_pro_settings[fill_description_from_alt]" value="0" />
                        <input type="checkbox" id="fill_description_from_alt" name="alt_text_pro_settings[fill_description_from_alt]"
                            value="1" <?php checked(1, !empty($settings['fill_description_from_alt'])); ?> />
                        <span class="checkbox-label">
                            <?php esc_html_e('Fill the description', 'alt-text-pro'); ?>
                        </span>
                    </label>
                    <p class="checkbox-desc">
                        <?php esc_html_e('Only when the description is empty. The description appears on the image\'s attachment page.', 'alt-text-pro'); ?>
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
