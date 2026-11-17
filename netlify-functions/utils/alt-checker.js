/**
 * Alt text analysis for the public checker.
 * File: netlify-functions/utils/alt-checker.js
 *
 * Reads one HTML page and classifies every image's alt text. Pure function:
 * no network, no storage, so it is easy to test with fixtures.
 */

const { parse } = require('node-html-parser');

const MAX_IMAGES_RETURNED = 300;
const MAX_ALT_RETURNED = 500;
const MAX_SRC_RETURNED = 2048;
const TOO_LONG_CHARS = 150;
const DUPLICATE_MIN_IMAGES = 3;

const STATUS = {
  missing: { severity: 'error', label: 'Missing alt' },
  empty: { severity: 'review', label: 'Empty alt' },
  filename: { severity: 'review', label: 'File name' },
  generic: { severity: 'review', label: 'Too generic' },
  redundant_prefix: { severity: 'review', label: 'Starts with "image of"' },
  too_long: { severity: 'review', label: 'Very long' },
  duplicate: { severity: 'review', label: 'Repeated' },
  ok: { severity: 'ok', label: 'Looks fine' },
};

const GENERIC_ALTS = new Set([
  'image', 'images', 'img', 'photo', 'photos', 'picture', 'pictures', 'pic', 'graphic',
  'logo', 'icon', 'banner', 'placeholder', 'untitled', 'thumbnail', 'thumb', 'default',
  'null', 'undefined', 'none', 'alt', 'alt text', 'alttext', 'featured image', 'header image',
  'hero image', 'hero', 'slider', 'slide', 'spacer', 'blank', 'image description',
  'description', 'photograph', 'screenshot', 'avatar', 'background', 'gallery image',
]);

const TRACKING_HOSTS = [
  /(^|\.)facebook\.com$/i,
  /(^|\.)facebook\.net$/i,
  /(^|\.)google-analytics\.com$/i,
  /(^|\.)googletagmanager\.com$/i,
  /(^|\.)doubleclick\.net$/i,
  /(^|\.)bat\.bing\.com$/i,
  /(^|\.)px\.ads\.linkedin\.com$/i,
  /(^|\.)analytics\.twitter\.com$/i,
  /(^|\.)t\.co$/i,
  /(^|\.)pixel\.wp\.com$/i,
  /(^|\.)stats\.wp\.com$/i,
  /(^|\.)quantserve\.com$/i,
  /(^|\.)scorecardresearch\.com$/i,
];

function collapse(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function firstSrcsetUrl(srcset) {
  const first = String(srcset || '').split(',')[0] || '';
  return first.trim().split(/\s+/)[0] || '';
}

function resolveUrl(raw, base) {
  const value = collapse(raw);
  if (!value) return null;
  if (/^data:/i.test(value)) return value.slice(0, 64);
  try {
    return new URL(value, base).href.slice(0, MAX_SRC_RETURNED);
  } catch (error) {
    return null;
  }
}

/**
 * Pick the real image URL, preferring lazy-load attributes when src is empty
 * or a placeholder.
 */
function pickSource(element, base) {
  const src = collapse(element.getAttribute('src'));
  const lazy = ['data-src', 'data-lazy-src', 'data-original', 'data-lazy', 'data-url']
    .map((name) => collapse(element.getAttribute(name)))
    .find(Boolean);
  const srcset = firstSrcsetUrl(element.getAttribute('data-srcset') || element.getAttribute('data-lazy-srcset') || element.getAttribute('srcset'));

  const isPlaceholder = !src || /^data:/i.test(src) || /(^|\/)(blank|spacer|placeholder|lazy|loading)[^/]*\.(gif|png|svg)$/i.test(src);
  const chosen = isPlaceholder ? (lazy || srcset || src) : src;
  return resolveUrl(chosen, base);
}

function fileStem(src) {
  if (!src || /^data:/i.test(src)) return '';
  try {
    const name = decodeURIComponent(new URL(src).pathname.split('/').pop() || '');
    return name.replace(/\.[a-z0-9]{2,5}$/i, '').toLowerCase();
  } catch (error) {
    return '';
  }
}

function looksLikeFileName(alt, src) {
  const value = alt.toLowerCase();
  if (/\.(jpe?g|png|gif|webp|avif|svg|bmp|tiff?|heic|jfif)$/i.test(value)) return true;
  if (/^(img|image|dsc|dscn|dscf|dcim|pxl|photo|screenshot|screen shot|untitled|wp-image|whatsapp image)[\s_-]*\d/i.test(value)) return true;
  if (!/\s/.test(value) && /\d{4,}/.test(value) && /^[\w.-]+$/.test(value)) return true;
  const stem = fileStem(src);
  if (stem && !/\s/.test(value) && /[-_]/.test(value) && value === stem) return true;
  return false;
}

function isGeneric(alt) {
  const value = alt.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!value) return true;
  if (GENERIC_ALTS.has(value)) return true;
  return /^(image|photo|picture|img|pic|slide|graphic|icon)\s*\d+$/.test(value);
}

