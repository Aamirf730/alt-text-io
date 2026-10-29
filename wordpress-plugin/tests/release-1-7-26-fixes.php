<?php
/**
 * Regression coverage for the 1.7.26 review fixes that do not need WordPress:
 * API messages (credits, deleted account, 503 retry), offloaded media,
 * "Used in" context, logs CSV export, activation redirect and static checks.
 *
 * Run with: php wordpress-plugin/tests/release-1-7-26-fixes.php
 */

define('ABSPATH', __DIR__ . '/');

$alt_text_pro_test = array(
    'doing_ajax' => false,
    'doing_cron' => false,
    'can_manage' => true,
    'transients' => array(),
    'redirect' => null,
    'remote_request' => null,
    'remote_get' => null,
    'remote_get_calls' => 0,
    'attached_file' => '',
    'attachment_url' => 'https://cdn.example.com/uploads/photo.png',
    'mime' => 'image/png',
    'posts' => array(),
    'last_like_args' => array(),
);

function alt_text_pro_test_tmp()
{
    // php-wasm cannot always write to the host temp directory.
    return (is_dir('/tmp') && is_writable('/tmp')) ? '/tmp' : sys_get_temp_dir();
}

class AltTextPro_Test_Exit extends Exception
{
}

class WP_Error
{
    public $message;

    public function __construct($code = '', $message = '')
    {
        $this->message = $message;
    }

    public function get_error_message()
    {
        return $this->message;
    }
}

function add_action()
{
}

function add_filter()
{
}

function register_activation_hook()
{
}

function register_deactivation_hook()
{
}

function plugin_dir_url($file)
{
    return dirname($file) . '/';
}

function plugin_dir_path($file)
{
    return dirname($file) . '/';
}

function plugin_basename($file)
{
    return basename($file);
}

function __($text)
{
    return $text;
}

function esc_html__($text)
{
    return $text;
}

function sanitize_text_field($value)
{
    return trim(strip_tags((string) $value));
}

function sanitize_key($value)
{
    return preg_replace('/[^a-z0-9_\-]/', '', strtolower((string) $value));
}

function wp_strip_all_tags($text)
{
    return trim(strip_tags((string) $text));
}

function absint($value)
{
    return abs(intval($value));
}

function is_wp_error($thing)
{
    return $thing instanceof WP_Error;
}

function wp_doing_ajax()
{
    global $alt_text_pro_test;
    return $alt_text_pro_test['doing_ajax'];
}

function wp_doing_cron()
{
    global $alt_text_pro_test;
    return $alt_text_pro_test['doing_cron'];
}

function current_user_can($capability)
{
    global $alt_text_pro_test;
    return $capability === 'manage_options' ? $alt_text_pro_test['can_manage'] : true;
}

function get_transient($key)
{
    global $alt_text_pro_test;
    return $alt_text_pro_test['transients'][$key] ?? false;
}

function delete_transient($key)
{
    global $alt_text_pro_test;
    unset($alt_text_pro_test['transients'][$key]);
    return true;
}

function is_network_admin()
{
    return false;
}

function admin_url($path = '')
{
    return 'https://example.test/wp-admin/' . $path;
}

function wp_safe_redirect($url)
{
    global $alt_text_pro_test;
    $alt_text_pro_test['redirect'] = $url;
    throw new AltTextPro_Test_Exit('redirect');
}

function wp_remote_request($url, $args)
{
    global $alt_text_pro_test;
    $alt_text_pro_test['remote_request_args'] = $args;
    return $alt_text_pro_test['remote_request'];
}

function wp_remote_retrieve_response_code($response)
{
    return is_array($response) ? intval($response['response']['code'] ?? 0) : 0;
}

function wp_remote_retrieve_body($response)
{
    return is_array($response) ? (string) ($response['body'] ?? '') : '';
}

function wp_remote_retrieve_header($response, $header)
{
    $headers = is_array($response) ? ($response['headers'] ?? array()) : array();
    return isset($headers[strtolower($header)]) ? $headers[strtolower($header)] : '';
}

function get_attached_file($attachment_id)
{
    global $alt_text_pro_test;
    return $alt_text_pro_test['attached_file'];
}

function get_post_mime_type($attachment_id)
{
    global $alt_text_pro_test;
    return $alt_text_pro_test['mime'];
}

function wp_get_attachment_url($attachment_id)
{
    global $alt_text_pro_test;
    return $alt_text_pro_test['attachment_url'];
}

