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

function sanitize_textarea_field($value)
{
    // Like WordPress: invalid UTF-8 makes the whole value empty.
    $value = (string) $value;
    return preg_match('//u', $value) === 1 ? trim(strip_tags($value)) : '';
}

class AltTextPro_Test_Exit extends Exception
{
}

$alt_text_pro_test_can_manage = true;
$alt_text_pro_test_redirect = '';

function current_user_can($capability)
{
    global $alt_text_pro_test_can_manage;
    return $alt_text_pro_test_can_manage;
}

function check_ajax_referer()
{
    return true;
}

function check_admin_referer($action, $name)
{
    if ($action !== 'alt_text_pro_disconnect' || $name !== 'alt_text_pro_disconnect_nonce') {
        throw new AltTextPro_Test_Exit('bad nonce');
    }
    return true;
}

function wp_send_json_success($data = null)
{
    throw new AltTextPro_Test_Exit('json_success');
}

function wp_die($message = '')
{
    throw new AltTextPro_Test_Exit('die');
}

function admin_url($path = '')
{
    return 'https://example.test/wp-admin/' . $path;
}

function add_query_arg($key, $value, $url)
{
    return $url . '&' . $key . '=' . $value;
}

function wp_safe_redirect($url)
{
    global $alt_text_pro_test_redirect;
    $alt_text_pro_test_redirect = $url;
    throw new AltTextPro_Test_Exit('redirect');
}

function __($text)
{
    return $text;
}

$alt_text_pro_test_disconnect_calls = array();

class AltTextPro_API_Client
{
    public static function validate_api_key_format($api_key)
    {
        return strpos($api_key, 'alt_') === 0 && strlen($api_key) > 20;
    }

    // Disconnect and reset tell the service the site stopped using the key.
    public function disconnect_site($api_key = null, $blocking = true)
    {
        global $alt_text_pro_test_disconnect_calls;
        $alt_text_pro_test_disconnect_calls[] = array('api_key' => $api_key, 'blocking' => $blocking);
        return true;
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

$legacy_iv = str_repeat('L', openssl_cipher_iv_length('aes-256-cbc'));
$legacy_ciphertext = openssl_encrypt(
    $api_key,
    'aes-256-cbc',
    hash('sha256', AUTH_KEY, true),
    OPENSSL_RAW_DATA,
    $legacy_iv
);
alt_text_pro_test_assert(
    is_string($legacy_ciphertext),
    'The legacy CBC compatibility fixture must be encryptable.'
);
$legacy_encrypted_key = 'enc:' . base64_encode($legacy_iv . $legacy_ciphertext);
$alt_text_pro_test_options['alt_text_pro_settings'] = array('api_key' => $legacy_encrypted_key);
$legacy_settings = $settings_handler->get_settings();
$legacy_storage = get_option('alt_text_pro_settings', array());
alt_text_pro_test_assert(
    $legacy_settings['api_key'] === $api_key
        && is_string($legacy_storage['api_key'])
        && strpos($legacy_storage['api_key'], 'enc2:') === 0,
    'Legacy CBC API-key records must remain readable and upgrade to authenticated encryption.'
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

// An empty key field in the settings form keeps the saved key.
$_SERVER['REQUEST_METHOD'] = 'POST';
$alt_text_pro_test_options['alt_text_pro_settings'] = array('api_key' => $encrypted_key, 'blog_context' => 'Travel');
update_option('alt_text_pro_settings', array('api_key' => ''));
alt_text_pro_test_assert(
    get_option('alt_text_pro_settings')['api_key'] === $encrypted_key,
    'An empty API key field must keep the saved key.'
);

// Reset must really remove the key (sanitize_settings used to restore it).
try {
    $settings_handler->ajax_reset_settings();
} catch (AltTextPro_Test_Exit $exit) {
}
alt_text_pro_test_assert(
    get_option('alt_text_pro_settings')['api_key'] === '',
    'Resetting settings must remove the saved API key.'
);
alt_text_pro_test_assert(
    get_option('alt_text_pro_settings')['blog_context'] === '',
    'Resetting settings must restore defaults.'
);

// The flag that allows removal must not leak into later saves.
$alt_text_pro_test_options['alt_text_pro_settings'] = array('api_key' => $encrypted_key);
update_option('alt_text_pro_settings', array('api_key' => ''));
alt_text_pro_test_assert(
    get_option('alt_text_pro_settings')['api_key'] === $encrypted_key,
    'After a reset, an empty key field must again keep the saved key.'
);

// Disconnect: nonce + manage_options, removes only the key.
$alt_text_pro_test_options['alt_text_pro_settings'] = array('api_key' => $encrypted_key, 'blog_context' => 'Travel');
$alt_text_pro_test_disconnect_calls = array();
$alt_text_pro_test_can_manage = false;
try {
    $settings_handler->handle_disconnect();
} catch (AltTextPro_Test_Exit $exit) {
}
alt_text_pro_test_assert(
    get_option('alt_text_pro_settings')['api_key'] === $encrypted_key && $alt_text_pro_test_disconnect_calls === array(),
    'A user without manage_options must not be able to disconnect.'
);
$alt_text_pro_test_can_manage = true;
try {
    $settings_handler->handle_disconnect();
} catch (AltTextPro_Test_Exit $exit) {
}
alt_text_pro_test_assert(
    get_option('alt_text_pro_settings')['api_key'] === ''
        && get_option('alt_text_pro_settings')['blog_context'] === 'Travel'
        && strpos($alt_text_pro_test_redirect, 'page=alt-text-pro-settings&alt_text_pro_disconnected=1') !== false,
    'Disconnect must remove the API key, keep other settings and redirect to the settings page.'
);
alt_text_pro_test_assert(
    $alt_text_pro_test_disconnect_calls === array(array('api_key' => $api_key, 'blocking' => true)),
    'Disconnect must tell the service once, with the decrypted key, and wait for the answer.'
);
alt_text_pro_test_assert(
    strpos($settings_template, 'id="alt-text-pro-disconnect-form"') !== false
        && strpos($settings_template, 'value="alt_text_pro_disconnect"') !== false
        && strpos($settings_template, "wp_nonce_field('alt_text_pro_disconnect', 'alt_text_pro_disconnect_nonce', false)") !== false,
    'The settings page must render a nonce-protected disconnect form.'
);

// Long non-English blog context is shortened by characters, not erased.
$cyrillic = str_repeat('Ж', 600);
update_option('alt_text_pro_settings', array('blog_context' => $cyrillic));
$stored_context = get_option('alt_text_pro_settings')['blog_context'];
alt_text_pro_test_assert(
    $stored_context === str_repeat('Ж', 500),
    'A long multibyte blog context must be cut to 500 characters, not erased.'
);
alt_text_pro_test_assert(
    AltTextPro_Settings::truncate_text('日本語テキスト', 3) === '日本語',
    'truncate_text() must count characters.'
);
alt_text_pro_test_assert(
    strpos($settings_template, 'name="alt_text_pro_settings[blog_context]" rows="3" maxlength="500"') !== false,
    'The blog context textarea must be limited to 500 characters.'
);
unset($_SERVER['REQUEST_METHOD']);

fwrite(STDOUT, "PASS: encrypted API-key persistence regression\n");