function hasRedundantPrefix(alt) {
  return /^(an?\s+)?(image|picture|photo|photograph|graphic|pic)\s+of\b/i.test(alt);
}

function closest(element, tagName) {
  let node = element.parentNode;
  while (node) {
    if (node.tagName && node.tagName.toLowerCase() === tagName) return node;
    node = node.parentNode;
  }
  return null;
}

function hasAncestor(element, tagNames) {
  let node = element.parentNode;
  while (node) {
    if (node.tagName && tagNames.includes(node.tagName.toLowerCase())) return true;
    node = node.parentNode;
  }
  return false;
}

/**
 * True when a link has no name apart from this image's alt text.
 */
function linkDependsOnImage(anchor, image) {
  if (!anchor) return false;
  if (collapse(anchor.getAttribute('aria-label')) || collapse(anchor.getAttribute('title'))) return false;
  if (collapse(anchor.textContent)) return false;
  const otherNamedImages = anchor.querySelectorAll('img').filter(
    (other) => other !== image && collapse(other.getAttribute('alt'))
  );
  return otherNamedImages.length === 0;
}

function isTrackingPixel(element, src) {
  const width = collapse(element.getAttribute('width'));
  const height = collapse(element.getAttribute('height'));
  if ((width === '1' || width === '0') && (height === '1' || height === '0')) return true;
  if (!src || /^data:/i.test(src)) return false;
  try {
    const host = new URL(src).hostname;
    return TRACKING_HOSTS.some((pattern) => pattern.test(host));
  } catch (error) {
    return false;
  }
}

