import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import http from 'node:http';
import zlib from 'node:zlib';
import dns from 'node:dns';

const {
  SafeFetchError,
  createSafeLookup,
  fetchPage,
  isBlockedAddress,
  normalizeUserUrl,
  requestOnce,
} = require('../netlify-functions/utils/safe-fetch.js');
const { analyzeHtml } = require('../netlify-functions/utils/alt-checker.js');
const { _private } = require('../netlify-functions/check-alt-text.js');

function codeOf(fn) {
  try {
    fn();
  } catch (error) {
    return error.code;
  }
  return 'accepted';
}

function lookupResult(lookup, hostname, options = {}) {
  return new Promise((resolve) => {
    lookup(hostname, options, (error, address, family) => resolve({ error, address, family }));
  });
}

describe('safe-fetch URL rules', () => {
  it.each([
    ['http://127.0.0.1/', 'blocked_address'],
    ['http://localhost/', 'blocked_address'],
    ['http://169.254.169.254/latest/meta-data/', 'blocked_address'],
    ['http://10.0.0.5/', 'blocked_address'],
    ['http://192.168.1.1/', 'blocked_address'],
    ['http://172.20.0.1/', 'blocked_address'],
    ['http://100.64.0.1/', 'blocked_address'],
    ['http://0.0.0.0/', 'blocked_address'],
    ['http://[::1]/', 'blocked_address'],
    ['http://[::ffff:127.0.0.1]/', 'blocked_address'],
    ['http://[::ffff:7f00:1]/', 'blocked_address'],
    ['http://[fd00::1]/', 'blocked_address'],
    ['http://[fe80::1]/', 'blocked_address'],
    ['http://[64:ff9b::a00:1]/', 'blocked_address'],
    ['http://2130706433/', 'blocked_address'],
    ['http://0x7f.0.0.1/', 'blocked_address'],
    ['http://printer.local/', 'blocked_address'],
    ['http://metadata.google.internal/', 'blocked_address'],
    ['http://intranet/', 'blocked_address'],
    ['https://example.com:8080/', 'blocked_address'],
    ['example.com:8443', 'blocked_address'],
    ['ftp://example.com/file', 'invalid_url'],
    ['file:///etc/passwd', 'invalid_url'],
    ['javascript:alert(1)', 'invalid_url'],
    ['http://user:pass@example.com/', 'invalid_url'],
    ['', 'invalid_url'],
  ])('rejects %s', (input, code) => {
    expect(codeOf(() => normalizeUserUrl(input))).toBe(code);
  });

  it('accepts public pages and adds https:// when the scheme is missing', () => {
    expect(normalizeUserUrl('example.com/blog/post#top').href).toBe('https://example.com/blog/post');
    expect(normalizeUserUrl('  https://www.example.org/a?b=1 ').href).toBe('https://www.example.org/a?b=1');
    expect(normalizeUserUrl('http://93.184.216.34/').href).toBe('http://93.184.216.34/');
  });

  it('classifies addresses', () => {
    expect(isBlockedAddress('8.8.8.8')).toBe(false);
    expect(isBlockedAddress('2606:4700:4700::1111')).toBe(false);
    expect(isBlockedAddress('::ffff:8.8.8.8')).toBe(false);
    expect(isBlockedAddress('::ffff:10.1.2.3')).toBe(true);
    expect(isBlockedAddress('::')).toBe(true);
    expect(isBlockedAddress('2001:db8::1')).toBe(true);
    expect(isBlockedAddress('ff02::1')).toBe(true);
    expect(isBlockedAddress('224.0.0.1')).toBe(true);
    expect(isBlockedAddress('not-an-ip')).toBe(true);
  });
});

