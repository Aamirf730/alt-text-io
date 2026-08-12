/** @type {import('next').NextConfig} */

import { fileURLToPath } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// Content Security Policy
// ─────────────────────────────────────────────────────────────────────────────
// Allows only trusted domains. Update when adding new third-party services.

const isDev = process.env.NODE_ENV === 'development';

const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval' http://localhost:*" : ''};
  style-src 'self' 'unsafe-inline' ${isDev ? 'http://localhost:*' : ''};
  font-src 'self' data: ${isDev ? 'http://localhost:*' : ''};
  img-src 'self' https://www.alt-text.pro https://alt-text.pro https://*.supabase.co data: blob: ${isDev ? 'http://localhost:*' : ''};
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.polar.sh https://*.netlify.app https://www.alt-text.pro ${isDev ? 'http://localhost:* ws://localhost:*' : ''};
  frame-src 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  ${isDev ? '' : 'upgrade-insecure-requests;'}
`;

// ─────────────────────────────────────────────────────────────────────────────
// Security Headers
// ─────────────────────────────────────────────────────────────────────────────

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: ContentSecurityPolicy.replace(/\s{2,}/g, ' ').trim(),
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Next.js Config
// ─────────────────────────────────────────────────────────────────────────────

const nextConfig = {
  outputFileTracingRoot: fileURLToPath(new URL('.', import.meta.url)),

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.alt-text.pro',
      },
      {
        protocol: 'https',
        hostname: 'alt-text.pro',
      },
    ],
  },

  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
