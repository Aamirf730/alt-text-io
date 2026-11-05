<?php
/**
 * A JPEG whose EXIF orientation is not "upright" must not be sent to the
 * service byte for byte: it goes through the image editor, which rotates it.
 *
 * Run with: php wordpress-plugin/tests/exif-orientation.php
 */

define('ABSPATH', __DIR__ . '/');

require_once dirname(__DIR__) . '/alt-text-pro/includes/class-api-client.php';

function alt_text_pro_exif_assert($condition, $message)
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
    echo "PASS: {$message}\n";
}

/**
 * A small JPEG, optionally with an EXIF APP1 segment holding one
 * Orientation tag (little-endian TIFF, one IFD entry).
 */
function alt_text_pro_exif_jpeg($orientation = null)
{
    $image = imagecreatetruecolor(40, 20);
    imagefilledrectangle($image, 0, 0, 39, 19, imagecolorallocate($image, 30, 90, 160));
    ob_start();
    imagejpeg($image, null, 80);
    $jpeg = ob_get_clean();
    imagedestroy($image);

    if ($orientation === null) {
        return $jpeg;
    }

    $tiff = 'II' . pack('v', 42) . pack('V', 8)
        . pack('v', 1)
        . pack('v', 0x0112) . pack('v', 3) . pack('V', 1) . pack('v', $orientation) . pack('v', 0)
        . pack('V', 0);
    $payload = "Exif\0\0" . $tiff;
    $app1 = "\xFF\xE1" . pack('n', strlen($payload) + 2) . $payload;

    // Insert right after the SOI marker.
    return substr($jpeg, 0, 2) . $app1 . substr($jpeg, 2);
}

$dir = sys_get_temp_dir() . '/alt-text-pro-exif-' . getmypid();
@mkdir($dir);
$files = array(
    'none' => alt_text_pro_exif_jpeg(null),
    'upright' => alt_text_pro_exif_jpeg(1),
    'rotated' => alt_text_pro_exif_jpeg(6),
);
foreach ($files as $name => $bytes) {
    file_put_contents("{$dir}/{$name}.jpg", $bytes);
}

alt_text_pro_exif_assert(
    AltTextPro_API_Client::needs_exif_rotation("{$dir}/rotated.jpg", 'image/jpeg') === true,
    'A JPEG with EXIF orientation 6 needs rotating before it is sent.'
);
alt_text_pro_exif_assert(
    AltTextPro_API_Client::needs_exif_rotation("{$dir}/upright.jpg", 'image/jpeg') === false,
    'A JPEG with EXIF orientation 1 is sent as it is.'
);
alt_text_pro_exif_assert(
    AltTextPro_API_Client::needs_exif_rotation("{$dir}/none.jpg", 'image/jpeg') === false,
    'A JPEG without EXIF is sent as it is.'
);
alt_text_pro_exif_assert(
    AltTextPro_API_Client::needs_exif_rotation("{$dir}/rotated.jpg", 'image/png') === false
        && AltTextPro_API_Client::needs_exif_rotation("{$dir}/missing.jpg", 'image/jpeg') === false,
    'Other formats and missing files are never treated as rotated.'
);

$source = file_get_contents(dirname(__DIR__) . '/alt-text-pro/includes/class-api-client.php');
$resize = substr($source, (int) strpos($source, 'private function get_resized_image_data'));
alt_text_pro_exif_assert(
    strpos($resize, '$editor->maybe_exif_rotate();') !== false
        && strpos($resize, '$editor->maybe_exif_rotate();') < strpos($resize, '$editor->save('),
    'The resize step applies EXIF orientation before it re-encodes the image.'
);

foreach (array_keys($files) as $name) {
    @unlink("{$dir}/{$name}.jpg");
}
@rmdir($dir);