describe('safe-fetch DNS check at connect time', () => {
  it('refuses a host if any resolved address is private', async () => {
    const lookup = createSafeLookup(async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.7', family: 4 },
    ]);
    const result = await lookupResult(lookup, 'rebind.example');
    expect(result.error).toBeInstanceOf(SafeFetchError);
    expect(result.error.code).toBe('blocked_address');
  });

  it('refuses IPv4-mapped loopback returned by DNS', async () => {
    const lookup = createSafeLookup(async () => [{ address: '::ffff:127.0.0.1', family: 6 }]);
    expect((await lookupResult(lookup, 'sneaky.example')).error.code).toBe('blocked_address');
  });

  it('passes public addresses through in both callback shapes', async () => {
    const lookup = createSafeLookup(async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1::1', family: 6 },
    ]);
    const single = await lookupResult(lookup, 'example.com', { family: 4 });
    expect(single.error).toBeNull();
    expect(single.address).toBe('93.184.216.34');
    expect(single.family).toBe(4);

    const all = await lookupResult(lookup, 'example.com', { all: true });
    expect(all.error).toBeNull();
    expect(all.address).toHaveLength(2);
  });

  it('reports unknown hosts as dns_failed', async () => {
    const lookup = createSafeLookup(async () => {
      const error = new Error('not found');
      error.code = 'ENOTFOUND';
      throw error;
    });
    expect((await lookupResult(lookup, 'nope.example')).error.code).toBe('dns_failed');
  });
});

describe('safe-fetch redirects', () => {
  it('re-checks every redirect and refuses one that points to a private address', async () => {
    const requestFn = vi.fn(async () => ({ status: 302, headers: { location: 'http://127.0.0.1/admin' } }));
    await expect(fetchPage('https://example.com/', { requestFn })).rejects.toMatchObject({ code: 'blocked_address' });
    expect(requestFn).toHaveBeenCalledTimes(1);
  });

  it('follows relative redirects and stops after the limit', async () => {
    const seen = [];
    const requestFn = vi.fn(async (url) => {
      seen.push(url.href);
      return { status: 301, headers: { location: `/hop${seen.length}` } };
    });
    await expect(fetchPage('https://example.com/', { requestFn, maxRedirects: 3 })).rejects.toMatchObject({ code: 'too_many_redirects' });
    expect(seen).toEqual([
      'https://example.com/',
      'https://example.com/hop1',
      'https://example.com/hop2',
      'https://example.com/hop3',
    ]);
  });

  it('returns the final URL after a redirect', async () => {
    const requestFn = vi.fn()
      .mockResolvedValueOnce({ status: 301, headers: { location: 'https://www.example.com/post' } })
      .mockResolvedValueOnce({ status: 200, headers: {}, body: '<img src="a.jpg">', truncated: false });
    const page = await fetchPage('example.com/post', { requestFn });
    expect(page.finalUrl).toBe('https://www.example.com/post');
    expect(page.html).toContain('a.jpg');
  });

  it('turns upstream errors into page_status', async () => {
    const requestFn = vi.fn(async () => ({ status: 404, headers: {} }));
    await expect(fetchPage('https://example.com/missing', { requestFn })).rejects.toMatchObject({ code: 'page_status', upstreamStatus: 404 });
  });
});

describe('safe-fetch reading responses (local server, loopback allowed only in this test)', () => {
  let server;
  let base;
  const big = `<html><body>${'<p>filler text</p>'.repeat(20000)}</body></html>`;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/gzip') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Encoding': 'gzip' });
        res.end(zlib.gzipSync('<img src="/a.jpg" alt="Café terrace">'));
      } else if (req.url === '/pdf') {
        res.writeHead(200, { 'Content-Type': 'application/pdf' });
        res.end('%PDF-1.7');
      } else if (req.url === '/big') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(big);
      } else if (req.url === '/latin1') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=iso-8859-1' });
        res.end(Buffer.from('<img alt="Caf\xe9" src="x.png">', 'latin1'));
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  const opts = (extra = {}) => ({ lookup: dns.lookup, signal: new AbortController().signal, maxBytes: 1024 * 1024, ...extra });

  it('decompresses gzip and decodes UTF-8', async () => {
    const res = await requestOnce(new URL(`${base}/gzip`), opts());
    expect(res.status).toBe(200);
    expect(res.body).toContain('Café terrace');
  });

  it('decodes the declared charset', async () => {
    const res = await requestOnce(new URL(`${base}/latin1`), opts());
    expect(res.body).toContain('Café');
  });

  it('refuses non-HTML responses', async () => {
    await expect(requestOnce(new URL(`${base}/pdf`), opts())).rejects.toMatchObject({ code: 'not_html' });
  });

  it('stops reading at the size cap and marks the page truncated', async () => {
    const res = await requestOnce(new URL(`${base}/big`), opts({ maxBytes: 10000 }));
    expect(res.truncated).toBe(true);
    expect(res.body.length).toBeLessThanOrEqual(10000);
  });

  it('refuses loopback through the real safe lookup', async () => {
    const lookup = createSafeLookup();
    await expect(
      requestOnce(new URL(`http://localhost.:${server.address().port}/gzip`), opts({ lookup }))
    ).rejects.toMatchObject({ code: 'blocked_address' });
  });
});

