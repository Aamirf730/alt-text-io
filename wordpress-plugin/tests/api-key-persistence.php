<?php
/**
 * Regression coverage for API-key persistence through the WordPress option sanitizer.
 *
 * Run with: php wordpress-plugin/tests/api-key-persistence.php
 */

define('ABSPATH', __DIR__ . '/');
define('AUTH_KEY', 'alt-text-pro-regression-test-auth-key');

$alt_text_pro_test_options = array();
$alt_text_pro_test_registered_settings = array();
$alt_text_pro_test_settings_errors = array();

function add_action()
{
}

function register_setting($group, $name, $args)
{
    global $alt_text_pro_test_registered_settings;
    $alt_text_pro_test_registered_settings[$name] = $args;
}

function add_settings_section()
{
}

function add_settings_field()
{
}

function get_option($name, $default = false)
{
    global $alt_text_pro_test_options;
    return array_key_exists($name, $alt_text_pro_test_options)
        ? $alt_text_pro_test_options[$name]
        : $default;
}

function update_option($name, $value)
{
    global $alt_text_pro_test_options, $alt_text_pro_test_registered_settings;

    if (isset($alt_text_pro_test_registered_settings[$name]['sanitize_callback'])) {
        $value = call_user_func(
            $alt_text_pro_test_registered_settings[$name]['sanitize_callback'],
            $value
        );
    }

    $changed = !array_key_exists($name, $alt_text_pro_test_options)
        || $alt_text_pro_test_options[$name] !== $value;
    $alt_text_pro_test_options[$name] = $value;

    return $changed;
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

function delete_option($name)
{
    global $alt_text_pro_test_options;
    if (!array_key_exists($name, $alt_text_pro_test_options)) {
        return false;
    }

    unset($alt_text_pro_test_options[$name]);
    return true;
}

function wp_parse_args($args, $defaults)
{
    return array_merge($defaults, $args);
}

function sanitize_text_field($value)
{
    return trim(strip_tags((string) $value));
}

function wp_unslash($value)
{
    return is_string($value) ? stripslashes($value) : $value;
}

function add_settings_error($setting, $code, $message, $type)
{
    global $alt_text_pro_test_settings_errors;
    $alt_text_pro_test_settings_errors[] = compact('setting', 'code', 'message', 'type');
}

function esc_html__($text)
{
    return $text;
}

function __($text)
{
    return $text;
}

class AltTextPro_API_Client
{
    public static function validate_api_key_format($api_key)
    {
        return strpos($api_key, 'alt_') === 0 && strlen($api_key) > 20;
    }
}

require_once dirname(__DIR__) . '/alt-text-pro/includes/class-settings.php';

function alt_text_pro_test_assert($condition, $message)
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$settings_handler = new AltTextPro_Settings();
$settings_handler->register_settings();

$api_key = 'alt_regression_test_key_1234567890';
$encrypted_key = $settings_handler->encrypt_api_key($api_key);

alt_text_pro_test_assert(
    is_string($encrypted_key) && strpos($encrypted_key, 'enc2:') === 0,
    'The fixture API key should use authenticated encryption before the internal save.'
);

$encrypted_bytes = base64_decode(substr($encrypted_key, 5), true);
$encrypted_bytes[strlen($encrypted_bytes) - 1] = chr(ord($encrypted_bytes[strlen($encrypted_bytes) - 1]) ^ 1);
$tampered_key = 'enc2:' . base64_encode($encrypted_bytes);
alt_text_pro_test_assert(
    $settings_handler->decrypt_api_key($tampered_key) === false,
    'Authenticated encryption must reject a modified API-key record.'
);

$_SERVER['REQUEST_METHOD'] = 'POST';
update_option(
    'alt_text_pro_settings',
    array(
        'api_key' => $encrypted_key,
        'auto_generate' => false,
    )
);

$stored_settings = get_option('alt_text_pro_settings', array());
alt_text_pro_test_assert(
    isset($stored_settings['api_key']) && $stored_settings['api_key'] === $encrypted_key,
    'A validated encrypted API key must survive the registered option sanitizer unchanged.'
);
alt_text_pro_test_assert(
    ($stored_settings['context_enabled'] ?? null) === true,
    'A partial POST save must preserve the default context-enabled setting.'
);
alt_text_pro_test_assert(
    $settings_handler->get_settings()['api_key'] === $api_key,
    'The saved API key must decrypt to the validated key during read-back.'
);

$settings_template = file_get_contents(dirname(__DIR__) . '/alt-text-pro/templates/settings.php');
foreach (array('auto_generate', 'overwrite_existing', 'show_context_field') as $checkbox) {
    alt_text_pro_test_assert(
        is_string($settings_template)
            && strpos($settings_template, 'name="alt_text_pro_settings[' . $checkbox . ']" value="0"') !== false,
        "The settings form must submit an explicit zero for an unchecked {$checkbox} checkbox."
    );
}

update_option(
    'alt_text_pro_settings',
    array(
        'api_key' => $encrypted_key,
        'auto_generate' => true,
        'overwrite_existing' => true,
        'context_enabled' => true,
        'show_context_field' => true,
    )
);

update_option(
    'alt_text_pro_settings',
    array(
        'api_key' => $encrypted_key,
        'auto_generate' => '0',
        'overwrite_existing' => '0',
        'show_context_field' => '0',
    )
);
$stored_settings = get_option('alt_text_pro_settings', array());
foreach (array('auto_generate', 'overwrite_existing', 'show_context_field') as $checkbox) {
    alt_text_pro_test_assert(
        ($stored_settings[$checkbox] ?? null) === false,
        "An unchecked settings form must be able to disable {$checkbox}."
    );
}
alt_text_pro_test_assert(
    ($stored_settings['context_enabled'] ?? null) === true,
    'A settings form submission that omits context_enabled must preserve it.'
);

update_option(
    'alt_text_pro_settings',
    array(
        'api_key' => $encrypted_key,
        'auto_generate' => true,
        'overwrite_existing' => true,
        'context_enabled' => true,
        'show_context_field' => true,
    )
);

update_option('alt_text_pro_settings', array('api_key' => $encrypted_key));
$stored_settings = get_option('alt_text_pro_settings', array());
foreach (array('auto_generate', 'overwrite_existing', 'context_enabled', 'show_context_field') as $checkbox) {
    alt_text_pro_test_assert(
        ($stored_settings[$checkbox] ?? null) === true,
        "A partial POST save must preserve the existing {$checkbox} setting."
    );
}

$stored_key_before_invalid_save = $stored_settings['api_key'];
update_option('alt_text_pro_settings', array('api_key' => 'enc:not-valid-ciphertext'));
$stored_settings = get_option('alt_text_pro_settings', array());

alt_text_pro_test_assert(
    $stored_settings['api_key'] === $stored_key_before_invalid_save,
    'An invalid encrypted value must not replace the existing API key.'
);
alt_text_pro_test_assert(
    count($alt_text_pro_test_settings_errors) === 1,
    'An invalid encrypted value should register one settings error.'
);

unset($_SERVER['REQUEST_METHOD']);

$alt_text_pro_test_options['alt_text_pro_settings'] = array('api_key' => $api_key);
$migrated_settings = $settings_handler->get_settings();
$migrated_storage = get_option('alt_text_pro_settings', array());
alt_text_pro_test_assert(
    $migrated_settings['api_key'] === $api_key
        && is_string($migrated_storage['api_key'])
        && strpos($migrated_storage['api_key'], 'enc2:') === 0,
    'A legacy plain-text key must be replaced by authenticated encrypted storage on read.'
);

$alt_text_pro_test_options['alt_text_pro_settings'] = array('api_key' => $tampered_key);
$failed_storage_settings = $settings_handler->get_settings();
alt_text_pro_test_assert(
    $failed_storage_settings['api_key'] === ''
        && get_option('alt_text_pro_api_key_storage_error', false) === '1',
    'A key that cannot be decrypted must fail closed and create one persistent storage warning.'
);
$settings_handler->get_settings();
alt_text_pro_test_assert(
    get_option('alt_text_pro_api_key_storage_error', false) === '1',
    'Repeated failed reads must reuse the existing storage warning.'
);

$alt_text_pro_test_options['alt_text_pro_settings'] = array('api_key' => $encrypted_key);
alt_text_pro_test_assert(
    $settings_handler->get_settings()['api_key'] === $api_key
        && get_option('alt_text_pro_api_key_storage_error', false) === false,
    'A subsequently valid encrypted key must clear the persistent storage warning.'
);

$admin_script = file_get_contents(dirname(__DIR__) . '/alt-text-pro/assets/js/admin.js');
alt_text_pro_test_assert(
    is_string($admin_script)
        && strpos($admin_script, 'window.crypto.getRandomValues') !== false
        && strpos($admin_script, 'alt_text_pro_api_key') === false,
    'The connect flow must use cryptographic state and must never accept an API key from a URL.'
);
alt_text_pro_test_assert(
    strpos($settings_template, '$has_key') === false,
    'The settings template must use its initialized API-key state variable.'
);

fwrite(STDOUT, "PASS: encrypted API-key persistence regression\n");
