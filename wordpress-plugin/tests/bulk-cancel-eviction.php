<?php
/**
 * A bulk run cancelled while an image is with the service must stay
 * cancelled, even when an object cache evicts the cancelled copy of its
 * state before the batch finishes.
 *
 * Run with: php wordpress-plugin/tests/bulk-cancel-eviction.php
 */

define('ABSPATH', __DIR__ . '/');
define('DAY_IN_SECONDS', 86400);
define('MINUTE_IN_SECONDS', 60);

$alt_text_pro_test_transients = array();
$alt_text_pro_test_options = array();
$alt_text_pro_test_post_meta = array();
$alt_text_pro_test_during_request = null;
$alt_text_pro_test_api_calls = 0;

function add_action() {}
function add_filter() {}
function get_current_user_id() { return 41; }
function current_time() { return '2026-11-05 10:00:00'; }
function current_user_can() { return true; }
function wp_attachment_is_image($id) { return in_array($id, array(101, 102), true); }
function wp_using_ext_object_cache() { return false; }
function wp_cache_delete() { return true; }
function get_attached_file($id) { return "/uploads/image-{$id}.jpg"; }
function __($text) { return $text; }
function esc_html__($text) { return $text; }
function sanitize_text_field($text) { return trim((string) $text); }
function sanitize_key($key) { return strtolower((string) $key); }
function wp_slash($value) { return $value; }
function absint($value) { return abs(intval($value)); }
function maybe_serialize($value) { return is_array($value) ? serialize($value) : $value; }
function maybe_unserialize($value) { return is_string($value) && @unserialize($value) !== false ? unserialize($value) : $value; }

function wp_generate_password($length)
{
    static $counter = 0;
    $counter++;
    return substr(hash('sha256', 'cancel-eviction-' . $counter), 0, $length);
}

function set_transient($key, $value, $expiration = 0)
{
    global $alt_text_pro_test_transients;
    $alt_text_pro_test_transients[$key] = $value;
    return true;
}

function get_transient($key)
{
    global $alt_text_pro_test_transients;
    return $alt_text_pro_test_transients[$key] ?? false;
}

function delete_transient($key)
{
    global $alt_text_pro_test_transients;
    unset($alt_text_pro_test_transients[$key]);
    return true;
}

function get_option($name, $default = false)
{
    global $alt_text_pro_test_options;
    return array_key_exists($name, $alt_text_pro_test_options) ? $alt_text_pro_test_options[$name] : $default;
}

function update_option($name, $value, $autoload = null)
{
    global $alt_text_pro_test_options;
    $alt_text_pro_test_options[$name] = $value;
    return true;
}

function delete_option($name)
{
    global $alt_text_pro_test_options;
    unset($alt_text_pro_test_options[$name]);
    return true;
}

function get_post_meta($post_id, $key = '', $single = false)
{
    global $alt_text_pro_test_post_meta;
    return $alt_text_pro_test_post_meta[$post_id][$key] ?? '';
}

function update_post_meta($post_id, $key, $value)
{
    global $alt_text_pro_test_post_meta;
    $alt_text_pro_test_post_meta[$post_id][$key] = $value;
    return true;
}

class Alt_Text_Pro_Cancel_Test_WPDB
{
    public $prefix = 'wp_';
    public $options = 'wp_options';
    public $insert_id = 0;

    public function prepare($query, ...$args) { return $query; }
    public function query($query) { return 0; }
    public function get_var($query) { return null; }
    public function get_col($query) { return array(); }
    public function insert($table, $data, $formats = array())
    {
        $this->insert_id++;
        return 1;
    }
}
$wpdb = new Alt_Text_Pro_Cancel_Test_WPDB();

/**
 * Stand-in for the service. The test decides what happens while the
 * request is in flight.
 */
class AltTextPro_API_Client
{
    public function generate_alt_text($image_id, $image_context = '', $blog_context = '')
    {
        global $alt_text_pro_test_during_request, $alt_text_pro_test_api_calls;
        $alt_text_pro_test_api_calls++;
        if (is_callable($alt_text_pro_test_during_request)) {
            call_user_func($alt_text_pro_test_during_request, $image_id);
        }
        return array('success' => true, 'alt_text' => "Alt text for {$image_id}", 'credits_used' => 1);
    }
}

require_once dirname(__DIR__) . '/alt-text-pro/includes/class-bulk-processor.php';

function alt_text_pro_cancel_assert($condition, $message)
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
    echo "PASS: {$message}\n";
}

function alt_text_pro_cancel_invoke($object, $method, array $arguments = array())
{
    $reflection = new ReflectionMethod($object, $method);
    if (PHP_VERSION_ID < 80100) {
        $reflection->setAccessible(true);
    }
    return $reflection->invokeArgs($object, $arguments);
}

$processor = new AltTextPro_Bulk_Processor(false);
$process_id = alt_text_pro_cancel_invoke(
    $processor,
    'create_bulk_process_record',
    array(array(101, 102), 1, false, 10, 2)
);
$state_option = alt_text_pro_cancel_invoke($processor, 'get_bulk_process_option_name', array($process_id));
$state_transient = 'alt_text_pro_bulk_' . $process_id;
$active_request = 'alt_text_pro_bulk_active_' . $process_id;

// While image 101 is with the service: its in-flight marker has expired, the
// user cancels (so the run goes straight to "cancelled" and its option is
// deleted), and the object cache then evicts the cancelled transient.
$alt_text_pro_test_during_request = function () use ($processor, $process_id, $state_transient, $active_request) {
    delete_transient($active_request);
    alt_text_pro_cancel_invoke($processor, 'cancel_bulk_process', array($process_id));
    delete_transient($state_transient);
};

alt_text_pro_cancel_invoke($processor, 'process_batch_background', array($process_id, 0));

alt_text_pro_cancel_assert($alt_text_pro_test_api_calls === 1, 'Only the image already in flight is sent to the service.');
alt_text_pro_cancel_assert(
    !array_key_exists($state_option, $alt_text_pro_test_options),
    'The cancelled run\'s durable state is not re-created.'
);
$transient_state = get_transient($state_transient);
alt_text_pro_cancel_assert(
    $transient_state === false || ($transient_state['status'] ?? '') === 'cancelled',
    'The run is not saved back as running.'
);
alt_text_pro_cancel_assert(
    $transient_state === false || empty($transient_state['needs_next_batch']),
    'The run does not ask for another batch.'
);

$history = get_option(AltTextPro_Bulk_Processor::RUN_HISTORY_OPTION, array());
alt_text_pro_cancel_assert(
    is_array($history) && count($history) === 1
        && ($history[0]['status'] ?? '') === 'cancelled'
        && intval($history[0]['successful'] ?? 0) === 1,
    'The charged image is kept and the run is recorded as cancelled.'
);
alt_text_pro_cancel_assert(
    ($alt_text_pro_test_post_meta[101]['_wp_attachment_image_alt'] ?? '') === 'Alt text for 101',
    'The alt text that was paid for is saved.'
);
