/** @type {import('next').NextConfig} */

// ─────────────────────────────────────────────────────────────────────────────
// Content Security Policy
// ─────────────────────────────────────────────────────────────────────────────
// Allows only trusted domains. Update when adding new third-party services.

const isDev = process.env.NODE_ENV === 'development';

const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://embed.tawk.to https://*.tawk.to ${isDev ? 'http://localhost:*' : ''};
  style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com https://*.tawk.to ${isDev ? 'http://localhost:*' : ''};
  font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com data: ${isDev ? 'http://localhost:*' : ''};
  img-src 'self' https://www.alt-text.pro https://alt-text.pro https://*.supabase.co data: blob: ${isDev ? 'http://localhost:*' : ''};
  connect-src 'self' https://*.supabase.co https://*.tawk.to wss://*.tawk.to https://api.polar.sh https://*.netlify.app https://www.alt-text.pro ${isDev ? 'http://localhost:* ws://localhost:*' : ''};
  frame-src 'self' https://*.tawk.to;
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
    key: 'X-XSS-Protection',
    value: '1; mode=block',
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
