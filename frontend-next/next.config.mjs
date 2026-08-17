/** @type {import('next').NextConfig} */

import { fileURLToPath } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// Security Headers
// ─────────────────────────────────────────────────────────────────────────────

const securityHeaders = [
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
  {
    key: 'Cross-Origin-Opener-Policy',
    value: 'same-origin-allow-popups',
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