function wp_tempnam($prefix = '')
{
    $path = alt_text_pro_test_tmp() . '/' . $prefix . '-' . bin2hex(random_bytes(6)) . '.tmp';
    touch($path);
    return $path;
}

function wp_delete_file($path)
{
    if (is_string($path) && file_exists($path)) {
        unlink($path);
    }
}

function wp_get_image_mime($path)
{
    $info = @getimagesize($path);
    return is_array($info) ? $info['mime'] : false;
}

function wp_safe_remote_get($url, $args)
{
    global $alt_text_pro_test;
    $alt_text_pro_test['remote_get_calls']++;
    $alt_text_pro_test['remote_get_args'] = $args;
    $fixture = $alt_text_pro_test['remote_get'];
    if (!is_array($fixture)) {
        return new WP_Error('http', 'failed');
    }

    // Like WordPress: a streamed response is written to $args['filename'],
    // cut at limit_response_size.
    $body = substr($fixture['body'], 0, $args['limit_response_size']);
    file_put_contents($args['filename'], $body);

    return array(
        'response' => array('code' => $fixture['code']),
        'headers' => $fixture['headers'],
        'body' => '',
    );
}

class AltTextPro_Settings
{
    public function get_settings()
    {
        return array('api_key' => 'alt_test_key_for_the_regression_harness');
    }
}

class AltTextPro_Test_WPDB
{
    public $posts = 'wp_posts';
    public $postmeta = 'wp_postmeta';

    public function esc_like($text)
    {
        return addcslashes($text, '_%\\');
    }

    public function prepare($query, ...$args)
    {
        return array('query' => $query, 'args' => $args);
    }

    public function get_results($prepared)
    {
        global $alt_text_pro_test;

        if (strpos($prepared['query'], 'post_content LIKE') !== false) {
            $alt_text_pro_test['last_like_args'] = $prepared['args'];
            // Return rows a loose LIKE would have matched, to prove the PHP
            // filter also rejects near misses.
            return array_map(function ($row) {
                return (object) $row;
            }, $alt_text_pro_test['posts']);
        }

        return array();
    }
}

$wpdb = new AltTextPro_Test_WPDB();

require_once dirname(__DIR__) . '/alt-text-pro/alt-text-pro.php';
require_once dirname(__DIR__) . '/alt-text-pro/includes/class-api-client.php';
require_once dirname(__DIR__) . '/alt-text-pro/includes/class-media-handler.php';
require_once dirname(__DIR__) . '/alt-text-pro/includes/class-admin.php';

function alt_text_pro_release_assert($condition, $message)
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

function alt_text_pro_release_invoke($object, $method, array $arguments = array())
{
    $reflection = new ReflectionMethod($object, $method);
    $reflection->setAccessible(true);
    return $reflection->invokeArgs($object, $arguments);
}

// Fail on any PHP warning or notice (for example filesize() on a missing file).
set_error_handler(function ($severity, $message, $file, $line) {
    if (!(error_reporting() & $severity) || $severity === E_DEPRECATED || $severity === E_USER_DEPRECATED) {
        return false;
    }
    fwrite(STDERR, "FAIL: PHP warning: {$message} in {$file}:{$line}\n");
    exit(1);
});

$client = new AltTextPro_API_Client();

// --- Item 6 / 11: API error mapping -------------------------------------
$alt_text_pro_test['remote_request'] = array(
    'response' => array('code' => 402),
    'headers' => array(),
    'body' => '{"error":"Insufficient credits"}',
);
$credits = alt_text_pro_release_invoke($client, 'make_request', array('generate-alt-text', 'POST', array('x' => 1)));
alt_text_pro_release_assert(
    !empty($credits['no_credits']) && strpos($credits['message'], 'credit pack') !== false,
    'A 402 must mention credit packs as well as plan upgrades.'
);

$alt_text_pro_test['remote_request'] = array(
    'response' => array('code' => 404),
    'headers' => array(),
    'body' => '{"success":false,"error":"User profile not found"}',
);
$missing_profile = alt_text_pro_release_invoke($client, 'make_request', array('get-usage', 'GET'));
alt_text_pro_release_assert(
    ($missing_profile['code'] ?? '') === 'account_not_found'
        && !empty($missing_profile['reconnect'])
        && stripos($missing_profile['message'], 'reconnect') !== false
        && stripos($missing_profile['message'], 'update the plugin') === false,
    'A 404 "User profile not found" must ask the user to reconnect, not to update the plugin.'
);

