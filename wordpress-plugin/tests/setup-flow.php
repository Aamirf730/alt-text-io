<?php
/**
 * Static regression checks for the first-run setup flow, found in a real
 * install walk-through on 2026-11-05:
 *  - a key pasted with a leading space was rejected in the setup window;
 *  - key-check messages showed &quot; because admin.js prints them as text;
 *  - after reconnecting, the reload kept showing "account was disconnected".
 *
 * Runs without WordPress, like the other tests in this folder.
 */

function alt_text_pro_setup_assert($condition, $message)
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

function alt_text_pro_setup_read($path)
{
    $contents = file_get_contents($path);
    alt_text_pro_setup_assert($contents !== false, "Could not read {$path}");
    return $contents;
}

/** The body of a function, from its declaration to the next one. */
function alt_text_pro_setup_slice($contents, $start_needle, $end_needle)
{
    $start = strpos($contents, $start_needle);
    alt_text_pro_setup_assert($start !== false, "Missing {$start_needle}");
    $end = strpos($contents, $end_needle, $start + strlen($start_needle));
    alt_text_pro_setup_assert($end !== false, "Missing {$end_needle} after {$start_needle}");
    return substr($contents, $start, $end - $start);
}

$plugin_root = dirname(__DIR__) . '/alt-text-pro';
$main = alt_text_pro_setup_read($plugin_root . '/alt-text-pro.php');
$settings = alt_text_pro_setup_read($plugin_root . '/includes/class-settings.php');
$settings_template = alt_text_pro_setup_read($plugin_root . '/templates/settings.php');
$admin_js = alt_text_pro_setup_read($plugin_root . '/assets/js/admin.js');

// 1. The setup window trims the pasted key before checking its format.
$onboarding_save = alt_text_pro_setup_slice($admin_js, 'handleOnboardingSave: function', 'validateAPIKeyFormat(apiKey)');
alt_text_pro_setup_assert(
    strpos($onboarding_save, "\$.trim(\$('#onboarding_api_key').val())") !== false,
    'The setup window must trim the pasted API key before validating it.'
);

// 2. JSON replies of the key checks are plain text (admin.js uses .text()).
$validate_key = alt_text_pro_setup_slice($main, 'public function ajax_validate_key()', 'public function ');
$test_connection = alt_text_pro_setup_slice($settings, 'public function ajax_test_connection()', 'public function ');
foreach (array('ajax_validate_key' => $validate_key, 'ajax_test_connection' => $test_connection) as $name => $body) {
    alt_text_pro_setup_assert(
        !preg_match("/esc_html__\\('[^']*\"/", $body),
        "{$name} must not HTML-escape JSON messages that contain quotes; admin.js shows them as text."
    );
}
alt_text_pro_setup_assert(
    strpos($admin_js, "\$msg.text(message)") !== false,
    'The setup window message is expected to be set with .text(); revisit check 2 if that changes.'
);

// 3. The "disconnected" flag is removable and its notice needs no saved key.
alt_text_pro_setup_assert(
    strpos($main, "add_filter('removable_query_args', array(\$this, 'removable_query_args'))") !== false,
    'The plugin must register its one-time query flags with removable_query_args.'
);
alt_text_pro_setup_assert(
    strpos(alt_text_pro_setup_slice($main, 'public function removable_query_args(', 'public function '), "'alt_text_pro_disconnected'") !== false,
    'alt_text_pro_disconnected must be a removable query arg.'
);
alt_text_pro_setup_assert(
    preg_match("/if \\(\\\$alt_text_pro_disconnected === '1' && \\\$alt_text_pro_has_key\\)/", $settings_template) === 1,
    'The settings page must not show the "disconnected" notice while a key is saved.'
);

echo "PASS: first-run setup flow regression\n";
