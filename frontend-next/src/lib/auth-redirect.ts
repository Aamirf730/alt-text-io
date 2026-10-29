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

export const EXISTING_ACCOUNT_MESSAGE =
  "An account with this email already exists. Sign in instead, or reset your password if you have forgotten it. If you signed up with Google, use the Google button.";

type SignUpUser = { identities?: unknown[] | null } | null | undefined;

/**
 * Supabase does not return an error when someone signs up with an email that
 * is already registered (so accounts can't be enumerated). It returns a user
 * with no identities and sends no email, so the sign-up form must say so
 * instead of "check your email".
 */
export function isExistingAccountSignUp(user: SignUpUser, hasSession: boolean): boolean {
  if (!user || hasSession) return false;
  return Array.isArray(user.identities) && user.identities.length === 0;
}

type CreatedUser = { created_at?: string | null; last_sign_in_at?: string | null } | null | undefined;

/**
 * True when this sign-in created the account (Google sign-in returns no
 * separate "sign-up" result). Supabase stamps last_sign_in_at seconds after
 * created_at for a brand-new account.
 */
export function isNewlyCreatedUser(user: CreatedUser, windowMs = 60_000): boolean {
  if (!user?.created_at || !user.last_sign_in_at) return false;
  const created = Date.parse(user.created_at);
  const signedIn = Date.parse(user.last_sign_in_at);
  if (!Number.isFinite(created) || !Number.isFinite(signedIn)) return false;
  return Math.abs(signedIn - created) <= windowMs;
}

type IdentityUser = {
  identities?: Array<{ provider?: string | null }> | null;
  app_metadata?: { provider?: string; providers?: string[] } | null;
} | null | undefined;

/** True when the account can sign in with an email and password. */
export function hasPasswordIdentity(user: IdentityUser): boolean {
  if (!user) return false;
  const providers = new Set<string>();
  for (const identity of user.identities || []) {
    if (identity?.provider) providers.add(identity.provider);
  }
  for (const provider of user.app_metadata?.providers || []) {
    providers.add(provider);
  }
  if (user.app_metadata?.provider) providers.add(user.app_metadata.provider);
  // Unknown identity data: assume email so the option is not hidden wrongly.
  if (providers.size === 0) return true;
  return providers.has("email");
}