$alt_text_pro_test['remote_request'] = array(
    'response' => array('code' => 404),
    'headers' => array(),
    'body' => 'Not Found',
);
$missing_endpoint = alt_text_pro_release_invoke($client, 'make_request', array('old-endpoint', 'GET'));
alt_text_pro_release_assert(
    empty($missing_endpoint['reconnect']) && stripos($missing_endpoint['message'], 'update the plugin') !== false,
    'Other 404 responses keep the service-unavailable message.'
);

$alt_text_pro_test['remote_request'] = array(
    'response' => array('code' => 503),
    'headers' => array('retry-after' => '42'),
    'body' => '{"error":"Rate limiter unavailable","message":"Request throttling is temporarily unavailable.","retryAfter":12}',
);
$busy = alt_text_pro_release_invoke($client, 'make_request', array('generate-alt-text', 'POST', array('x' => 1)));
alt_text_pro_release_assert(
    !empty($busy['retryable']) && intval($busy['retry_after_seconds']) === 12 && intval($busy['status_code']) === 503,
    'A 503 rate-limiter-unavailable response must be retryable with the service retry delay.'
);

$alt_text_pro_test['remote_request']['body'] = '<html>Service Unavailable</html>';
$busy_header = alt_text_pro_release_invoke($client, 'make_request', array('generate-alt-text', 'POST', array('x' => 1)));
alt_text_pro_release_assert(
    !empty($busy_header['retryable']) && intval($busy_header['retry_after_seconds']) === 42,
    'A 503 without a JSON body must fall back to the Retry-After header.'
);

$bulk_source = file_get_contents(dirname(__DIR__) . '/alt-text-pro/includes/class-bulk-processor.php');
alt_text_pro_release_assert(
    strpos($bulk_source, "if (!\$result['success'] && !empty(\$result['retryable']))") !== false,
    'Bulk processing must retry any retryable result (429 and 503) instead of failing the image.'
);

// --- Item 8: offloaded media --------------------------------------------
$png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
$alt_text_pro_test['attached_file'] = alt_text_pro_test_tmp() . '/alt-text-pro-missing-' . uniqid() . '.png';
$alt_text_pro_test['remote_get'] = array(
    'code' => 200,
    'headers' => array('content-type' => 'image/png', 'content-length' => (string) strlen($png)),
    'body' => $png,
);
$remote_base64 = alt_text_pro_release_invoke($client, 'get_image_base64', array(55));
alt_text_pro_release_assert(
    $remote_base64 === base64_encode($png),
    'A missing local file must be read from the attachment URL.'
);
alt_text_pro_release_assert(
    intval($alt_text_pro_test['remote_get_args']['timeout']) === 20
        && intval($alt_text_pro_test['remote_get_args']['limit_response_size']) === 25 * 1024 * 1024 + 1
        && !empty($alt_text_pro_test['remote_get_args']['stream']),
    'The remote download must use a 20 s timeout and stream with a 25 MB cap.'
);
$leftover = glob(alt_text_pro_test_tmp() . '/alt-text-pro-remote*');
alt_text_pro_release_assert(empty($leftover), 'The temporary download must be deleted.');

$alt_text_pro_test['remote_get']['headers'] = array('content-type' => 'text/html');
alt_text_pro_release_assert(
    alt_text_pro_release_invoke($client, 'get_image_base64', array(55)) === false,
    'A non-image response must be rejected.'
);

$alt_text_pro_test['remote_get'] = array(
    'code' => 200,
    'headers' => array('content-type' => 'image/png'),
    'body' => 'not really an image',
);
alt_text_pro_release_assert(
    alt_text_pro_release_invoke($client, 'get_image_base64', array(55)) === false,
    'A response whose bytes are not an image must be rejected.'
);

$alt_text_pro_test['remote_get'] = array(
    'code' => 200,
    'headers' => array('content-type' => 'image/png', 'content-length' => (string) (30 * 1024 * 1024)),
    'body' => $png,
);
alt_text_pro_release_assert(
    alt_text_pro_release_invoke($client, 'get_image_base64', array(55)) === false,
    'A response over 25 MB must be rejected.'
);

