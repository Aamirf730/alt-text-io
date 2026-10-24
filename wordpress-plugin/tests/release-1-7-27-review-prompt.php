<?php
/**
 * Regression coverage for the 1.7.27 WordPress.org review request: when it
 * shows, who sees it, how each answer is stored, and uninstall cleanup.
 *
 * Run with: php wordpress-plugin/tests/release-1-7-27-review-prompt.php
 */

define('ABSPATH', __DIR__ . '/');
define('DAY_IN_SECONDS', 86400);
define('HOUR_IN_SECONDS', 3600);

$alt_text_pro_test = array(
    'can_manage' => true,
    'options' => array(),
    'user_meta' => array(),
    'transients' => array(),
    'log_count' => 0,
    'count_queries' => 0,
    'actions' => array(),
    'referer' => 'http://example.test/wp-admin/admin.php?page=alt-text-pro-logs',
    'nonce_checked' => false,
);

class AltTextPro_Test_Redirect extends Exception
{
}

class AltTextPro_Test_Die extends Exception
{
}

function add_action($hook, $callback)
{
    global $alt_text_pro_test;
    $alt_text_pro_test['actions'][$hook] = $callback;
}

function add_filter()
{
}

function current_user_can()
{
    global $alt_text_pro_test;
    return $alt_text_pro_test['can_manage'];
}

function get_option($name, $default = false)
{
    global $alt_text_pro_test;
    return array_key_exists($name, $alt_text_pro_test['options']) ? $alt_text_pro_test['options'][$name] : $default;
}

function get_current_user_id()
{
    return 7;
}

function get_user_meta($user_id, $key)
{
    global $alt_text_pro_test;
    return $alt_text_pro_test['user_meta'][$user_id][$key] ?? '';
}

function update_user_meta($user_id, $key, $value)
{
    global $alt_text_pro_test;
    $alt_text_pro_test['user_meta'][$user_id][$key] = $value;
    return true;
}

function get_transient($name)
{
    global $alt_text_pro_test;
    return $alt_text_pro_test['transients'][$name] ?? false;
}

function set_transient($name, $value)
{
    global $alt_text_pro_test;
    $alt_text_pro_test['transients'][$name] = $value;
    return true;
}

function admin_url($path = '')
{
    return 'http://example.test/wp-admin/' . $path;
}

function wp_nonce_url($url, $action)
{
    return $url . '&_wpnonce=nonce-' . $action;
}

function check_admin_referer($action)
{
    global $alt_text_pro_test;
    $alt_text_pro_test['nonce_checked'] = $action;
    return true;
}

function wp_get_referer()
{
    global $alt_text_pro_test;
    return $alt_text_pro_test['referer'];
}

function wp_redirect($url)
{
    throw new AltTextPro_Test_Redirect($url);
}

function wp_safe_redirect($url)
{
    throw new AltTextPro_Test_Redirect($url);
}

function wp_die($message)
{
    throw new AltTextPro_Test_Die($message);
}

function sanitize_key($value)
{
    return preg_replace('/[^a-z0-9_\-]/', '', strtolower($value));
}

function wp_unslash($value)
{
    return $value;
}

function __($text)
{
    return $text;
}

function esc_html__($text)
{
    return $text;
}

function _n($single, $plural, $number)
{
    return $number === 1 ? $single : $plural;
}

function number_format_i18n($number)
{
    return number_format($number);
}

function esc_html($text)
{
    return htmlspecialchars($text, ENT_QUOTES);
}

function esc_url($url)
{
    return htmlspecialchars($url, ENT_QUOTES);
}

function wp_kses_post($text)
{
    return $text;
}

class AltTextPro_Test_WPDB
{
    public $prefix = 'wp_';

    public function get_var($sql)
    {
        global $alt_text_pro_test;
        $alt_text_pro_test['count_queries']++;
        return strpos($sql, 'wp_alt_text_pro_logs') !== false ? (string) $alt_text_pro_test['log_count'] : null;
    }
}

$wpdb = new AltTextPro_Test_WPDB();

require_once dirname(__DIR__) . '/alt-text-pro/includes/class-admin.php';

function alt_text_pro_review_assert($condition, $message)
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

function alt_text_pro_review_notices($admin)
{
    ob_start();
    $admin->plugin_notices();
    return ob_get_clean();
}

function alt_text_pro_review_reset($log_count)
{
    global $alt_text_pro_test;
    $alt_text_pro_test['log_count'] = $log_count;
    $alt_text_pro_test['transients'] = array();
    $alt_text_pro_test['user_meta'] = array();
    $alt_text_pro_test['options'] = array();
    $alt_text_pro_test['can_manage'] = true;
    $alt_text_pro_test['count_queries'] = 0;
}

function alt_text_pro_review_answer($admin, $choice)
{
    $_GET['choice'] = $choice;
    try {
        $admin->handle_review_prompt();
    } catch (AltTextPro_Test_Redirect $redirect) {
        return $redirect->getMessage();
    }
    return null;
}

$admin = new AltTextPro_Admin();
alt_text_pro_review_assert(
    isset($alt_text_pro_test['actions']['admin_post_alt_text_pro_review_prompt']),
    'the review answer handler is registered'
);

