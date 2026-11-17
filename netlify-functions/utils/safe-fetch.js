/**
 * Safe page fetcher for user-supplied URLs.
 * File: netlify-functions/utils/safe-fetch.js
 *
 * The public alt text checker fetches a page the visitor names, so every
 * request is treated as a server-side request forgery risk:
 *
 * - only http/https on default ports, no credentials in the URL;
 * - local, private, link-local, metadata and other reserved addresses are
 *   refused, for IPv4 and IPv6 (including IPv4-mapped and NAT64 forms);
 * - the address check runs inside the socket's DNS lookup, so the address
 *   that was checked is the address that is connected to (no DNS rebinding
 *   gap between a pre-check and the connection);
 * - redirects are followed by hand and every hop is checked again;
 * - total time, redirects and decompressed body size are capped.
 */

const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const dns = require('node:dns');
const zlib = require('node:zlib');

const USER_AGENT = 'AltTextProChecker/1.0 (+https://www.alt-text.pro/alt-text-checker)';
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_BYTES = 3 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;
const MAX_URL_LENGTH = 2048;

class SafeFetchError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'SafeFetchError';
    this.code = code;
    Object.assign(this, details);
  }
}

const BLOCKED_IPV4 = new net.BlockList();
[
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, cloud metadata
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.88.99.0', 24], // 6to4 relay
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, broadcast
].forEach(([address, prefix]) => BLOCKED_IPV4.addSubnet(address, prefix, 'ipv4'));

/**
 * Expand an IPv6 address to eight 16-bit numbers. Handles "::" and an
 * embedded dotted IPv4 tail. Returns null for anything that is not IPv6.
 */
function expandIpv6(address) {
  let value = String(address || '').toLowerCase();
  const zoneIndex = value.indexOf('%');
  if (zoneIndex !== -1) value = value.slice(0, zoneIndex);
  if (net.isIPv6(value) === false) return null;

  const tail = value.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (tail) {
    const octets = tail[1].split('.').map(Number);
    const hex = [
      ((octets[0] << 8) | octets[1]).toString(16),
      ((octets[2] << 8) | octets[3]).toString(16),
    ];
    value = value.slice(0, -tail[1].length) + hex.join(':');
  }

  const halves = value.split('::');
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length > 1 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - rest.length;
  const groups = halves.length > 1
    ? [...head, ...Array(Math.max(0, missing)).fill('0'), ...rest]
    : head;

  if (groups.length !== 8) return null;
  return groups.map((group) => parseInt(group || '0', 16));
}

function ipv4FromGroups(high, low) {
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
}

/**
 * True when the address is not a normal public unicast address.
 */
