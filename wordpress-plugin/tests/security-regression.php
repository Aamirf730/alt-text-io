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

function delete_transient($key)
{
    global $alt_text_pro_test_transients;
    unset($alt_text_pro_test_transients[$key]);
    return true;
}

class AltTextPro_Test_WPDB
{
    public $options = 'wp_options';

    public function prepare($query, ...$args)
    {
        return array('query' => $query, 'args' => $args);
    }

    public function esc_like($text)
    {
        return addcslashes($text, '_%\\');
    }

    public function get_col($prepared)
    {
        global $alt_text_pro_test_options;

        if (strpos($prepared['query'], 'SELECT option_name') !== 0) {
            return array();
        }

        $prefix = stripslashes(rtrim($prepared['args'][0], '%'));
        $names = array();
        foreach (array_keys($alt_text_pro_test_options) as $name) {
            if (strpos($name, $prefix) === 0) {
                $names[] = $name;
            }
        }

        return array_slice($names, 0, $prepared['args'][1]);
    }

    public function get_var($prepared)
    {
        global $alt_text_pro_test_options;

        if (strpos($prepared['query'], 'SELECT option_value') !== 0) {
            return null;
        }

        $name = $prepared['args'][0];
        return array_key_exists($name, $alt_text_pro_test_options)
            ? maybe_serialize($alt_text_pro_test_options[$name])
            : null;
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

// One bulk run per site: a second user cannot start a parallel run while the
// first one is live, and finishing the first run releases the site lock.
$alt_text_pro_test_user_id = 41;
$first_run = alt_text_pro_invoke_private(
    $processor,
    'create_bulk_process_record',
    array(array(101, 103), 1, false, 10, 2, 10, 0)
);
alt_text_pro_security_assert(
    alt_text_pro_invoke_private($processor, 'claim_active_run', array($first_run)) === true,
    'The first bulk run must claim the site-wide run lock.'
);

$alt_text_pro_test_user_id = 99;
alt_text_pro_security_assert(
    is_array(alt_text_pro_invoke_private($processor, 'get_live_active_run')),
    'Another user must see the first user\'s live run as blocking.'
);
alt_text_pro_security_assert(
    alt_text_pro_invoke_private($processor, 'get_bulk_process_data', array($first_run)) === false,
    'The site-wide lock must not expose another user\'s bulk job.'
);
$second_run = alt_text_pro_invoke_private(
    $processor,
    'create_bulk_process_record',
    array(array(101), 1, false, 10, 1, 10, 0)
);
alt_text_pro_security_assert(
    alt_text_pro_invoke_private($processor, 'claim_active_run', array($second_run)) === false,
    'A second concurrent bulk run must not claim the site-wide run lock.'
);

$alt_text_pro_test_user_id = 41;
alt_text_pro_invoke_private($processor, 'delete_bulk_process_state', array($first_run));
$alt_text_pro_test_user_id = 99;
alt_text_pro_security_assert(
    alt_text_pro_invoke_private($processor, 'claim_active_run', array($second_run)) === true,
    'Finishing a run must release the site-wide run lock for the next run.'
);

$alt_text_pro_test_options[$durable_state_option ?? 'unused'] = $alt_text_pro_test_options[$durable_state_option ?? 'unused'] ?? null;
$stale_run_option = alt_text_pro_invoke_private($processor, 'get_bulk_process_option_name', array($second_run));
$stale_run = $alt_text_pro_test_options[$stale_run_option];
$stale_run['last_updated'] = '2026-08-12 09:30:00';
$alt_text_pro_test_options[$stale_run_option] = $stale_run;
$alt_text_pro_test_transients['alt_text_pro_bulk_' . $second_run] = $stale_run;
$alt_text_pro_test_user_id = 41;
alt_text_pro_security_assert(
    alt_text_pro_invoke_private($processor, 'get_live_active_run') === null,
    'A run with no progress for 30 minutes must stop blocking new runs.'
);

$bulk_source = file_get_contents(dirname(__DIR__) . '/alt-text-pro/includes/class-bulk-processor.php');
alt_text_pro_security_assert(
    strpos($bulk_source, 'LIMIT %d",\n                \'image/%\',\n                1000') === false
        && substr_count($bulk_source, 'self::MAX_BULK_QUEUE') >= 3,
    'Bulk queues must use the shared queue cap instead of the old 1,000-image limit.'
);

// Daily cleanup of saved bulk state: removes finished runs and runs idle for
// more than three days, but never the run that holds the site-wide lock.
$alt_text_pro_cleanup_set_state = function ($run_id, array $changes) use ($processor) {
    global $alt_text_pro_test_options, $alt_text_pro_test_transients;
    $option = alt_text_pro_invoke_private($processor, 'get_bulk_process_option_name', array($run_id));
    $state = array_merge($alt_text_pro_test_options[$option], $changes);
    $alt_text_pro_test_options[$option] = $state;
    $alt_text_pro_test_transients['alt_text_pro_bulk_' . $run_id] = $state;
    return $option;
};

$alt_text_pro_test_user_id = 41;
delete_option('alt_text_pro_active_bulk_run');
$live_idle_run = alt_text_pro_invoke_private($processor, 'create_bulk_process_record', array(array(101), 1, false, 10, 1, 10, 0));
alt_text_pro_security_assert(
    alt_text_pro_invoke_private($processor, 'claim_active_run', array($live_idle_run)) === true,
    'The cleanup fixture run must hold the site-wide lock.'
);
$live_idle_option = $alt_text_pro_cleanup_set_state($live_idle_run, array('last_updated' => '2026-08-08 10:00:00'));

$recent_run = alt_text_pro_invoke_private($processor, 'create_bulk_process_record', array(array(101), 1, false, 10, 1, 10, 0));
$recent_option = $alt_text_pro_cleanup_set_state($recent_run, array('last_updated' => '2026-08-12 09:00:00'));

$recent_idle_run = alt_text_pro_invoke_private($processor, 'create_bulk_process_record', array(array(101), 1, false, 10, 1, 10, 0));
$recent_idle_option = $alt_text_pro_cleanup_set_state($recent_idle_run, array('last_updated' => '2026-08-10 10:00:00'));

$abandoned_run = alt_text_pro_invoke_private($processor, 'create_bulk_process_record', array(array(101), 1, false, 10, 1, 10, 0));
$abandoned_option = $alt_text_pro_cleanup_set_state($abandoned_run, array('last_updated' => '2026-08-08 09:00:00'));
$alt_text_pro_test_options['alt_text_pro_bulk_lock_' . substr($abandoned_option, strlen('alt_text_pro_bulk_state_'))] = array('token' => 'x', 'expires_at' => 1);

$finished_run = alt_text_pro_invoke_private($processor, 'create_bulk_process_record', array(array(101), 1, false, 10, 1, 10, 0));
$finished_option = $alt_text_pro_cleanup_set_state($finished_run, array('status' => 'completed', 'completed_at' => '2026-08-12 09:59:00'));

$corrupt_option = 'alt_text_pro_bulk_state_' . hash('sha256', 'corrupt');
$alt_text_pro_test_options[$corrupt_option] = 'not a run';

$deleted_count = AltTextPro_Bulk_Processor::cleanup_stale_bulk_states();

alt_text_pro_security_assert(
    array_key_exists($live_idle_option, $alt_text_pro_test_options),
    'Cleanup must never delete the run that holds the site-wide lock, even when it looks idle.'
);
alt_text_pro_security_assert(
    array_key_exists($recent_option, $alt_text_pro_test_options)
        && array_key_exists($recent_idle_option, $alt_text_pro_test_options),
    'Cleanup must keep runs that made progress within the last three days.'
);
alt_text_pro_security_assert(
    !array_key_exists($abandoned_option, $alt_text_pro_test_options)
        && !array_key_exists('alt_text_pro_bulk_' . $abandoned_run, $alt_text_pro_test_transients)
        && !array_key_exists('alt_text_pro_bulk_lock_' . substr($abandoned_option, strlen('alt_text_pro_bulk_state_')), $alt_text_pro_test_options),
    'Cleanup must delete a run idle for more than three days with its transient and lock.'
);
alt_text_pro_security_assert(
    !array_key_exists($finished_option, $alt_text_pro_test_options)
        && !array_key_exists($corrupt_option, $alt_text_pro_test_options),
    'Cleanup must delete finished runs and unreadable state.'
);
alt_text_pro_security_assert(
    $deleted_count >= 3 && is_array(get_option('alt_text_pro_active_bulk_run', null)),
    'Cleanup must report deletions and leave the site-wide lock in place.'
);

$plugin_source = file_get_contents(dirname(__DIR__) . '/alt-text-pro/alt-text-pro.php');
$uninstall_source = file_get_contents(dirname(__DIR__) . '/alt-text-pro/uninstall.php');
alt_text_pro_security_assert(
    strpos($plugin_source, "wp_schedule_event(time() + HOUR_IN_SECONDS, 'daily', 'alt_text_pro_cleanup')") !== false
        && strpos($plugin_source, "add_action('alt_text_pro_cleanup', array('AltTextPro_Bulk_Processor', 'cleanup_stale_bulk_states'))") !== false
        && strpos($plugin_source, "wp_clear_scheduled_hook('alt_text_pro_cleanup')") !== false
        && strpos($uninstall_source, "wp_clear_scheduled_hook('alt_text_pro_cleanup')") !== false,
    'The daily cleanup must be scheduled on activation, handled, and cleared on deactivation and uninstall.'
);

fwrite(STDOUT, "WordPress security regression tests passed.\n");
