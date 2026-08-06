<?php
/**
 * Alt Text Pro onboarding modal.
 *
 * @package AltTextPro
 */

if (!defined('ABSPATH')) {
    exit;
}
?>
<div id="alt-text-pro-onboarding-modal" class="alt-text-pro-modal modal" aria-hidden="true">
    <div class="modal-overlay close-modal" tabindex="-1"></div>
    <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="alt-text-pro-onboarding-title">
        <button type="button" class="close-modal modal-close"
            aria-label="<?php esc_attr_e('Close', 'alt-text-pro'); ?>">
            <span class="dashicons dashicons-no-alt" aria-hidden="true"></span>
        </button>

        <div class="modal-header">
            <span class="onboarding-heading-icon dashicons dashicons-admin-links" aria-hidden="true"></span>
            <h2 id="alt-text-pro-onboarding-title">
                <?php esc_html_e('Connect', 'alt-text-pro'); ?>
                <span><?php esc_html_e('Alt Text Pro', 'alt-text-pro'); ?></span>
            </h2>
            <p class="modal-subtitle">
                <?php esc_html_e('Choose the connection method that works best for you.', 'alt-text-pro'); ?>
            </p>
        </div>

        <div class="modal-body">
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
                    <button type="button" class="button button-primary-custom onboarding-connect-button"
                        id="auto-connect-btn">
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
                    <span class="manual-heading-icon dashicons dashicons-admin-network" aria-hidden="true"></span>
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

                <button type="button" class="button onboarding-save-button" id="onboarding-save">
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
            <button type="button" class="button button-link close-modal">
                <?php esc_html_e('I\'ll do this later', 'alt-text-pro'); ?>
            </button>
        </div>
    </div>
</div>
