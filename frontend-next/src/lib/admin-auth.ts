import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminUser = {
    id: string;
    email: string;
};

export type AdminAuthResult =
    | { ok: true; admin: AdminUser }
    | { ok: false; status: 401 | 403; error: string };

/** Lower-cased emails from the comma-separated SUPERUSER_EMAILS variable. */
export function getSuperuserEmails(raw: string | undefined = process.env.SUPERUSER_EMAILS): Set<string> {
    return new Set(
        String(raw || "")
            .split(",")
            .map((email) => email.trim().toLowerCase())
            .filter(Boolean),
    );
}

export function getBearerToken(request: Request): string | null {
    const header = request.headers.get("authorization") || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1]?.trim();
    return token || null;
}

/**
 * Admin = a Supabase user whose email is listed in SUPERUSER_EMAILS and has
 * been confirmed. The token is verified with the service-role client's
 * `auth.getUser(token)`, which checks it against Supabase Auth rather than
 * trusting the JWT payload. Requiring `email_confirmed_at` stops anyone
 * from becoming admin by registering a listed address they do not control.
 */
export async function requireAdmin(
    request: Request,
    supabase: SupabaseClient,
): Promise<AdminAuthResult> {
    const token = getBearerToken(request);
    if (!token) {
        return { ok: false, status: 401, error: "Authentication required" };
    }

    const { data, error } = await supabase.auth.getUser(token);
    const user = data?.user;
    if (error || !user) {
        return { ok: false, status: 401, error: "Invalid or expired session" };
    }

    const email = String(user.email || "").trim().toLowerCase();
    const superusers = getSuperuserEmails();
    if (!email || !superusers.has(email) || !user.email_confirmed_at) {
        return { ok: false, status: 403, error: "Access denied. Superuser privileges required." };
    }

    return { ok: true, admin: { id: user.id, email } };
}