const FIXTURE = `<!doctype html>
<html><head>
<meta name="generator" content="WordPress 6.8">
<base href="https://cdn.example.com/site/">
</head><body>
<img src="photos/missing.jpg">
<img src="photos/decorative.png" alt="">
<img src="photos/IMG_4021.JPG" alt="IMG_4021.JPG">
<img src="photos/red-fox.jpg" alt="red-fox">
<img src="photos/generic.jpg" alt="Image">
<img src="photos/prefix.jpg" alt="Image of a red fox in the snow">
<img src="photos/long.jpg" alt="${'A very detailed description '.repeat(8)}">
<img src="data:image/gif;base64,R0lGOD" data-src="photos/lazy.jpg" alt="A ceramic mug on a wooden desk">
<img srcset="photos/set-400.jpg 400w, photos/set-800.jpg 800w" alt="Two hikers on a ridge at sunset">
<img src="https://www.facebook.com/tr?id=1&ev=PageView" width="1" height="1">
<img src="photos/presentation.png" role="presentation">
<a href="/cart"><img src="icons/cart.svg" alt=""></a>
<a href="/home">Home <img src="icons/home.svg" alt=""></a>
<input type="image" src="buttons/go.png">
<map name="m"><area href="/north" shape="rect" coords="0,0,1,1"></map>
<img src="p/1.jpg" alt="Product photo"><img src="p/2.jpg" alt="Product photo"><img src="p/3.jpg" alt="Product photo">
<noscript><img src="photos/noscript.jpg"></noscript>
<!-- <img src="photos/commented.jpg"> -->
<script>document.write('<img src="photos/script.jpg">')</script>
</body></html>`;

describe('alt text analysis', () => {
  const result = analyzeHtml(FIXTURE, 'https://example.com/blog/post');
  const bySrc = (fragment) => result.images.find((image) => (image.src || '').includes(fragment));

  it('detects WordPress', () => {
    expect(result.isWordPress).toBe(true);
    expect(analyzeHtml('<img src="a.jpg" alt="A dog">', 'https://example.com/').isWordPress).toBe(false);
    expect(analyzeHtml('<link rel="stylesheet" href="/wp-content/themes/x/style.css">', 'https://example.com/').isWordPress).toBe(true);
  });

  it('classifies each image', () => {
    expect(bySrc('missing.jpg').status).toBe('missing');
    expect(bySrc('decorative.png').status).toBe('empty');
    expect(bySrc('IMG_4021').status).toBe('filename');
    expect(bySrc('red-fox.jpg').status).toBe('filename');
    expect(bySrc('generic.jpg').status).toBe('generic');
    expect(bySrc('prefix.jpg').status).toBe('redundant_prefix');
    expect(bySrc('long.jpg').status).toBe('too_long');
    expect(bySrc('lazy.jpg').status).toBe('ok');
    expect(bySrc('set-400.jpg').status).toBe('ok');
    expect(bySrc('presentation.png').status).toBe('empty');
    expect(bySrc('cart.svg').status).toBe('missing');
    expect(bySrc('home.svg').status).toBe('empty');
    expect(bySrc('go.png')).toMatchObject({ tag: 'input', status: 'missing' });
    expect(result.images.find((image) => image.tag === 'area').status).toBe('missing');
    expect(result.images.filter((image) => image.status === 'duplicate')).toHaveLength(3);
  });

  it('resolves URLs against <base href> and prefers lazy-load sources', () => {
    expect(bySrc('missing.jpg').src).toBe('https://cdn.example.com/site/photos/missing.jpg');
    expect(bySrc('lazy.jpg').src).toBe('https://cdn.example.com/site/photos/lazy.jpg');
  });

  it('ignores tracking pixels, noscript copies, comments and scripts', () => {
    expect(result.totals.ignored).toBe(1);
    expect(result.images.some((image) => /noscript|commented|script\.jpg|facebook/.test(image.src || ''))).toBe(false);
  });

  it('adds up the totals', () => {
    const { totals } = result;
    expect(totals.images).toBe(result.images.length);
    expect(totals.missing + totals.empty + totals.needsReview + totals.ok).toBe(totals.images);
    expect(totals.missing).toBe(4);
  });

  it('caps the list at 300 images', () => {
    const many = Array.from({ length: 320 }, (_, i) => `<img src="${i}.jpg" alt="Photo number ${i} of the event">`).join('');
    const capped = analyzeHtml(many, 'https://example.com/');
    expect(capped.images).toHaveLength(300);
    expect(capped.truncated).toBe(true);
    expect(capped.totals.images).toBe(320);
  });
});

