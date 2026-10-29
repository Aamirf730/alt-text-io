<?php
/**
 * Low-credit and out-of-credit notice on the Media Library screens and the
 * plugin's pages.
 *
 * The notice reads a cached balance. The cache is updated whenever the
 * plugin already talks to the service (generation responses, account
 * checks on plugin pages), and refreshed in the background by WP-Cron at
 * most every few hours, so showing it never adds a remote request to an
 * admin page load.
 *
 * @package AltTextPro
 */

if (!defined('ABSPATH')) {
    exit;
}

class AltTextPro_Credit_Notice
{
    // Cached balance: credits, level ('ok', 'low', 'out'), since (when that
    // level began), checked (when the balance was last known) and retry_at
    // (no background check before this time after a failed one).
    public const STATUS_OPTION = 'alt_text_pro_credit_status';

    // Per-user (and per-site) "level:since" of the notice this user dismissed.
    public const DISMISSED_META = 'alt_text_pro_credit_notice_dismissed';

    // WP-Cron event that refreshes the cached balance.
    public const REFRESH_HOOK = 'alt_text_pro_refresh_credit_status';

    // Same threshold as the warning on the plugin dashboard.
    public const LOW_THRESHOLD = 10;

    // Refresh a balance older than this (6 hours).
    private const REFRESH_AFTER = 21600;

    // After a failed refresh, try again after this long (1 hour).
    private const RETRY_AFTER = 3600;

    // Do not show a balance older than this (2 days); it may be wrong.
    private const STALE_AFTER = 172800;

    /**
     * Constructor
     */
    public function __construct()
    {
        add_action(self::REFRESH_HOOK, array(__CLASS__, 'refresh'));
        // A different API key may belong to another account.
        add_action('update_option_alt_text_pro_settings', array(__CLASS__, 'on_settings_updated'), 10, 2);

        if (is_admin()) {
            // Media Library screens. Plugin pages remove admin_notices and
            // print their own notices through alt_text_pro_render_notices.
            add_action('admin_notices', array($this, 'render_media_notice'));
            add_action('alt_text_pro_render_notices', array($this, 'render_plugin_page_notice'), 20);
            add_action('wp_ajax_alt_text_pro_dismiss_credit_notice', array($this, 'ajax_dismiss'));
        }
    }

    /**
     * Level of a credit balance.
     *
     * @param int $credits Credits the account can spend now.
     * @return string 'out', 'low' or 'ok'.
     */
    public static function level_for($credits)
    {
        $credits = intval($credits);
        if ($credits <= 0) {
            return 'out';
        }

        return $credits <= self::LOW_THRESHOLD ? 'low' : 'ok';
    }

    /**
     * Cached balance, or null when none is stored.
     *
     * @return array|null
     */
    public static function get_status()
    {
        $status = get_option(self::STATUS_OPTION, null);
        if (!is_array($status)) {
            return null;
        }

        return array(
            'credits' => isset($status['credits']) && is_numeric($status['credits']) ? intval($status['credits']) : null,
            'level' => isset($status['level']) && in_array($status['level'], array('ok', 'low', 'out'), true) ? $status['level'] : '',
            'since' => intval($status['since'] ?? 0),
            'checked' => intval($status['checked'] ?? 0),
            'retry_at' => intval($status['retry_at'] ?? 0),
        );
    }

    /**
     * Store a balance the service just reported.
     *
     * @param int $credits Credits the account can spend now.
     */
    public static function remember_credits($credits)
    {
        if (!is_numeric($credits)) {
            return;
        }

        $credits = max(0, intval($credits));
        $level = self::level_for($credits);
        $previous = self::get_status();

        // "since" changes only when the level does, so a dismissed notice
        // stays dismissed while credits go from 9 to 8, and comes back when
        // they run out.
        $since = ($previous && $previous['level'] === $level && $previous['since'] > 0)
            ? $previous['since']
            : time();

        update_option(self::STATUS_OPTION, array(
            'credits' => $credits,
            'level' => $level,
            'since' => $since,
            'checked' => time(),
            'retry_at' => 0,
        ), false);
    }

    /**
     * WP-Cron: ask the service for the balance. A successful answer is
     * stored by AltTextPro_API_Client::get_usage_stats().
     */
    public static function refresh()
    {
        $settings = get_option('alt_text_pro_settings', array());
        if (!is_array($settings) || empty($settings['api_key']) || !class_exists('AltTextPro_API_Client')) {
            return;
        }

        $started = time();
        $client = new AltTextPro_API_Client();
        $client->get_usage_stats();

        $status = self::get_status();
        if (!$status || $status['checked'] < $started) {
            // The check failed or the answer had no balance. Keep the last
            // known balance and try again in an hour rather than on every
            // page load.
            update_option(self::STATUS_OPTION, array(
                'credits' => $status ? $status['credits'] : null,
                'level' => $status ? $status['level'] : '',
                'since' => $status ? $status['since'] : 0,
                'checked' => $status ? $status['checked'] : 0,
                'retry_at' => time() + self::RETRY_AFTER,
            ), false);
        }
    }

