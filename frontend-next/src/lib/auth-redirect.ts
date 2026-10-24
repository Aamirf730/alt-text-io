const TRUSTED_AUTH_ORIGINS = new Set([
  "https://www.alt-text.pro",
  "https://alt-text.pro",
]);

function isLocalDevelopmentOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

export function getSafeAuthRedirect(
  candidate: string | null | undefined,
  fallbackPath = "/email-confirmed",
  currentOrigin?: string,
) {
  const baseOrigin = currentOrigin || "https://www.alt-text.pro";
  const fallback = new URL(fallbackPath, baseOrigin);

  if (!candidate) {
    return `${fallback.pathname}${fallback.search}${fallback.hash}`;
  }

  try {
    const parsed = new URL(candidate, baseOrigin);
    const originAllowed =
      parsed.origin === baseOrigin ||
      TRUSTED_AUTH_ORIGINS.has(parsed.origin) ||
      (isLocalDevelopmentOrigin(baseOrigin) && parsed.origin === baseOrigin);

    if (!originAllowed || parsed.username || parsed.password) {
      return `${fallback.pathname}${fallback.search}${fallback.hash}`;
    }

    // A path such as "/.//evil.com" normalizes to "//evil.com", which a
    // browser treats as a protocol-relative URL on another host.
    if (!parsed.pathname.startsWith("/") || parsed.pathname.startsWith("//")) {
      return `${fallback.pathname}${fallback.search}${fallback.hash}`;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return `${fallback.pathname}${fallback.search}${fallback.hash}`;
  }
}