function isBlockedAddress(address) {
  const value = String(address || '').trim().replace(/^\[|\]$/g, '');
  const family = net.isIP(value.split('%')[0]);

  if (family === 4) {
    return BLOCKED_IPV4.check(value, 'ipv4');
  }

  if (family !== 6) {
    return true;
  }

  const groups = expandIpv6(value);
  if (!groups) return true;

  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;
  const firstFiveZero = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0;

  // ::ffff:a.b.c.d (IPv4-mapped) and ::a.b.c.d (deprecated IPv4-compatible)
  if (firstFiveZero && (g5 === 0xffff || g5 === 0)) {
    if (g5 === 0 && g6 === 0 && (g7 === 0 || g7 === 1)) return true; // :: and ::1
    return isBlockedAddress(ipv4FromGroups(g6, g7));
  }

  // 64:ff9b::/96 NAT64: judge by the embedded IPv4 address
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
    return isBlockedAddress(ipv4FromGroups(g6, g7));
  }

  if ((g0 & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g0 & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g0 & 0xffc0) === 0xfec0) return true; // fec0::/10 old site-local
  if ((g0 & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (g0 === 0x2001 && g1 === 0x0db8) return true; // documentation
  if (g0 === 0x2002) return true; // 6to4 can wrap private IPv4
  if (g0 === 0x0100 && g1 === 0 && g2 === 0 && g3 === 0) return true; // discard-only
  if (g0 === 0x2001 && g1 === 0) return true; // Teredo
  if (g0 === 0) return true; // anything else in ::/16 is not public unicast

  return false;
}

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa', '.lan', '.intranet', '.corp'];

/**
 * Turn what a visitor typed into a URL we are willing to fetch, or throw.
 */
function normalizeUserUrl(input) {
  if (typeof input !== 'string') {
    throw new SafeFetchError('invalid_url', 'Enter a page address, for example https://example.com/blog/post.');
  }

  let value = input.trim();
  if (!value || value.length > MAX_URL_LENGTH) {
    throw new SafeFetchError('invalid_url', 'Enter a page address, for example https://example.com/blog/post.');
  }

  if (!/^[a-z][a-z0-9+.-]*:/i.test(value) || /^[^/:]+:\d+(\/|$)/.test(value)) {
    value = `https://${value.replace(/^\/+/, '')}`;
  }

  let url;
  try {
    url = new URL(value);
  } catch (error) {
    throw new SafeFetchError('invalid_url', 'That does not look like a web address. Check it and try again.');
  }

  assertFetchableUrl(url);
  url.hash = '';
  return url;
}

/**
 * Checks that do not need DNS. Runs on the first URL and on every redirect.
 */
function assertFetchableUrl(url) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SafeFetchError('invalid_url', 'Only http and https pages can be checked.');
  }

  if (url.username || url.password) {
    throw new SafeFetchError('invalid_url', 'Remove the username or password from the address and try again.');
  }

  if (url.port !== '') {
    throw new SafeFetchError('blocked_address', 'Only pages on the standard web ports (80 and 443) can be checked.');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!hostname) {
    throw new SafeFetchError('invalid_url', 'That address has no website name in it.');
  }

  if (net.isIP(hostname)) {
    if (isBlockedAddress(hostname)) {
      throw new SafeFetchError('blocked_address', 'That address points to a private or local network, so it cannot be checked.');
    }
    return;
  }

  if (
    hostname === 'localhost'
    || !hostname.includes('.')
    || BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    throw new SafeFetchError('blocked_address', 'That address points to a private or local network, so it cannot be checked.');
  }
}

/**
 * A dns.lookup replacement for sockets. Resolves every address for the host
 * and refuses the connection if any of them is blocked.
 */
function createSafeLookup(resolveAll = (hostname) => dns.promises.lookup(hostname, { all: true, verbatim: true })) {
  return function safeLookup(hostname, options, callback) {
    const cb = typeof options === 'function' ? options : callback;
    const opts = typeof options === 'object' && options !== null ? options : {};

    Promise.resolve()
      .then(() => resolveAll(hostname))
      .then((records) => {
        const list = (Array.isArray(records) ? records : [records])
          .filter((record) => record && record.address);

        if (list.length === 0) {
          throw new SafeFetchError('dns_failed', 'We could not find that website. Check the address for typos.');
        }

        if (list.some((record) => isBlockedAddress(record.address))) {
          throw new SafeFetchError('blocked_address', 'That address points to a private or local network, so it cannot be checked.');
        }

        const wanted = opts.family === 4 || opts.family === 6 ? opts.family : 0;
        const usable = wanted
          ? list.filter((record) => (record.family || net.isIP(record.address)) === wanted)
          : list;
        const chosen = usable.length ? usable : list;

        if (opts.all) {
          cb(null, chosen.map((record) => ({ address: record.address, family: record.family || net.isIP(record.address) })));
        } else {
          cb(null, chosen[0].address, chosen[0].family || net.isIP(chosen[0].address));
        }
      })
      .catch((error) => {
        if (error instanceof SafeFetchError) {
          cb(error);
          return;
        }
        cb(new SafeFetchError('dns_failed', 'We could not find that website. Check the address for typos.'));
      });
  };
}