$alt_text_pro_test['remote_get'] = array('code' => 404, 'headers' => array('content-type' => 'image/png'), 'body' => $png);
$missing_result = $client->generate_alt_text(55);
alt_text_pro_release_assert(
    empty($missing_result['success']) && empty($missing_result['image_too_large']),
    'A missing local file with no downloadable copy must fail cleanly without filesize() warnings.'
);
alt_text_pro_release_assert(
    empty(glob(alt_text_pro_test_tmp() . '/alt-text-pro-remote*')),
    'Failed downloads must not leave temporary files.'
);

// A local file is used directly, without a download.
$local_file = alt_text_pro_test_tmp() . '/atp-local-' . bin2hex(random_bytes(6)) . '.png';
file_put_contents($local_file, $png);
$alt_text_pro_test['attached_file'] = $local_file;
$alt_text_pro_test['remote_get_calls'] = 0;
alt_text_pro_release_assert(
    alt_text_pro_release_invoke($client, 'get_image_base64', array(55)) === base64_encode($png)
        && $alt_text_pro_test['remote_get_calls'] === 0,
    'A local file must be read without downloading.'
);

// --- 1.7.28: server errors reach the bulk run ----------------------------
// generate_alt_text() must pass server_error on, or the bulk run's "the
// service keeps failing" stop never fires for 5xx answers.
$alt_text_pro_test['remote_request'] = array(
    'response' => array('code' => 500),
    'headers' => array(),
    'body' => '{"error":"Internal error"}',
);
$server_failure = $client->generate_alt_text(55);
alt_text_pro_release_assert(
    empty($server_failure['success']) && !empty($server_failure['retryable']) && $server_failure['server_error'] === true,
    'A 500 from the service must reach the caller with server_error set.'
);

$alt_text_pro_test['remote_request']['response']['code'] = 502;
$gateway_failure = $client->generate_alt_text(55);
alt_text_pro_release_assert(
    $gateway_failure['server_error'] === true && intval($gateway_failure['status_code']) === 502,
    'A 502 gateway error must reach the caller with server_error set.'
);

$alt_text_pro_test['remote_request'] = array(
    'response' => array('code' => 500),
    'headers' => array(),
    'body' => '{"error":"Could not describe","code":"generation_failed"}',
);
$image_failure = $client->generate_alt_text(55);
alt_text_pro_release_assert(
    empty($image_failure['retryable']) && $image_failure['server_error'] === false,
    'One image the AI could not describe is not a service failure.'
);
alt_text_pro_release_assert(
    strpos($bulk_source, "if (!empty(\$result['server_error']) || \$status_code === 0)") !== false,
    'Bulk runs must stop when the service keeps answering with server errors.'
);
unlink($local_file);

// --- Item 7: "Used in" context ------------------------------------------
$media = new AltTextPro_Media_Handler();
$alt_text_pro_test['attached_file'] = '/uploads/tom-&-jerry.png';
$alt_text_pro_test['posts'] = array(
    array('ID' => 1, 'post_title' => 'Tom &amp; Jerry <em>live</em>', 'post_type' => 'post', 'post_content' => '<img class="wp-image-12" />'),
    array('ID' => 2, 'post_title' => 'Wrong image', 'post_type' => 'post', 'post_content' => '<img class="wp-image-120" />'),
);
$suggestions = $media->get_context_suggestions(12);
alt_text_pro_release_assert(
    $suggestions === array('Used in: Tom & Jerry live', 'Filename: tom-&-jerry'),
    'Context must be plain text and only list posts that use the exact image ID.'
);
alt_text_pro_release_assert(
    $alt_text_pro_test['last_like_args'] === array('%wp-image-12"%', "%wp-image-12'%", '%wp-image-12 %'),
    'The SQL lookup must match the exact wp-image class, not a prefix.'
);

