<?php
/**
 * Regression coverage for Gutenberg post-content alt synchronization.
 *
 * Run with: php wordpress-plugin/tests/gutenberg-post-content-sync.php
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

function esc_attr($value)
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

function wp_json_encode($value)
{
    return json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

function parse_blocks($content)
{
    $blocks = array();

    if (
        preg_match_all(
            '/<!--\s+wp:image\s+(\{.*?\})\s+-->(.*?)<!--\s+\/wp:image\s+-->/s',
            $content,
            $matches,
            PREG_SET_ORDER
        )
    ) {
        foreach ($matches as $match) {
            $blocks[] = array(
                'blockName' => 'core/image',
                'attrs' => json_decode($match[1], true),
                'innerBlocks' => array(),
                'innerHTML' => $match[2],
                'innerContent' => array($match[2]),
            );
        }
    }

    return $blocks;
}

function serialize_block($block)
{
    return '<!-- wp:image ' . wp_json_encode($block['attrs']) . ' -->'
        . $block['innerHTML']
        . '<!-- /wp:image -->';
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

$sync_post_method = new ReflectionMethod('AltTextPro', 'sync_post_content_image_alt_text');
$sync_post_method->setAccessible(true);

$sync_html_method = new ReflectionMethod('AltTextPro', 'sync_html_image_alt_text');
$sync_html_method->setAccessible(true);

$gutenberg_content = '<!-- wp:image {"id":123,"alt":"Old block alt"} -->'
    . '<figure class="wp-block-image size-large"><img src="a.jpg" alt="Old block alt" class="wp-image-123" /></figure>'
    . '<!-- /wp:image -->';

$updated_gutenberg = $sync_post_method->invoke(
    $plugin,
    $gutenberg_content,
    array(123 => 'Fresh alt text & detail')
);

alt_text_pro_test_assert(
    strpos($updated_gutenberg, '"alt":"Fresh alt text & detail"') !== false,
    'The Gutenberg block comment metadata must receive the new alt text.'
);
alt_text_pro_test_assert(
    strpos($updated_gutenberg, 'alt="Fresh alt text &amp; detail"') !== false,
    'The rendered Gutenberg <img> tag must receive the escaped new alt text.'
);
alt_text_pro_test_assert(
    strpos($updated_gutenberg, 'Old block alt') === false,
    'The old Gutenberg alt text must not remain in either block metadata or rendered HTML.'
);

$classic_content = '<p><img class="alignnone wp-image-456" src="b.jpg" alt="Old classic alt" /></p>'
    . '<p><img class="alignnone wp-image-999" src="c.jpg" alt="Keep me" /></p>';

$updated_classic = $sync_html_method->invoke(
    $plugin,
    $classic_content,
    array(456 => 'Classic replacement')
);

alt_text_pro_test_assert(
    strpos($updated_classic, 'wp-image-456') !== false
        && strpos($updated_classic, 'alt="Classic replacement"') !== false
        && strpos($updated_classic, 'Old classic alt') === false,
    'Classic post content images must receive regenerated alt text.'
);
alt_text_pro_test_assert(
    strpos($updated_classic, 'wp-image-999') !== false
        && strpos($updated_classic, 'alt="Keep me"') !== false,
    'Non-target images must not be modified.'
);

// Core image blocks read alt from the markup; the plugin must not add an
// "alt" attribute to the block comment, which would re-save every post.
$core_image_content = '<!-- wp:image {"id":321,"sizeSlug":"large"} -->'
    . '<figure class="wp-block-image size-large"><img src="d.jpg" alt="" class="wp-image-321" /></figure>'
    . '<!-- /wp:image -->';
$updated_core_image = $sync_post_method->invoke(
    $plugin,
    $core_image_content,
    array(321 => 'A red bicycle')
);
alt_text_pro_test_assert(
    strpos($updated_core_image, '{"id":321,"sizeSlug":"large"}') !== false
        && strpos($updated_core_image, '"alt":') === false,
    'A block comment without an alt attribute must not gain one.'
);
alt_text_pro_test_assert(
    strpos($updated_core_image, 'alt="A red bicycle"') !== false,
    'The rendered image markup must still receive the new alt text.'
);

$already_synced = '<!-- wp:image {"id":321} -->'
    . '<figure class="wp-block-image"><img src="d.jpg" alt="A red bicycle" class="wp-image-321" /></figure>'
    . '<!-- /wp:image -->';
alt_text_pro_test_assert(
    $sync_post_method->invoke($plugin, $already_synced, array(321 => 'A red bicycle')) === $already_synced,
    'Content that already matches must be returned unchanged so the post is not re-saved.'
);

$plugin_source = file_get_contents(dirname(__DIR__) . '/alt-text-pro/alt-text-pro.php');
alt_text_pro_test_assert(
    strpos($plugin_source, "wp_update_post(wp_slash(array(") !== false,
    'Post content must be slashed before wp_update_post() so backslashes survive.'
);

fwrite(STDOUT, "PASS: Gutenberg post-content alt synchronization regression\n");
