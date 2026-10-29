import { getAccessToken } from "@/lib/supabase";
import { getApiBase } from "@/lib/utils";

/** Error carrying the HTTP status so callers can react to 403/409/422. */
export class AdminApiError extends Error {
    status: number;
    body: any;

    constructor(message: string, status: number, body: any) {
        super(message);
        this.status = status;
        this.body = body;
    }
}

async function requireToken(): Promise<string> {
    const token = await getAccessToken();
    if (!token) throw new AdminApiError("Your session expired. Please sign in again.", 401, null);
    return token;
}

async function parse(response: Response) {
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.success === false) {
        const message = body?.message || body?.error || `Request failed (${response.status})`;
        throw new AdminApiError(String(message), response.status, body);
    }
    return body;
}

/** GET a Netlify admin function, e.g. adminGet("admin-audit-log", { limit: 50 }). */
export async function adminGet(fn: string, params: Record<string, string | number | undefined | null> = {}) {
    const token = await requireToken();
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
    }
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const response = await fetch(`${getApiBase()}/${fn}${suffix}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
    });
    return parse(response);
}

/** POST JSON to a Netlify admin function. */
export async function adminPost(fn: string, payload: unknown) {
    const token = await requireToken();
    const response = await fetch(`${getApiBase()}/${fn}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    return parse(response);
}

/** POST to a Next.js route under /api (same origin). */
export async function nextApiPost(path: string, payload: unknown) {
    const token = await requireToken();
    const response = await fetch(path, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    return parse(response);
}

export function newIdempotencyKey(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export const formatDate = (value?: string | null) => {
    if (!value) return "N/A";
    return new Date(value).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

export const formatCurrency = (amount?: number | null, currency = "USD") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(amount || 0));

export const formatNumber = (value?: number | null) => new Intl.NumberFormat("en-US").format(Number(value || 0));

/** Badge classes for a subscription status. */
export function statusBadgeClass(status?: string | null) {
    switch (status) {
        case "active":
            return "border-green-200 bg-green-50 text-success";
        case "past_due":
            return "border-amber-200 bg-amber-50 text-warning";
        case "cancelled":
        case "expired":
            return "border-red-200 bg-red-50 text-error";
        default:
            return "border-line bg-yellow-tint text-ink";
    }
}

export function statusLabel(status?: string | null) {
    if (status === "past_due") return "past due";
    return status || "active";
}