// Below the threshold nothing is shown.
alt_text_pro_review_reset(AltTextPro_Admin::REVIEW_PROMPT_THRESHOLD - 1);
alt_text_pro_review_assert(alt_text_pro_review_notices($admin) === '', 'no prompt before 50 descriptions');

// At the threshold the prompt shows once, with three nonce-protected answers.
alt_text_pro_review_reset(AltTextPro_Admin::REVIEW_PROMPT_THRESHOLD);
$html = alt_text_pro_review_notices($admin);
alt_text_pro_review_assert(strpos($html, 'Alt Text Pro has written 50 alt text descriptions on this site.') !== false, 'prompt states the real count');
alt_text_pro_review_assert(substr_count($html, '_wpnonce=nonce-alt_text_pro_review_prompt') === 3, 'all three answers carry the nonce');
foreach (array('review', 'later', 'dismiss') as $choice) {
    alt_text_pro_review_assert(strpos($html, 'choice=' . $choice) !== false, "prompt offers {$choice}");
}
alt_text_pro_review_assert(strpos($html, 'target="_blank" rel="noopener noreferrer"') !== false, 'review link opens a new tab safely');

// The count is cached, so plugin pages do not query the logs table each load.
alt_text_pro_review_notices($admin);
alt_text_pro_review_assert($alt_text_pro_test['count_queries'] === 1, 'log count is cached in a transient');

// Users without manage_options never see it.
alt_text_pro_review_reset(500);
$alt_text_pro_test['can_manage'] = false;
alt_text_pro_review_assert(alt_text_pro_review_notices($admin) === '', 'non-admins do not see the prompt');

// An API key storage problem takes priority over the review request.
alt_text_pro_review_reset(500);
$alt_text_pro_test['options']['alt_text_pro_api_key_storage_error'] = true;
$html = alt_text_pro_review_notices($admin);
alt_text_pro_review_assert(strpos($html, 'could not be decrypted') !== false && strpos($html, 'Leave a review') === false, 'storage error replaces the review prompt');

// "Maybe later" snoozes for 30 days and returns to the page the user was on.
alt_text_pro_review_reset(500);
$target = alt_text_pro_review_answer($admin, 'later');
$snooze = $alt_text_pro_test['user_meta'][7][AltTextPro_Admin::REVIEW_PROMPT_META];
alt_text_pro_review_assert($alt_text_pro_test['nonce_checked'] === 'alt_text_pro_review_prompt', 'answers check the nonce');
alt_text_pro_review_assert(abs($snooze - (time() + 30 * DAY_IN_SECONDS)) < 5, 'later snoozes for 30 days');
alt_text_pro_review_assert($target === $alt_text_pro_test['referer'], 'later returns to the referring page');
alt_text_pro_review_assert(alt_text_pro_review_notices($admin) === '', 'snoozed prompt stays hidden');
$alt_text_pro_test['user_meta'][7][AltTextPro_Admin::REVIEW_PROMPT_META] = time() - 1;
alt_text_pro_review_assert(strpos(alt_text_pro_review_notices($admin), 'Leave a review') !== false, 'prompt returns after the snooze');

// "Don't ask again" and "Leave a review" both stop it for good.
alt_text_pro_review_reset(500);
alt_text_pro_review_answer($admin, 'dismiss');
alt_text_pro_review_assert($alt_text_pro_test['user_meta'][7][AltTextPro_Admin::REVIEW_PROMPT_META] === 'done', 'dismiss is permanent');
alt_text_pro_review_assert(alt_text_pro_review_notices($admin) === '', 'dismissed prompt stays hidden');

alt_text_pro_review_reset(500);
$target = alt_text_pro_review_answer($admin, 'review');
alt_text_pro_review_assert($target === AltTextPro_Admin::REVIEW_URL, 'review goes to the WordPress.org review form');
alt_text_pro_review_assert($alt_text_pro_test['user_meta'][7][AltTextPro_Admin::REVIEW_PROMPT_META] === 'done', 'reviewing stops the prompt');

// Unknown answers change nothing.
alt_text_pro_review_reset(500);
alt_text_pro_review_answer($admin, 'bogus');
alt_text_pro_review_assert(!isset($alt_text_pro_test['user_meta'][7]), 'unknown answers store nothing');

// Only administrators can answer.
$alt_text_pro_test['can_manage'] = false;
$denied = false;
try {
    alt_text_pro_review_answer($admin, 'dismiss');
} catch (AltTextPro_Test_Die $die) {
    $denied = true;
}
alt_text_pro_review_assert($denied && !isset($alt_text_pro_test['user_meta'][7]), 'non-admins cannot answer');

// Uninstall removes the stored answers and cached count.
$uninstall = file_get_contents(dirname(__DIR__) . '/alt-text-pro/uninstall.php');
alt_text_pro_review_assert(strpos($uninstall, "delete_metadata('user', 0, 'alt_text_pro_review_prompt', '', true);") !== false, 'uninstall deletes review answers');
alt_text_pro_review_assert(strpos($uninstall, "delete_transient('alt_text_pro_generated_count');") !== false, 'uninstall deletes the cached count');

fwrite(STDOUT, "PASS: 1.7.27 review prompt regression\n");
