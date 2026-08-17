<?php
/**
 * Regression coverage for WordPress media authorization and bulk-job ownership.
 *
 * Run with: php wordpress-plugin/tests/security-regression.php
 */

define('ABSPATH', __DIR__ . '/');
define('DAY_IN_SECONDS', 86400);

$alt_text_pro_test_user_id = 41;
$alt_text_pro_test_transients = array();
$alt_text_pro_test_options = array();
$alt_text_pro_test_editable_images = array(101, 103);
$alt_text_pro_test_primed_posts = array();

function add_action()
{
}

function get_current_user_id()
{
    global $alt_text_pro_test_user_id;
    return $alt_text_pro_test_user_id;
}

function current_time()
{
    return '2026-08-12 10:00:00';
}

function wp_generate_password($length)
{
    static $counter = 0;
    $counter++;
    $value = hash('sha256', 'alt-text-pro-' . $counter);
    return substr($value, 0, $length);
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

function wp_using_ext_object_cache()
{
    return false;
}

function wp_attachment_is_image($image_id)
{
    return in_array((int) $image_id, array(101, 102, 103), true);
}

function _prime_post_caches($post_ids, $update_term_cache, $update_meta_cache)
{
    global $alt_text_pro_test_primed_posts;
    $alt_text_pro_test_primed_posts = array(
        'ids' => $post_ids,
        'terms' => $update_term_cache,
        'meta' => $update_meta_cache,
    );
}

function current_user_can($capability, $object_id = null)
{
    global $alt_text_pro_test_editable_images;
    return $capability === 'edit_post'
        ? in_array((int) $object_id, $alt_text_pro_test_editable_images, true)
        : true;
}

function add_option($name, $value)
{
    global $alt_text_pro_test_options;
    if (array_key_exists($name, $alt_text_pro_test_options)) {
        return false;
    }
    $alt_text_pro_test_options[$name] = $value;
    return true;
}

function get_option($name, $default = false)
{
    global $alt_text_pro_test_options;
    return $alt_text_pro_test_options[$name] ?? $default;
}

function update_option($name, $value, $autoload = null)
{
    global $alt_text_pro_test_options;
    $changed = !array_key_exists($name, $alt_text_pro_test_options)
        || $alt_text_pro_test_options[$name] !== $value;
    $alt_text_pro_test_options[$name] = $value;
    return $changed;
}

function delete_option($name)
{
    global $alt_text_pro_test_options;
    unset($alt_text_pro_test_options[$name]);
    return true;
}

function maybe_serialize($value)
{
    return is_array($value) || is_object($value) ? serialize($value) : $value;
}

function maybe_unserialize($value)
{
    if (!is_string($value)) {
        return $value;
    }

    $unserialized = @unserialize($value);
    return $unserialized === false && $value !== 'b:0;' ? $value : $unserialized;
}

function wp_cache_delete()
{
    return true;
}

class AltTextPro_Test_WPDB
{
    public $options = 'wp_options';

    public function prepare($query, ...$args)
    {
        return array('query' => $query, 'args' => $args);
    }

    public function query($prepared)
    {
        global $alt_text_pro_test_options;

        if (strpos($prepared['query'], 'INSERT IGNORE') === 0) {
            $option_name = $prepared['args'][0];
            if (array_key_exists($option_name, $alt_text_pro_test_options)) {
                return 0;
            }

            $alt_text_pro_test_options[$option_name] = maybe_unserialize($prepared['args'][1]);
            return 1;
        }

        if (strpos($prepared['query'], 'DELETE FROM') === 0) {
            $option_name = $prepared['args'][0];
            $expected_value = $prepared['args'][1];
            if (
                array_key_exists($option_name, $alt_text_pro_test_options) &&
                maybe_serialize($alt_text_pro_test_options[$option_name]) === $expected_value
            ) {
                unset($alt_text_pro_test_options[$option_name]);
                return 1;
            }

            return 0;
        }

        return false;
    }
}

$wpdb = new AltTextPro_Test_WPDB();

require_once dirname(__DIR__) . '/alt-text-pro/includes/class-bulk-processor.php';

function alt_text_pro_security_assert($condition, $message)
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

function alt_text_pro_invoke_private($object, $method, array $arguments = array())
{
    $reflection = new ReflectionMethod($object, $method);
    $reflection->setAccessible(true);
    return $reflection->invokeArgs($object, $arguments);
}

$processor = new AltTextPro_Bulk_Processor();
$process_id = alt_text_pro_invoke_private(
    $processor,
    'create_bulk_process_record',
    array(array(101, 103), 1, false, 10, 2, 10, 0)
);

alt_text_pro_security_assert(
    preg_match('/^bulk_[A-Za-z0-9]{32}$/', $process_id) === 1,
    'New bulk IDs must be opaque 32-character tokens.'
);
alt_text_pro_security_assert(
    alt_text_pro_invoke_private($processor, 'get_bulk_process_data', array($process_id))['user_id'] === 41,
    'The creating user must be able to read their bulk job.'
);

$durable_state_option = alt_text_pro_invoke_private(
    $processor,
    'get_bulk_process_option_name',
    array($process_id)
);
alt_text_pro_security_assert(
    array_key_exists($durable_state_option, $alt_text_pro_test_options),
    'Active bulk state must be persisted in the options table.'
);
$alt_text_pro_test_transients = array();
alt_text_pro_security_assert(
    alt_text_pro_invoke_private($processor, 'get_bulk_process_data', array($process_id))['user_id'] === 41,
    'Bulk state must recover from the options table after transient eviction.'
);

$alt_text_pro_test_user_id = 99;
alt_text_pro_security_assert(
    alt_text_pro_invoke_private($processor, 'get_bulk_process_data', array($process_id)) === false,
    'A different user must not be able to read another user\'s bulk job.'
);

$alt_text_pro_test_user_id = 41;
$editable = alt_text_pro_invoke_private(
    $processor,
    'filter_editable_images',
    array(array('101', 102, 103, 103, 999))
);
alt_text_pro_security_assert(
    $editable === array(101, 103),
    'Bulk queues must contain only unique image attachments the user may edit.'
);
alt_text_pro_security_assert(
    $alt_text_pro_test_primed_posts === array(
        'ids' => array(101, 102, 103, 999),
        'terms' => false,
        'meta' => false,
    ),
    'Bulk authorization must prime only the normalized post cache once.'
);

$first_lock = alt_text_pro_invoke_private($processor, 'acquire_process_lock', array($process_id));
$second_lock = alt_text_pro_invoke_private($processor, 'acquire_process_lock', array($process_id));
alt_text_pro_security_assert(is_string($first_lock), 'The first batch request must acquire its process lock.');
alt_text_pro_security_assert($second_lock === false, 'A concurrent batch request must not acquire the same process lock.');
alt_text_pro_invoke_private($processor, 'release_process_lock', array($process_id, 'wrong-owner-token'));
alt_text_pro_security_assert(
    alt_text_pro_invoke_private($processor, 'acquire_process_lock', array($process_id)) === false,
    'A request that does not own the lock token must not release it.'
);
alt_text_pro_invoke_private($processor, 'release_process_lock', array($process_id, $first_lock));
alt_text_pro_security_assert(
    is_string(alt_text_pro_invoke_private($processor, 'acquire_process_lock', array($process_id))),
    'The process lock must be reusable after its owner releases it.'
);

$plugin_source = file_get_contents(dirname(__DIR__) . '/alt-text-pro/alt-text-pro.php');
$media_source = file_get_contents(dirname(__DIR__) . '/alt-text-pro/includes/class-media-handler.php');
$bulk_source = file_get_contents(dirname(__DIR__) . '/alt-text-pro/includes/class-bulk-processor.php');
$admin_source = file_get_contents(dirname(__DIR__) . '/alt-text-pro/assets/js/admin.js');
$logs_template = file_get_contents(dirname(__DIR__) . '/alt-text-pro/templates/logs.php');

alt_text_pro_security_assert(
    substr_count($plugin_source, "current_user_can('edit_post', \$attachment_id)") >= 1,
    'Single-image generation must enforce the attachment edit capability.'
);
alt_text_pro_security_assert(
    strpos($plugin_source, "current_user_can('edit_post', \$post_id)") !== false,
    'Post generation must enforce the post edit capability.'
);
alt_text_pro_security_assert(
    strpos($media_source, "current_user_can('edit_post', \$attachment_id)") !== false,
    'Media regeneration must enforce the attachment edit capability.'
);
alt_text_pro_security_assert(
    strpos($bulk_source, "uniqid('bulk_'") === false,
    'Predictable uniqid bulk identifiers must not return.'
);
alt_text_pro_security_assert(
    strpos($bulk_source, 'private const MAX_RETRY_ATTEMPTS = 3;') !== false,
    'Retryable per-image failures must have a fixed attempt limit.'
);
alt_text_pro_security_assert(
    strpos($bulk_source, '$retry_attempt >= self::MAX_RETRY_ATTEMPTS') !== false,
    'A retryable image must become a recorded failure after the fixed attempt limit.'
);
alt_text_pro_security_assert(
    strpos($bulk_source, 'INSERT IGNORE INTO {$wpdb->options}') !== false,
    'Bulk locks must use an atomic insert that cannot replace another owner token.'
);
alt_text_pro_security_assert(
    strpos($bulk_source, 'private function save_bulk_process_data') !== false,
    'Bulk state writes must update the durable options-table copy.'
);
alt_text_pro_security_assert(
    strpos($bulk_source, 'get_option($this->get_bulk_process_option_name($process_id), false)') !== false,
    'Bulk state reads must recover from the durable options-table copy.'
);
alt_text_pro_security_assert(
    strpos($media_source, 'wp_schedule_single_event') === false,
    'Automatic upload generation must not schedule a duplicate billable fallback.'
);
alt_text_pro_security_assert(
    strpos($plugin_source, 'data.content_update_error') !== false,
    'Post-generation UI must surface a post-content update warning.'
);
alt_text_pro_security_assert(
    strpos($logs_template, 'regenerate-alt-text') === false,
    'The logs page must not expose a billable regeneration control that cannot apply its draft.'
);
alt_text_pro_security_assert(
    substr_count($admin_source, "$(document).on('click', '#test-connection'") === 1
        && strpos($plugin_source, "$('#test-connection').on('click'") === false,
    'The settings connection button must have exactly one active click handler.'
);
alt_text_pro_security_assert(
    strpos($admin_source, "'<span class=\"log-filename\" title=\"' + result.filename") === false
        && strpos($admin_source, ".addClass('log-filename').attr('title', filename).text(filename)") !== false
        && strpos($admin_source, ".addClass('log-error').text(result.error)") !== false,
    'Bulk activity filenames and errors must be inserted as text, not HTML.'
);

fwrite(STDOUT, "WordPress security regression tests passed.\n");