function detectWordPress(root) {
  const generator = root.querySelectorAll('meta[name="generator"]')
    .some((meta) => /^wordpress/i.test(collapse(meta.getAttribute('content'))));
  if (generator) return true;

  if (root.querySelectorAll('link[rel="https://api.w.org/"]').length) return true;

  const assets = root.querySelectorAll('link[href], script[src], img[src]');
  return assets.some((node) => /\/wp-(content|includes)\//i.test(node.getAttribute('href') || node.getAttribute('src') || ''));
}

function classify(element, tag, src, inLinkOnly) {
  const hasAlt = element.hasAttribute('alt');
  const rawAlt = hasAlt ? String(element.getAttribute('alt')) : null;
  const alt = rawAlt == null ? null : collapse(rawAlt);
  const role = collapse(element.getAttribute('role')).toLowerCase();
  const ariaHidden = collapse(element.getAttribute('aria-hidden')).toLowerCase() === 'true';
  const ariaLabel = collapse(element.getAttribute('aria-label')) || collapse(element.getAttribute('title'));
  const markedDecorative = role === 'presentation' || role === 'none' || ariaHidden;

  if (!hasAlt) {
    if (tag === 'img' && markedDecorative && !inLinkOnly) {
      return ['empty', 'No alt attribute, but the image is marked decorative. Add alt="" so every tool reads it the same way.'];
    }
    if (ariaLabel) {
      return ['missing', 'No alt attribute. It has an aria-label or title, which some screen readers use, but search engines and other tools look for alt.'];
    }
    if (tag === 'input') return ['missing', 'This image button has no alt text, so the button has no name.'];
    if (tag === 'area') return ['missing', 'This image map link has no alt text, so the link has no name.'];
    if (inLinkOnly) return ['missing', 'No alt attribute, and the image is the only content of a link, so the link has no name.'];
    return ['missing', 'No alt attribute. Screen readers may read the file name instead, and search engines get no description.'];
  }

  if (!alt) {
    if (tag === 'input') return ['missing', 'This image button has empty alt text, so the button has no name.'];
    if (tag === 'area') return ['missing', 'This image map link has empty alt text, so the link has no name.'];
    if (inLinkOnly) return ['missing', 'Empty alt text, and the image is the only content of a link, so the link has no name.'];
    return ['empty', 'Empty alt (alt=""). That is right for purely decorative images. If this image carries meaning, describe it.'];
  }

  if (looksLikeFileName(alt, src)) return ['filename', 'The alt text looks like a file name. Describe what the image shows instead.'];
  if (isGeneric(alt)) return ['generic', 'The alt text is a generic word. Say what is actually in the image.'];
  if (hasRedundantPrefix(alt)) return ['redundant_prefix', 'Screen readers already announce "image", so "image of" or "photo of" can usually be dropped.'];
  if (alt.length > TOO_LONG_CHARS) return ['too_long', `The alt text is ${alt.length} characters. Aim for a sentence or two; put longer details in the page text or a caption.`];
  return ['ok', 'Has descriptive alt text. Only a person can confirm it matches the image.'];
}

/**
 * Analyse a page's HTML.
 * @param {string} html
 * @param {string} pageUrl - final URL of the page, used to resolve relative image URLs
 */
function analyzeHtml(html, pageUrl) {
  const root = parse(String(html || ''), {
    comment: false,
    blockTextElements: { script: false, style: false, noscript: true, pre: true },
  });

  let base = pageUrl;
  const baseHref = root.querySelector('base[href]');
  if (baseHref) {
    try {
      base = new URL(baseHref.getAttribute('href'), pageUrl).href;
    } catch (error) {
      base = pageUrl;
    }
  }

  const candidates = root.querySelectorAll('img, input, area').filter((element) => {
    const tag = element.tagName.toLowerCase();
    if (hasAncestor(element, ['noscript', 'template'])) return false;
    if (tag === 'input') return collapse(element.getAttribute('type')).toLowerCase() === 'image';
    if (tag === 'area') return element.hasAttribute('href');
    return true;
  });

  const images = [];
  const ignored = [];

  candidates.forEach((element) => {
    const tag = element.tagName.toLowerCase();
    const src = tag === 'area' ? null : pickSource(element, base);

    if (tag === 'img' && isTrackingPixel(element, src)) {
      ignored.push({ src, reason: 'Tracking pixel' });
      return;
    }

    const anchor = tag === 'img' ? closest(element, 'a') : null;
    const inLinkOnly = tag === 'img' && linkDependsOnImage(anchor, element);
    const [status, reason] = classify(element, tag, src, inLinkOnly);
    const altAttr = element.hasAttribute('alt') ? collapse(element.getAttribute('alt')) : null;

    images.push({
      index: images.length + 1,
      tag,
      src,
      alt: altAttr == null ? null : altAttr.slice(0, MAX_ALT_RETURNED),
      width: collapse(element.getAttribute('width')) || null,
      height: collapse(element.getAttribute('height')) || null,
      inLink: Boolean(anchor),
      status,
      severity: STATUS[status].severity,
      reason,
    });
  });

  // Same non-empty alt on several different images usually means a template
  // default or copy-paste, not a description of each image.
  const groups = new Map();
  images.forEach((image) => {
    if (!image.alt) return;
    const key = image.alt.toLowerCase();
    if (!groups.has(key)) groups.set(key, new Set());
    groups.get(key).add(image.src || `#${image.index}`);
  });
  images.forEach((image) => {
    if (image.status !== 'ok' || !image.alt) return;
    const sources = groups.get(image.alt.toLowerCase());
    if (sources && sources.size >= DUPLICATE_MIN_IMAGES) {
      image.status = 'duplicate';
      image.severity = STATUS.duplicate.severity;
      image.reason = `The same alt text is used on ${sources.size} different images. Each image usually needs its own description.`;
    }
  });

  const totals = {
    images: images.length,
    missing: images.filter((image) => image.status === 'missing').length,
    empty: images.filter((image) => image.status === 'empty').length,
    needsReview: images.filter((image) => !['missing', 'empty', 'ok'].includes(image.status)).length,
    ok: images.filter((image) => image.status === 'ok').length,
    ignored: ignored.length,
  };

  return {
    isWordPress: detectWordPress(root),
    totals,
    images: images.slice(0, MAX_IMAGES_RETURNED),
    truncated: images.length > MAX_IMAGES_RETURNED,
    ignored: ignored.slice(0, 50),
  };
}

module.exports = {
  MAX_IMAGES_RETURNED,
  STATUS,
  TOO_LONG_CHARS,
  analyzeHtml,
  isGeneric,
  looksLikeFileName,
  hasRedundantPrefix,
  pickSource,
};