function decoderFor(contentType) {
  const charset = /charset=["']?([\w-]+)/i.exec(contentType || '');
  try {
    return new TextDecoder(charset ? charset[1] : 'utf-8', { fatal: false });
  } catch (error) {
    return new TextDecoder('utf-8', { fatal: false });
  }
}

function isHtmlContentType(contentType) {
  if (!contentType) return true; // some servers omit it; the parser copes
  return /text\/html|application\/xhtml\+xml/i.test(contentType);
}

/**
 * One request, no redirects followed. Resolves with status, headers and,
 * for 2xx HTML responses, the decoded body.
 */
function requestOnce(url, { lookup, signal, maxBytes }) {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(url, {
      method: 'GET',
      agent: false,
      lookup,
      signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en;q=0.9,*;q=0.5',
      },
    });

    req.on('error', (error) => {
      if (error instanceof SafeFetchError) {
        reject(error);
      } else if (error.name === 'AbortError' || error.code === 'ABORT_ERR') {
        reject(new SafeFetchError('timeout', 'The page took too long to respond.'));
      } else if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
        reject(new SafeFetchError('dns_failed', 'We could not find that website. Check the address for typos.'));
      } else if (/certificate|SSL|TLS/i.test(`${error.code} ${error.message}`)) {
        reject(new SafeFetchError('connection_failed', 'The website\'s security certificate could not be verified.'));
      } else {
        reject(new SafeFetchError('connection_failed', 'We could not connect to that website.'));
      }
    });

    req.on('response', (res) => {
      const status = res.statusCode || 0;
      const headers = res.headers || {};

      if (status >= 300 && status < 400) {
        res.resume();
        resolve({ status, headers, body: null, truncated: false });
        return;
      }

      if (status < 200 || status >= 300) {
        res.resume();
        resolve({ status, headers, body: null, truncated: false });
        return;
      }

      const contentType = String(headers['content-type'] || '');
      if (!isHtmlContentType(contentType)) {
        res.resume();
        reject(new SafeFetchError('not_html', 'That address is not a web page (it returned a file or data instead of HTML).'));
        return;
      }

      const encoding = String(headers['content-encoding'] || '').trim().toLowerCase();
      let stream = res;
      if (encoding === 'gzip' || encoding === 'x-gzip') stream = res.pipe(zlib.createGunzip());
      else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate());
      else if (encoding === 'br') stream = res.pipe(zlib.createBrotliDecompress());

      const chunks = [];
      let size = 0;
      let truncated = false;
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        const buffer = Buffer.concat(chunks, size);
        resolve({ status, headers, body: decoderFor(contentType).decode(buffer), truncated });
      };

      stream.on('data', (chunk) => {
        if (settled) return;
        const room = maxBytes - size;
        if (chunk.length >= room) {
          chunks.push(chunk.subarray(0, room));
          size += room;
          truncated = true;
          finish();
          req.destroy();
          return;
        }
        chunks.push(chunk);
        size += chunk.length;
      });
      stream.on('end', finish);
      stream.on('error', (error) => {
        if (settled) return;
        settled = true;
        if (error.name === 'AbortError' || error.code === 'ABORT_ERR') {
          reject(new SafeFetchError('timeout', 'The page took too long to respond.'));
        } else {
          reject(new SafeFetchError('connection_failed', 'The page could not be read.'));
        }
      });
    });

    req.end();
  });
}

/**
 * Fetch one HTML page safely, following up to maxRedirects redirects.
 */
async function fetchPage(input, {
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxBytes = DEFAULT_MAX_BYTES,
  maxRedirects = DEFAULT_MAX_REDIRECTS,
  lookup = createSafeLookup(),
  requestFn = requestOnce,
} = {}) {
  let url = input instanceof URL ? new URL(input.href) : normalizeUserUrl(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      assertFetchableUrl(url);
      const response = await requestFn(url, { lookup, signal: controller.signal, maxBytes });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers && response.headers.location;
        if (!location) {
          throw new SafeFetchError('page_status', `The page returned a redirect (${response.status}) with no destination.`, { upstreamStatus: response.status });
        }
        let next;
        try {
          next = new URL(String(location), url);
        } catch (error) {
          throw new SafeFetchError('invalid_url', 'The page redirected to an address that is not valid.');
        }
        next.hash = '';
        url = next;
        continue;
      }

      if (response.status < 200 || response.status >= 300) {
        throw new SafeFetchError('page_status', `The page returned an error (HTTP ${response.status}).`, { upstreamStatus: response.status });
      }

      return {
        finalUrl: url.href,
        status: response.status,
        html: response.body || '',
        truncated: Boolean(response.truncated),
      };
    }

    throw new SafeFetchError('too_many_redirects', `The page redirected more than ${maxRedirects} times.`);
  } catch (error) {
    if (error instanceof SafeFetchError) throw error;
    if (controller.signal.aborted) throw new SafeFetchError('timeout', 'The page took too long to respond.');
    throw new SafeFetchError('connection_failed', 'We could not connect to that website.');
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  SafeFetchError,
  USER_AGENT,
  assertFetchableUrl,
  createSafeLookup,
  expandIpv6,
  fetchPage,
  isBlockedAddress,
  normalizeUserUrl,
  requestOnce,
};