// --- Item 9: logs CSV ---------------------------------------------------
$csv_rows = AltTextPro_Admin::get_logs_csv_rows(array(
    array('id' => '3', 'attachment_id' => '12', 'post_title' => '=HYPERLINK("x")', 'alt_text' => 'A dog, "running"', 'credits_used' => '1', 'created_at' => '2026-10-01 10:00:00'),
    array('id' => '4', 'attachment_id' => '13', 'post_title' => null, 'alt_text' => '-1+1', 'credits_used' => null, 'created_at' => '2026-10-02 10:00:00'),
));
alt_text_pro_release_assert(
    count($csv_rows) === 3 && $csv_rows[0][3] === 'Alt Text',
    'The CSV must start with a header row.'
);
alt_text_pro_release_assert(
    $csv_rows[1][2] === "'=HYPERLINK(\"x\")" && $csv_rows[1][3] === 'A dog, "running"' && $csv_rows[2][3] === "'-1+1" && $csv_rows[2][4] === '0',
    'CSV cells must neutralise spreadsheet formulas and keep text intact.'
);
$admin_source = file_get_contents(dirname(__DIR__) . '/alt-text-pro/includes/class-admin.php');
alt_text_pro_release_assert(
    strpos($admin_source, "add_action('admin_post_alt_text_pro_export_logs'") !== false
        && strpos($admin_source, "check_admin_referer('alt_text_pro_export_logs')") !== false
        && strpos($admin_source, "current_user_can('manage_options')") !== false
        && strpos($admin_source, "fputcsv(\$output, \$csv_row, ',', '\"', '')") !== false,
    'The CSV export must be nonce- and capability-checked and pass every fputcsv() argument (PHP 8.4+).'
);
$logs_template = file_get_contents(dirname(__DIR__) . '/alt-text-pro/templates/logs.php');
alt_text_pro_release_assert(
    preg_match('/number_format\(\$stats/', $logs_template) === 0
        && substr_count($logs_template, 'number_format((int) $stats') === 4
        && preg_match("/wp_nonce_url\\(.*admin_url\\('admin-post\\.php\\?action=alt_text_pro_export_logs'\\).*, 'alt_text_pro_export_logs'\\)/", $logs_template) === 1,
    'The logs page must cast stats before number_format() and link Export to the nonce-protected handler.'
);

// --- Item 10: activation redirect ---------------------------------------
$plugin = AltTextPro::get_instance();
$alt_text_pro_test['transients']['alt_text_pro_activation_redirect'] = true;

$alt_text_pro_test['doing_ajax'] = true;
$plugin->activation_redirect();
alt_text_pro_release_assert(
    $alt_text_pro_test['redirect'] === null && get_transient('alt_text_pro_activation_redirect') === true,
    'An AJAX request must not redirect or consume the activation flag.'
);
$alt_text_pro_test['doing_ajax'] = false;

$alt_text_pro_test['doing_cron'] = true;
$plugin->activation_redirect();
alt_text_pro_release_assert(
    $alt_text_pro_test['redirect'] === null && get_transient('alt_text_pro_activation_redirect') === true,
    'A cron request must not redirect or consume the activation flag.'
);
$alt_text_pro_test['doing_cron'] = false;

$alt_text_pro_test['can_manage'] = false;
$plugin->activation_redirect();
alt_text_pro_release_assert(
    $alt_text_pro_test['redirect'] === null && get_transient('alt_text_pro_activation_redirect') === true,
    'A user without manage_options must not be redirected or consume the activation flag.'
);
$alt_text_pro_test['can_manage'] = true;

try {
    $plugin->activation_redirect();
} catch (AltTextPro_Test_Exit $exit) {
}
alt_text_pro_release_assert(
    $alt_text_pro_test['redirect'] === 'https://example.test/wp-admin/admin.php?page=alt-text-pro'
        && get_transient('alt_text_pro_activation_redirect') === false,
    'An administrator page load must redirect once and consume the flag.'
);
$plugin_source = file_get_contents(dirname(__DIR__) . '/alt-text-pro/alt-text-pro.php');
alt_text_pro_release_assert(
    strpos($plugin_source, "(defined('REST_REQUEST') && REST_REQUEST)") !== false,
    'REST requests must not trigger the activation redirect.'
);

// --- Item 3: multisite ---------------------------------------------------
$uninstall_source = file_get_contents(dirname(__DIR__) . '/alt-text-pro/uninstall.php');
alt_text_pro_release_assert(
    strpos($plugin_source, "add_action('wp_initialize_site', array(\$this, 'initialize_new_site'), 200)") !== false
        && strpos($plugin_source, 'public function activate($network_wide = false)') !== false
        && strpos($plugin_source, "add_action('admin_init', array(\$this, 'maybe_upgrade'))") !== false
        && strpos($plugin_source, "get_option('alt_text_pro_db_version') !== self::DB_VERSION") !== false,
    'Multisite activation, new sites and the lazy table check must create the logs table.'
);
alt_text_pro_release_assert(
    strpos($uninstall_source, 'if (is_multisite())') !== false
        && strpos($uninstall_source, 'switch_to_blog($alt_text_pro_site_id)') !== false
        && strpos($uninstall_source, "delete_option('alt_text_pro_db_version')") !== false,
    'Uninstall must clean every site on multisite.'
);

