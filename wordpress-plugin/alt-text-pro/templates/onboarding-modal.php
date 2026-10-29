<?php
/**
 * Alt Text Pro onboarding modal.
 *
 * @package AltTextPro
 */

if (!defined('ABSPATH')) {
    exit;
}

$alt_text_pro_storage_problem = (new AltTextPro_Settings())->get_key_storage_problem();
?>
<div id="alt-text-pro-onboarding-modal" class="alt-text-pro-modal modal atp-ui" aria-hidden="true">
    <div class="modal-overlay close-modal" tabindex="-1"></div>
    <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="alt-text-pro-onboarding-title">
        <button type="button" class="close-modal modal-close atp-btn button-secondary-custom atp-btn-sm atp-btn-icon"
            aria-label="<?php esc_attr_e('Close', 'alt-text-pro'); ?>">
            <span class="dashicons dashicons-no-alt" aria-hidden="true"></span>
        </button>

        <div class="modal-header">
            <img class="onboarding-logo" src="<?php echo esc_url(ALT_TEXT_PRO_PLUGIN_URL . 'assets/images/logo-alt-text-pro.png'); ?>"
                alt="" width="64" height="64" />
            <h2 id="alt-text-pro-onboarding-title">
                <?php esc_html_e('Connect', 'alt-text-pro'); ?>
                <span><?php esc_html_e('Alt Text Pro', 'alt-text-pro'); ?></span>
            </h2>
            <p class="modal-subtitle">
                <?php esc_html_e('Choose the connection method that works best for you.', 'alt-text-pro'); ?>
            </p>
        </div>

        <div class="modal-body">
            <?php if ($alt_text_pro_storage_problem !== ''): ?>
                <div class="onboarding-message error" role="alert">
                    <strong><?php esc_html_e('This site cannot store an API key yet.', 'alt-text-pro'); ?></strong>
                    <?php echo esc_html($alt_text_pro_storage_problem); ?>
                </div>
            <?php endif; ?>
            <section class="onboarding-step onboarding-step-recommended">
                <div class="onboarding-recommended-copy">
                    <div class="step-label">
                        <span class="dashicons dashicons-star-filled" aria-hidden="true"></span>
                        <?php esc_html_e('Recommended', 'alt-text-pro'); ?>
                    </div>
                    <h3><?php esc_html_e('Connect automatically', 'alt-text-pro'); ?></h3>
                    <p>
                        <?php esc_html_e('Sign in or create a free account and we will securely connect this site for you.', 'alt-text-pro'); ?>
                    </p>
                    <button type="button" class="button button-primary-custom atp-btn-block onboarding-connect-button"
                        id="auto-connect-btn"<?php disabled($alt_text_pro_storage_problem !== ''); ?>>
                        <span><?php esc_html_e('Connect Account', 'alt-text-pro'); ?></span>
                        <span class="dashicons dashicons-arrow-right-alt2" aria-hidden="true"></span>
                    </button>
                    <div id="auto-connect-status" class="auto-connect-status" aria-live="polite"></div>
                </div>
            </section>

            <div class="step-connector" aria-hidden="true">
                <span><?php esc_html_e('or', 'alt-text-pro'); ?></span>
            </div>

            <section class="onboarding-step onboarding-step-manual">
                <div class="manual-heading">
                    <span class="atp-icon-chip manual-heading-icon" aria-hidden="true"><span class="dashicons dashicons-admin-network"></span></span>
                    <div>
                        <h3><?php esc_html_e('Connect manually', 'alt-text-pro'); ?></h3>
                        <p><?php esc_html_e('Paste the API key from your dashboard.', 'alt-text-pro'); ?></p>
                    </div>
                </div>

                <div class="onboarding-field">
                    <label class="screen-reader-text" for="onboarding_api_key">
                        <?php esc_html_e('Paste your API key', 'alt-text-pro'); ?>
                    </label>
                    <input type="password" id="onboarding_api_key" placeholder="alt_................................"
                        autocomplete="off" data-lpignore="true" data-1p-ignore="true" spellcheck="false"
                        aria-describedby="onboarding-api-key-description" />
                    <p class="description" id="onboarding-api-key-description">
                        <?php
                        echo wp_kses_post(
                            sprintf(
                                // translators: %s: URL to the Alt Text Pro dashboard.
                                __('Get your API key from the <a href="%1$s" target="_blank" rel="noopener noreferrer">dashboard</a>.', 'alt-text-pro'),
                                esc_url('https://www.alt-text.pro/dashboard')
                            )
                        );
                        ?>
                    </p>
                </div>

                <div id="onboarding-message" class="onboarding-message" aria-live="polite"></div>

                <button type="button" class="button button-secondary-custom atp-btn-block onboarding-save-button" id="onboarding-save"<?php disabled($alt_text_pro_storage_problem !== ''); ?>>
                    <span class="dashicons dashicons-lock" aria-hidden="true"></span>
                    <span><?php esc_html_e('Save API Key', 'alt-text-pro'); ?></span>
                </button>
            </section>
        </div>

        <div class="modal-footer">
            <p class="onboarding-security-note">
                <span class="dashicons dashicons-shield" aria-hidden="true"></span>
                <?php esc_html_e('Your API key is encrypted before it is stored.', 'alt-text-pro'); ?>
            </p>
            <button type="button" class="button atp-btn atp-btn-ghost atp-btn-sm close-modal">
                <?php esc_html_e('I\'ll do this later', 'alt-text-pro'); ?>
            </button>
        </div>
    </div>
</div>
