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

function add_filter()
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

// An alt the author wrote in the post is never replaced, in the block
// comment or in the rendered markup.
$gutenberg_content = '<!-- wp:image {"id":123,"alt":"Author block alt"} -->'
    . '<figure class="wp-block-image size-large"><img src="a.jpg" alt="Author block alt" class="wp-image-123" /></figure>'
    . '<!-- /wp:image -->';

alt_text_pro_test_assert(
    $sync_post_method->invoke($plugin, $gutenberg_content, array(123 => 'Generated alt')) === $gutenberg_content,
    'A non-empty in-post alt (block attribute and markup) must be preserved.'
);

// A block whose comment carries the author's alt keeps its markup too, even
// when the markup alt is empty.
$attr_only_content = '<!-- wp:image {"id":124,"alt":"Author alt"} -->'
    . '<figure class="wp-block-image"><img src="a.jpg" alt="" class="wp-image-124" /></figure>'
    . '<!-- /wp:image -->';
alt_text_pro_test_assert(
    $sync_post_method->invoke($plugin, $attr_only_content, array(124 => 'Generated alt')) === $attr_only_content,
    'An author-written block alt attribute must keep the block untouched.'
);

// An empty in-post alt is filled in both places.
$empty_gutenberg = '<!-- wp:image {"id":125,"alt":""} -->'
    . '<figure class="wp-block-image size-large"><img src="a.jpg" alt="" class="wp-image-125" /></figure>'
    . '<!-- /wp:image -->';
$updated_gutenberg = $sync_post_method->invoke(
    $plugin,
    $empty_gutenberg,
    array(125 => 'Fresh alt text & detail')
);
alt_text_pro_test_assert(
    strpos($updated_gutenberg, '"alt":"Fresh alt text & detail"') !== false,
    'An empty Gutenberg block alt attribute must be filled.'
);
alt_text_pro_test_assert(
    strpos($updated_gutenberg, '<img src="a.jpg" alt="Fresh alt text &amp; detail" class="wp-image-125" />') !== false,
    'An empty rendered alt must be filled in place with escaped text.'
);

$classic_content = '<p><img class="alignnone wp-image-456" src="b.jpg" alt="Author classic alt" /></p>'
    . '<p><img class="alignnone wp-image-457" src="b.jpg" alt="" /></p>'
    . '<p><img class="alignnone wp-image-458" src="b.jpg" title="The alt text matters"></p>'
    . '<p><img class="alignnone wp-image-459" src="b.jpg" alt=Unquoted /></p>'
    . '<p><img class="alignnone wp-image-999" src="c.jpg" alt="" /></p>';

$updated_classic = $sync_html_method->invoke(
    $plugin,
    $classic_content,
    array(
        456 => 'Generated 456',
        457 => 'Generated 457',
        458 => 'Generated 458',
        459 => 'Generated 459',
    )
);

alt_text_pro_test_assert(
    strpos($updated_classic, 'alt="Author classic alt"') !== false
        && strpos($updated_classic, 'Generated 456') === false,
    'A classic image with author-written alt text must keep it.'
);
alt_text_pro_test_assert(
    strpos($updated_classic, '<img class="alignnone wp-image-457" src="b.jpg" alt="Generated 457" />') !== false,
    'A classic image with an empty alt must be filled.'
);
alt_text_pro_test_assert(
    strpos($updated_classic, '<img class="alignnone wp-image-458" src="b.jpg" title="The alt text matters" alt="Generated 458">') !== false,
    'A classic image without alt must gain one, and text inside other attributes must stay intact.'
);
alt_text_pro_test_assert(
    strpos($updated_classic, 'alt=Unquoted') !== false && strpos($updated_classic, 'Generated 459') === false,
    'An unquoted non-empty alt must be preserved.'
);
alt_text_pro_test_assert(
    strpos($updated_classic, '<img class="alignnone wp-image-999" src="c.jpg" alt="" />') !== false,
    'Non-target images must not be modified.'
);

// wp-image-12 must not match wp-image-120.
alt_text_pro_test_assert(
    $sync_html_method->invoke($plugin, '<img class="wp-image-120" alt="" />', array(12 => 'Wrong image')) === '<img class="wp-image-120" alt="" />',
    'Attachment IDs must match exactly.'
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
