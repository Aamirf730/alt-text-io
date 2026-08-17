<?php
/**
 * Regression coverage for post-image permission reporting.
 *
 * Run with: php wordpress-plugin/tests/post-attachment-permissions.php
 */

define('ABSPATH', __DIR__ . '/');

function add_action()
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

function get_post($post_id)
{
    return (object) array(
        'ID' => intval($post_id),
        'post_content' => '<p><img class="wp-image-101" src="a.jpg" />'
            . '<img class="wp-image-102" src="b.jpg" />'
            . '<img data-id="103" src="c.jpg" /></p>',
    );
}

function get_post_thumbnail_id($post_id)
{
    return 101;
}

function wp_attachment_is_image($attachment_id)
{
    return in_array(intval($attachment_id), array(101, 102, 103), true);
}

function current_user_can($capability, $object_id = null)
{
    if ($capability === 'edit_post') {
        return intval($object_id) !== 102;
    }

    return true;
}

require_once dirname(__DIR__) . '/alt-text-pro/alt-text-pro.php';

function alt_text_pro_test_assert($condition, $message)
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

$plugin = AltTextPro::get_instance();
$attachments_method = new ReflectionMethod('AltTextPro', 'get_post_image_attachments');
$attachments_method->setAccessible(true);
$warning_method = new ReflectionMethod('AltTextPro', 'get_attachment_permission_warning');
$warning_method->setAccessible(true);

$permission_skipped_ids = array();
$attachments = $attachments_method->invokeArgs($plugin, array(55, &$permission_skipped_ids));

alt_text_pro_test_assert(
    $attachments === array(101, 103),
    'The attachment list must retain only images the current user can edit.'
);
alt_text_pro_test_assert(
    $permission_skipped_ids === array(102),
    'The permission-filtered attachment ID must be returned separately for reporting.'
);

$warning = $warning_method->invoke($plugin, $permission_skipped_ids);

alt_text_pro_test_assert(
    is_array($warning)
        && $warning['code'] === 'insufficient_attachment_permissions'
        && $warning['attachment_ids'] === array(102),
    'Permission-filtered IDs must produce the structured insufficient-permissions warning.'
);
alt_text_pro_test_assert(
    strpos($warning['message'], '1 image(s) skipped') !== false,
    'The warning must tell the administrator that an image was skipped.'
);

fwrite(STDOUT, "PASS: post attachment permission reporting regression\n");
