import { NextRequest, NextResponse } from "next/server";

function buildContentSecurityPolicy(nonce: string): string {
  const isDevelopment = process.env.NODE_ENV === "development";
  const developmentSources = isDevelopment
    ? " http://localhost:* ws://localhost:*"
    : "";
  const developmentScriptSources = isDevelopment ? " 'unsafe-eval'" : "";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://accounts.google.com/gsi/client${developmentScriptSources}`,
    // Styles cannot be nonce-only: sonner injects its stylesheet at runtime
    // and next/image writes inline style attributes. A nonce here would make
    // browsers ignore 'unsafe-inline', so styles allow inline while scripts
    // stay nonce-only.
    "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
    `font-src 'self' data:${developmentSources}`,
    `img-src 'self' https://www.alt-text.pro https://alt-text.pro https://*.supabase.co data: blob:${developmentSources}`,
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://accounts.google.com/gsi/ https://api.polar.sh https://*.netlify.app https://www.alt-text.pro${developmentSources}`,
    "frame-src https://accounts.google.com/gsi/",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
