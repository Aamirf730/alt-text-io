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
    strpos($encrypted_key, 'enc:') === 0,
    'The fixture API key should be encrypted before the internal save.'
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

fwrite(STDOUT, "PASS: encrypted API-key persistence regression\n");
