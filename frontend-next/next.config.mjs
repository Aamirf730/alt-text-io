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
      {
        // The WordPress plugin opens /connect as a popup from the customer's
        // own site. With same-origin-allow-popups, a page opened by another
        // origin is put in a new browsing context group, which severs
        // window.opener, so the API key could never be posted back to
        // wp-admin. The later rule overrides the header for this route only.
        source: '/connect',
        headers: [{ key: 'Cross-Origin-Opener-Policy', value: 'unsafe-none' }],
      },
    ];
  },

  // Addresses people type out of habit. The homepage opens the sign-in or
  // sign-up dialog for ?auth=…, and holds the pricing section.
  async redirects() {
    return [
      { source: '/pricing', destination: '/#pricing', permanent: false },
      { source: '/login', destination: '/?auth=signin', permanent: false },
      { source: '/signin', destination: '/?auth=signin', permanent: false },
      { source: '/signup', destination: '/?auth=signup', permanent: false },
      { source: '/register', destination: '/?auth=signup', permanent: false },
    ];
  },
};

export default nextConfig;