describe('check-alt-text handler', () => {
  const event = (body, extra = {}) => ({
    httpMethod: 'POST',
    headers: { 'x-forwarded-for': '198.51.100.20', origin: 'https://www.alt-text.pro' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...extra,
  });
  const allow = vi.fn(async () => ({ allowed: true }));
  const quiet = () => {};

  it('rejects other methods', async () => {
    const handler = _private.createHandler({ checkRateLimitFn: allow, logFn: quiet });
    expect((await handler({ httpMethod: 'GET', headers: {} })).statusCode).toBe(405);
  });

  it('rejects bad JSON and bad URLs before spending a rate-limit slot', async () => {
    const limiter = vi.fn(async () => ({ allowed: true }));
    const handler = _private.createHandler({ checkRateLimitFn: limiter, logFn: quiet });
    expect((await handler(event('{nope'))).statusCode).toBe(400);
    const blocked = await handler(event({ url: 'http://169.254.169.254/' }));
    expect(blocked.statusCode).toBe(400);
    expect(JSON.parse(blocked.body).code).toBe('blocked_address');
    expect(limiter).not.toHaveBeenCalled();
  });

  it('applies the per-IP limit', async () => {
    const limiter = vi.fn(async () => ({ allowed: false, limit: 10, count: 10, remaining: 0, resetAt: new Date(Date.now() + 60000) }));
    const fetchPageFn = vi.fn();
    const handler = _private.createHandler({ checkRateLimitFn: limiter, fetchPageFn, logFn: quiet });
    const response = await handler(event({ url: 'https://example.com/' }));
    expect(response.statusCode).toBe(429);
    expect(limiter).toHaveBeenCalledWith('check-alt-text:198.51.100.20', _private.RATE_LIMIT, _private.RATE_WINDOW_MS);
    expect(fetchPageFn).not.toHaveBeenCalled();
  });

  it('maps fetch errors to clear responses', async () => {
    const fetchPageFn = vi.fn(async () => { throw new SafeFetchError('not_html', 'Not a page'); });
    const handler = _private.createHandler({ checkRateLimitFn: allow, fetchPageFn, logFn: quiet });
    const response = await handler(event({ url: 'https://example.com/file.pdf' }));
    expect(response.statusCode).toBe(422);
    expect(JSON.parse(response.body)).toMatchObject({ code: 'not_html' });
  });

  it('returns the analysis and never logs the URL', async () => {
    const logs = [];
    const fetchPageFn = vi.fn(async () => ({ finalUrl: 'https://example.com/post', html: FIXTURE, truncated: false }));
    const handler = _private.createHandler({ checkRateLimitFn: allow, fetchPageFn, logFn: (line) => logs.push(line) });
    const response = await handler(event({ url: 'example.com/post' }));
    expect(response.statusCode).toBe(200);
    expect(response.headers['Cache-Control']).toBe('no-store');
    const data = JSON.parse(response.body);
    expect(data).toMatchObject({ checkedUrl: 'https://example.com/post', finalUrl: 'https://example.com/post', isWordPress: true });
    expect(data.totals.images).toBeGreaterThan(0);
    expect(logs.join(' ')).not.toContain('example.com');
  });
});
