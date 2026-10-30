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

function add_filter()
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
// Upload generation runs later in one WP-Cron event. It is billed at most
// once: the event claims (deletes) the pending flag before calling the
// service, and bulk and manual generation claim it first. The only other
// event is the retry restore_pending_upload() queues after a Generate button
// claimed the upload but failed. (Behaviour is covered at the end of this file.)
$alt_text_pro_restore_source = substr($media_source, (int) strpos($media_source, 'public static function restore_pending_upload'));
$alt_text_pro_restore_source = substr($alt_text_pro_restore_source, 0, (int) strpos($alt_text_pro_restore_source, 'public static function is_upload_generation_running'));
alt_text_pro_security_assert(
    substr_count($media_source, 'wp_schedule_single_event(') === 2
        && substr_count($alt_text_pro_restore_source, 'wp_schedule_single_event(') === 1
        && strpos($media_source, 'if (!self::claim_pending_upload($attachment_id))') !== false
        && strpos($media_source, "delete_post_meta(\$attachment_id, self::PENDING_META)") !== false,
    'Automatic upload generation must schedule one event that claims the pending flag before billing.'
);
alt_text_pro_security_assert(
    strpos($bulk_source, 'AltTextPro_Media_Handler::claim_pending_upload($image_id);') !== false
        && strpos($bulk_source, 'AltTextPro_Media_Handler::is_upload_generation_running($image_id)') !== false
        && substr_count($plugin_source, 'AltTextPro_Media_Handler::claim_pending_upload($attachment_id);') === 2
        && strpos($media_source, '        self::claim_pending_upload($attachment_id);' . "\n\n" . '        $result = $api_client->generate_alt_text(') !== false,
    'Bulk, single-image, post and media regeneration must cancel a queued upload job before billing.'
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
// A run left by a closed tab is paused, not abandoned: it keeps the site's
// one run slot and stays resumable for 7 days (G5, 1.7.28).
$stale_run['last_updated'] = '2026-08-12 09:30:00';
$alt_text_pro_test_options[$stale_run_option] = $stale_run;
$alt_text_pro_test_transients['alt_text_pro_bulk_' . $second_run] = $stale_run;
$alt_text_pro_test_user_id = 41;
alt_text_pro_security_assert(
    is_array(alt_text_pro_invoke_private($processor, 'get_live_active_run')),
    'A run paused for 30 minutes must stay resumable and keep blocking a second run.'
);

$stale_run['last_updated'] = '2026-08-04 09:59:00';
$alt_text_pro_test_options[$stale_run_option] = $stale_run;
$alt_text_pro_test_transients['alt_text_pro_bulk_' . $second_run] = $stale_run;
alt_text_pro_security_assert(
    alt_text_pro_invoke_private($processor, 'get_live_active_run') === null,
    'A run with no progress for more than 7 days must stop blocking new runs.'
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

// Deferred upload generation bills an image at most once and never replaces
// alt text written after the upload.
if (!defined('MINUTE_IN_SECONDS')) {
    define('MINUTE_IN_SECONDS', 60);
}

$alt_text_pro_test_post_meta = array();

function absint($value)
{
    return abs(intval($value));
}

function get_post_meta($post_id, $key = '', $single = false)
{
    global $alt_text_pro_test_post_meta;
    return $alt_text_pro_test_post_meta[$post_id][$key] ?? '';
}

function delete_post_meta($post_id, $key)
{
    global $alt_text_pro_test_post_meta;
    if (!isset($alt_text_pro_test_post_meta[$post_id]) || !array_key_exists($key, $alt_text_pro_test_post_meta[$post_id])) {
        return false;
    }
    unset($alt_text_pro_test_post_meta[$post_id][$key]);
    return true;
}

require_once dirname(__DIR__) . '/alt-text-pro/includes/class-media-handler.php';

// Records billable calls instead of contacting the service.
class AltTextPro_Test_Media_Handler extends AltTextPro_Media_Handler
{
    public $calls = array();

    public function generate_alt_text_background($attachment_id, $force_overwrite = false, $user_id = 0)
    {
        $this->calls[] = array(
            'id' => $attachment_id,
            'force' => $force_overwrite,
            'running' => AltTextPro_Media_Handler::is_upload_generation_running($attachment_id),
        );
    }
}

$alt_text_pro_pending = AltTextPro_Media_Handler::PENDING_META;
$alt_text_pro_test_options['alt_text_pro_settings'] = array('auto_generate' => true, 'overwrite_existing' => false);
$media_handler = new AltTextPro_Test_Media_Handler();

// Nothing written since the upload: generate once, even if the event repeats.
$alt_text_pro_test_post_meta[201] = array($alt_text_pro_pending => array('alt' => ''), '_wp_attachment_image_alt' => '');
$media_handler->run_scheduled_generation(201, false, 41);
$media_handler->run_scheduled_generation(201, false, 41);
alt_text_pro_security_assert(
    count($media_handler->calls) === 1
        && $media_handler->calls[0]['running'] === true
        && !AltTextPro_Media_Handler::is_upload_generation_running(201)
        && !array_key_exists($alt_text_pro_pending, $alt_text_pro_test_post_meta[201]),
    'A queued upload must be described once, marked running only while it is described.'
);

// A person wrote alt text after the upload: keep it, even with overwrite on.
$alt_text_pro_test_options['alt_text_pro_settings']['overwrite_existing'] = true;
$alt_text_pro_test_post_meta[202] = array($alt_text_pro_pending => array('alt' => ''), '_wp_attachment_image_alt' => 'Written by hand');
$media_handler->calls = array();
$media_handler->run_scheduled_generation(202, true, 41);
alt_text_pro_security_assert(
    $media_handler->calls === array() && !array_key_exists($alt_text_pro_pending, $alt_text_pro_test_post_meta[202]),
    'Alt text written after the upload must never be replaced by the queued job.'
);

// Overwrite was on at upload but is off now: existing alt text stays.
$alt_text_pro_test_options['alt_text_pro_settings']['overwrite_existing'] = false;
$alt_text_pro_test_post_meta[203] = array($alt_text_pro_pending => array('alt' => 'Old alt'), '_wp_attachment_image_alt' => 'Old alt');
$media_handler->run_scheduled_generation(203, true, 41);
alt_text_pro_security_assert(
    $media_handler->calls === array(),
    'With overwrite turned off, the queued job must not replace existing alt text.'
);

// Overwrite on at upload and now, alt unchanged: regenerate with overwrite.
$alt_text_pro_test_options['alt_text_pro_settings']['overwrite_existing'] = true;
$alt_text_pro_test_post_meta[204] = array($alt_text_pro_pending => array('alt' => 'Old alt'), '_wp_attachment_image_alt' => 'Old alt');
$media_handler->run_scheduled_generation(204, true, 41);
alt_text_pro_security_assert(
    count($media_handler->calls) === 1 && $media_handler->calls[0]['force'] === true,
    'With overwrite on, unchanged alt text from the upload is regenerated once.'
);

// A bulk run or the Generate button reached the image first: the queued job
// must not bill it again.
$alt_text_pro_test_options['alt_text_pro_settings']['overwrite_existing'] = false;
$alt_text_pro_test_post_meta[205] = array($alt_text_pro_pending => array('alt' => ''), '_wp_attachment_image_alt' => '');
$media_handler->calls = array();
alt_text_pro_security_assert(
    AltTextPro_Media_Handler::claim_pending_upload(205) === true
        && AltTextPro_Media_Handler::claim_pending_upload(205) === false,
    'Only one caller can claim a queued upload.'
);
$media_handler->run_scheduled_generation(205, false, 41);
alt_text_pro_security_assert(
    $media_handler->calls === array(),
    'A queued upload claimed by bulk or manual generation must not be billed again.'
);

// Automatic generation turned off before the job ran: do nothing.
$alt_text_pro_test_options['alt_text_pro_settings']['auto_generate'] = false;
$alt_text_pro_test_post_meta[206] = array($alt_text_pro_pending => array('alt' => ''), '_wp_attachment_image_alt' => '');
$media_handler->run_scheduled_generation(206, false, 41);
alt_text_pro_security_assert(
    $media_handler->calls === array(),
    'A queued upload must not be described after automatic generation was turned off.'
);

fwrite(STDOUT, "WordPress security regression tests passed.\n");