// --- Item 2: batched post generation (static; behaviour runs in Playground)
alt_text_pro_release_assert(
    strpos($plugin_source, 'private const POST_GENERATIONS_PER_REQUEST = 3;') !== false
        && strpos($plugin_source, "\$results['remaining']++") !== false
        && strpos($plugin_source, 'sync_only: 1') !== false
        && strpos($plugin_source, 'defer_sync: 1') !== false,
    'Post generation must be bounded per request, report remaining images and sync after an interruption.'
);

// --- Item 6: no plan-only out-of-credits copy left -----------------------
$plugin_files = array_merge(
    glob(dirname(__DIR__) . '/alt-text-pro/*.php'),
    glob(dirname(__DIR__) . '/alt-text-pro/includes/*.php'),
    glob(dirname(__DIR__) . '/alt-text-pro/templates/*.php'),
    array(dirname(__DIR__) . '/alt-text-pro/assets/js/admin.js')
);
foreach ($plugin_files as $plugin_file) {
    $contents = file_get_contents($plugin_file);
    alt_text_pro_release_assert(
        stripos($contents, 'Please upgrade your plan') === false && stripos($contents, 'Please upgrade,') === false,
        'Out-of-credits copy must mention credit packs: ' . basename($plugin_file)
    );
}

// --- Item 13: connect callback from the browser location -----------------
$admin_js = file_get_contents(dirname(__DIR__) . '/alt-text-pro/assets/js/admin.js');
alt_text_pro_release_assert(
    strpos($admin_js, 'var settingsUrl = AltTextProAdmin.getConnectCallbackUrl();') !== false
        && strpos($admin_js, 'new URL(window.location.href)') !== false
        && strpos($admin_js, "callback.search = '?page=alt-text-pro-settings';") !== false
        && strpos($admin_js, 'event.origin !== expectedOrigin') !== false
        && strpos($admin_js, 'event.data.state !== storedState') !== false,
    'The connect callback must use the current browser origin and keep the origin/state checks.'
);

// --- 1.7.28: formats are counted only where WordPress can process them ---
// Bulk runs process images through wp_attachment_is_image(), which accepts
// WebP from 5.8, AVIF from 6.5 and HEIC from 6.7.
$wp_version = '5.7.2';
alt_text_pro_release_assert(
    AltTextPro_API_Client::supported_mime_types() === array('image/jpeg', 'image/png', 'image/gif'),
    'WordPress before 5.8 must not count WebP, AVIF or HEIC images.'
);
$old_wp_clause = AltTextPro_API_Client::get_supported_mime_sql_clause('p');
alt_text_pro_release_assert(
    $old_wp_clause['args'] === array(array('image/jpeg', 'image/png', 'image/gif'))
        && substr_count($old_wp_clause['query'], '%s') === 3,
    'The missing-alt SQL must use the same formats as processing.'
);
$wp_version = '6.5-RC1';
alt_text_pro_release_assert(
    AltTextPro_API_Client::supported_mime_types() === array('image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'),
    'WordPress 6.5 must count AVIF but not HEIC images.'
);
$wp_version = '6.7.1';
alt_text_pro_release_assert(
    count(AltTextPro_API_Client::supported_mime_types()) === 7
        && in_array('image/heic', AltTextPro_API_Client::supported_mime_types(), true),
    'WordPress 6.7 must count HEIC images.'
);
unset($wp_version);
alt_text_pro_release_assert(
    count(AltTextPro_API_Client::supported_mime_types()) === 7,
    'Outside WordPress every supported format is listed.'
);

// --- 1.7.28: uninstall does not wait for the service ----------------------
$alt_text_pro_test['remote_request'] = array('response' => array('code' => 0), 'headers' => array(), 'body' => '');
$alt_text_pro_test['remote_request_args'] = null;
alt_text_pro_release_assert(
    $client->disconnect_site(null, false) === true
        && ($alt_text_pro_test['remote_request_args']['blocking'] ?? null) === false
        && intval($alt_text_pro_test['remote_request_args']['timeout']) <= 2,
    'A non-blocking site disconnect must not wait for the answer.'
);
alt_text_pro_release_assert(
    strpos($uninstall_source, 'notify_site_disconnected(false)') !== false,
    'Uninstall must disconnect each site without blocking, so large networks do not time out.'
);

restore_error_handler();
fwrite(STDOUT, "PASS: 1.7.26 review fixes regression\n");