    /**
     * Forget the cached balance when the API key changes.
     *
     * @param mixed $old_value Previous settings.
     * @param mixed $new_value New settings.
     */
    public static function on_settings_updated($old_value, $new_value)
    {
        $old_key = is_array($old_value) ? (string) ($old_value['api_key'] ?? '') : '';
        $new_key = is_array($new_value) ? (string) ($new_value['api_key'] ?? '') : '';

        if ($old_key !== $new_key) {
            delete_option(self::STATUS_OPTION);
        }
    }

    /**
     * Notice on the Media Library screens (list, grid, Add New and the
     * attachment edit screen).
     */
    public function render_media_notice()
    {
        $screen = function_exists('get_current_screen') ? get_current_screen() : null;
        if (!$screen) {
            return;
        }

        $is_media_screen = in_array($screen->base, array('upload', 'media'), true)
            || ($screen->base === 'post' && $screen->post_type === 'attachment');

        if ($is_media_screen) {
            $this->render_notice();
        }
    }

    /**
     * Notice on the plugin's own pages, except the dashboard, which shows
     * its own credit warning with live numbers.
     */
    public function render_plugin_page_notice()
    {
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only page check
        $page = isset($_GET['page']) ? sanitize_key(wp_unslash($_GET['page'])) : '';
        if ($page === 'alt-text-pro') {
            return;
        }

        $this->render_notice();
    }

    /**
     * Print the notice when the cached balance is low or zero and this user
     * has not dismissed it at this level.
     */
    private function render_notice()
    {
        if (!current_user_can('manage_options')) {
            return;
        }

        $settings = get_option('alt_text_pro_settings', array());
        if (!is_array($settings) || empty($settings['api_key'])) {
            return;
        }

        $status = self::get_status();
        self::maybe_schedule_refresh($status);

        if (
            !$status
            || $status['credits'] === null
            || !in_array($status['level'], array('low', 'out'), true)
            || (time() - $status['checked']) > self::STALE_AFTER
        ) {
            return;
        }

        $token = $status['level'] . ':' . $status['since'];
        if ((string) get_user_option(self::DISMISSED_META) === $token) {
            return;
        }

        if ($status['level'] === 'out') {
            $class = 'notice-error';
            $message = __('You are out of credits. New images will not get alt text until you add credits.', 'alt-text-pro');
        } else {
            $class = 'notice-warning';
            $message = sprintf(
                /* translators: %s: number of credits left */
                _n('Only %s credit left. Each image uses 1 credit.', 'Only %s credits left. Each image uses 1 credit.', $status['credits'], 'alt-text-pro'),
                number_format_i18n($status['credits'])
            );
        }

        wp_enqueue_script(
            'alt-text-pro-credit-notice',
            ALT_TEXT_PRO_PLUGIN_URL . 'assets/js/credit-notice.js',
            array('jquery'),
            ALT_TEXT_PRO_VERSION,
            true
        );

        echo '<div class="notice ' . esc_attr($class) . ' is-dismissible alt-text-pro-credit-notice"'
            . ' data-nonce="' . esc_attr(wp_create_nonce('alt_text_pro_credit_notice')) . '"'
            . ' data-level="' . esc_attr($token) . '">';
        echo '<p><strong>' . esc_html__('Alt Text Pro:', 'alt-text-pro') . '</strong> ' . esc_html($message) . ' ';
        echo '<a href="' . esc_url(ALT_TEXT_PRO_PRICING_URL) . '" target="_blank" rel="noopener noreferrer">' . esc_html__('Buy credits or upgrade', 'alt-text-pro') . '</a>';
        echo '</p></div>';
    }

    /**
     * Queue a background refresh when the cached balance is missing or
     * older than a few hours. Never calls the service during the page load.
     *
     * @param array|null $status Cached balance.
     */
    private static function maybe_schedule_refresh($status)
    {
        if ($status && ((time() - $status['checked']) < self::REFRESH_AFTER || time() < $status['retry_at'])) {
            return;
        }

        if (!wp_next_scheduled(self::REFRESH_HOOK)) {
            wp_schedule_single_event(time(), self::REFRESH_HOOK);
        }
    }

    /**
     * Remember that this user dismissed the notice at its current level.
     */
    public function ajax_dismiss()
    {
        check_ajax_referer('alt_text_pro_credit_notice', 'nonce');

        if (!current_user_can('manage_options')) {
            AltTextPro::send_permission_error();
        }

        // Store the level the user saw, so a level reached since then
        // (low to out) still shows.
        $token = isset($_POST['level']) ? sanitize_text_field(wp_unslash($_POST['level'])) : '';
        if (!preg_match('/^(?:low|out):\d+$/', $token)) {
            wp_send_json_error(esc_html__('Invalid request.', 'alt-text-pro'));
        }

        // Per site on multisite, like the balance it refers to.
        update_user_option(get_current_user_id(), self::DISMISSED_META, $token);
        wp_send_json_success();
    }
}
