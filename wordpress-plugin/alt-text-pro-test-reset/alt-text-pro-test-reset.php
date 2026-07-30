<?php
/**
 * Plugin Name: Alt Text Pro Test Reset
 * Description: Resets Alt Text Pro setup preferences so the first-time connection flow can be tested again. Intended for test sites only.
 * Version: 1.1.0
 * Author: Alt Text Pro
 * License: GPL-2.0-or-later
 * Text Domain: alt-text-pro-test-reset
 */

if (!defined('ABSPATH')) {
    exit;
}

final class Alt_Text_Pro_Test_Reset {
    const PAGE_SLUG = 'alt-text-pro-test-reset';
    const ACTION = 'alt_text_pro_test_reset';

    public function __construct() {
        add_action('admin_menu', array($this, 'add_settings_page'));
        add_action('admin_post_' . self::ACTION, array($this, 'reset_setup'));
    }

    public function add_settings_page() {
        add_options_page(
            __('Alt Text Pro Test Reset', 'alt-text-pro-test-reset'),
            __('Alt Text Pro Test Reset', 'alt-text-pro-test-reset'),
            'manage_options',
            self::PAGE_SLUG,
            array($this, 'render_settings_page')
        );
    }

    public function render_settings_page() {
        if (!current_user_can('manage_options')) {
            return;
        }

        $did_reset = isset($_GET['alt-text-pro-reset']) && 'done' === sanitize_key(wp_unslash($_GET['alt-text-pro-reset']));
        ?>
        <div class="wrap">
            <h1><?php esc_html_e('Alt Text Pro Test Reset', 'alt-text-pro-test-reset'); ?></h1>

            <?php if ($did_reset) : ?>
                <div class="notice notice-success is-dismissible"><p><?php esc_html_e('Alt Text Pro has been reset to its first-time setup state.', 'alt-text-pro-test-reset'); ?></p></div>
            <?php endif; ?>

            <p><?php esc_html_e('Use this only on a test site when you need to repeat the first-time connection flow.', 'alt-text-pro-test-reset'); ?></p>
            <p><?php esc_html_e('This clears the saved Alt Text Pro API key and returns its setup preferences to their defaults. It does not delete WordPress posts, media, generated alt text, or Alt Text Pro logs.', 'alt-text-pro-test-reset'); ?></p>

            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <input type="hidden" name="action" value="<?php echo esc_attr(self::ACTION); ?>">
                <?php wp_nonce_field(self::ACTION); ?>
                <?php submit_button(__('Reset Alt Text Pro Setup', 'alt-text-pro-test-reset'), 'delete'); ?>
            </form>
        </div>
        <?php
    }

    public function reset_setup() {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('You do not have permission to reset Alt Text Pro.', 'alt-text-pro-test-reset'));
        }

        check_admin_referer(self::ACTION);

        $default_settings = array(
            'api_key' => '',
            'auto_generate' => false,
            'overwrite_existing' => false,
            'context_enabled' => true,
            'blog_context' => '',
            'show_context_field' => false,
            'batch_size' => 1,
        );

        // Alt Text Pro intentionally preserves a saved API key when its regular
        // settings form submits an empty key. Deleting and recreating this one
        // option explicitly restores the genuine first-time state.
        delete_option('alt_text_pro_settings');
        add_option('alt_text_pro_settings', $default_settings);

        delete_transient('alt_text_pro_activation_redirect');
        wp_cache_delete('alt_text_pro_settings', 'options');

        wp_safe_redirect(add_query_arg(
            'alt-text-pro-reset',
            'done',
            admin_url('options-general.php?page=' . self::PAGE_SLUG)
        ));
        exit;
    }
}

new Alt_Text_Pro_Test_Reset();
