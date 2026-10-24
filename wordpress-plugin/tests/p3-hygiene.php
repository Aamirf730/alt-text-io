<?php
/**
 * Static regression checks for the P3.24–P3.31 plugin maintenance fixes.
 *
 * This test intentionally avoids loading WordPress so it can run in the
 * lightweight PHP test environment used by the repository.
 */

function alt_text_pro_p3_assert($condition, $message)
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

function alt_text_pro_p3_read($path)
{
    $contents = file_get_contents($path);
    alt_text_pro_p3_assert($contents !== false, "Could not read {$path}");
    return $contents;
}

function alt_text_pro_p3_contains($contents, $needle, $message)
{
    alt_text_pro_p3_assert(strpos($contents, $needle) !== false, $message);
}

function alt_text_pro_p3_absent($contents, $needle, $message)
{
    alt_text_pro_p3_assert(strpos($contents, $needle) === false, $message);
}

$plugin_root = dirname(__DIR__) . '/alt-text-pro';
$main = alt_text_pro_p3_read($plugin_root . '/alt-text-pro.php');
$media = alt_text_pro_p3_read($plugin_root . '/includes/class-media-handler.php');
$bulk = alt_text_pro_p3_read($plugin_root . '/includes/class-bulk-processor.php');
$admin = alt_text_pro_p3_read($plugin_root . '/includes/class-admin.php');
$settings = alt_text_pro_p3_read($plugin_root . '/includes/class-settings.php');
$uninstall = alt_text_pro_p3_read($plugin_root . '/uninstall.php');
$admin_js = alt_text_pro_p3_read($plugin_root . '/assets/js/admin.js');
$readme = alt_text_pro_p3_read($plugin_root . '/readme.txt');

alt_text_pro_p3_contains($main, "load_plugin_textdomain('alt-text-pro'", 'The plugin text domain must be loaded.');
alt_text_pro_p3_absent($main, "// load_plugin_textdomain('alt-text-pro'", 'The plugin text-domain call must not remain commented out.');
alt_text_pro_p3_contains($main, '$settings[\'context_enabled\']', 'Post generation must use the context_enabled setting.');
alt_text_pro_p3_absent($main, '$settings[\'use_context\']', 'The obsolete use_context setting must not be read.');
// Header, version constant, readme stable tag and changelog must agree.
preg_match('/^\s*\*\s*Version:\s*(\S+)/m', $main, $alt_text_pro_header_version);
preg_match("/define\('ALT_TEXT_PRO_VERSION', '([^']+)'\);/", $main, $alt_text_pro_constant_version);
preg_match('/^Stable tag:\s*(\S+)/m', $readme, $alt_text_pro_stable_tag);
$alt_text_pro_version = $alt_text_pro_header_version[1] ?? '';
if ($alt_text_pro_version === '' || preg_match('/^\d+\.\d+\.\d+$/', $alt_text_pro_version) !== 1) {
    fwrite(STDERR, "FAIL: The plugin header must declare a semantic version.\n");
    exit(1);
}
if (($alt_text_pro_constant_version[1] ?? '') !== $alt_text_pro_version) {
    fwrite(STDERR, "FAIL: ALT_TEXT_PRO_VERSION must match the plugin header version.\n");
    exit(1);
}
if (($alt_text_pro_stable_tag[1] ?? '') !== $alt_text_pro_version) {
    fwrite(STDERR, "FAIL: The readme stable tag must match the plugin version.\n");
    exit(1);
}
alt_text_pro_p3_contains($readme, '= ' . $alt_text_pro_version . ' =', 'The readme changelog must have an entry for the current version.');
alt_text_pro_p3_contains($readme, '== External services ==', 'The readme must disclose the external service for WordPress.org review.');

alt_text_pro_p3_contains($media, "wp_ajax_alt_text_pro_get_context_suggestions", 'Context suggestions must have a registered AJAX handler.');
alt_text_pro_p3_contains($media, "check_ajax_referer('alt_text_pro_nonce', 'nonce')", 'Context suggestions must verify the AJAX nonce.');
alt_text_pro_p3_contains($media, 'sanitize_text_field((string) ($result[\'alt_text\'] ?? \'\'))', 'Background-generated alt text must be sanitized before storage.');
alt_text_pro_p3_absent($media, 'basename(get_attached_file(', 'Media filename extraction must be safe when get_attached_file returns false.');
alt_text_pro_p3_contains($bulk, 'sanitize_text_field((string) $result[\'alt_text\'])', 'Bulk-generated alt text must be sanitized before storage.');
alt_text_pro_p3_absent($bulk, 'basename(get_attached_file(', 'Bulk filename extraction must be safe when get_attached_file returns false.');

alt_text_pro_p3_absent($admin, 'CURDATE()', 'Dashboard statistics must not use the database server date.');
alt_text_pro_p3_absent($admin, 'MONTH(CURDATE())', 'Monthly statistics must not use the database server month.');
alt_text_pro_p3_contains($admin, "current_time('Y-m-d')", 'Daily statistics must use the WordPress site date.');
alt_text_pro_p3_contains($admin, "current_time('Y-m')", 'Monthly statistics must use the WordPress site month.');

alt_text_pro_p3_contains($uninstall, 'alt_text_pro_api_key_storage_error', 'Uninstall must remove the API-key storage error option.');
alt_text_pro_p3_contains($uninstall, 'alt_text_pro_bulk_state_', 'Uninstall must remove durable bulk-state options.');

foreach (array(
    '#toggle-api-key',
    '.section-toggle',
    '.copy-to-clipboard',
    '.refresh-data',
    '[data-tooltip]',
    'initTooltips',
    'refreshData:',
    'alt_text_pro_refresh_'
) as $dead_binding) {
    alt_text_pro_p3_absent($admin_js, $dead_binding, "Dead admin binding remains: {$dead_binding}");
}

alt_text_pro_p3_absent($settings, 'id="toggle-api-key"', 'The obsolete API-key toggle control must not be rendered.');

echo "P3.24–P3.31 hygiene checks passed.\n";
