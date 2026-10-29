import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBearerToken, getSuperuserEmails, requireAdmin } from "./admin-auth";

type TestUser = { id: string; email: string | null; email_confirmed_at: string | null } | null;

function client(user: TestUser, error: Error | null = null) {
    const getUser = vi.fn(async () => ({ data: { user }, error }));
    return { client: { auth: { getUser } } as unknown as SupabaseClient, getUser };
}

const request = (authorization?: string) => new Request("http://localhost/api/admin/reconcile-payment", {
    method: "POST",
    headers: authorization ? { Authorization: authorization } : {},
});

describe("admin auth", () => {
    beforeEach(() => {
        process.env.SUPERUSER_EMAILS = " Admin@Example.com , ops@example.com,";
    });

    it("parses SUPERUSER_EMAILS case-insensitively", () => {
        expect(getSuperuserEmails()).toEqual(new Set(["admin@example.com", "ops@example.com"]));
        expect(getSuperuserEmails("")).toEqual(new Set());
    });

    it("reads only a Bearer token", () => {
        expect(getBearerToken(request("Bearer abc.def"))).toBe("abc.def");
        expect(getBearerToken(request("Basic abc"))).toBeNull();
        expect(getBearerToken(request())).toBeNull();
    });

    it("requires a token", async () => {
        const { client: supabase, getUser } = client(null);
        await expect(requireAdmin(request(), supabase)).resolves.toMatchObject({ ok: false, status: 401 });
        expect(getUser).not.toHaveBeenCalled();
    });

    it("verifies the token with Supabase Auth", async () => {
        const { client: supabase, getUser } = client(null, new Error("invalid JWT"));
        await expect(requireAdmin(request("Bearer bad"), supabase)).resolves.toMatchObject({ ok: false, status: 401 });
        expect(getUser).toHaveBeenCalledWith("bad");
    });

    it("rejects an unlisted email", async () => {
        const { client: supabase } = client({ id: "u1", email: "user@example.com", email_confirmed_at: "2026-01-01T00:00:00Z" });
        await expect(requireAdmin(request("Bearer t"), supabase)).resolves.toMatchObject({ ok: false, status: 403 });
    });

    it("rejects a listed email that has not been confirmed", async () => {
        const { client: supabase } = client({ id: "u1", email: "admin@example.com", email_confirmed_at: null });
        await expect(requireAdmin(request("Bearer t"), supabase)).resolves.toMatchObject({ ok: false, status: 403 });
    });

    it("accepts a confirmed listed email", async () => {
        const { client: supabase } = client({ id: "u1", email: "ADMIN@example.com", email_confirmed_at: "2026-01-01T00:00:00Z" });
        await expect(requireAdmin(request("Bearer t"), supabase)).resolves.toEqual({
            ok: true,
            admin: { id: "u1", email: "admin@example.com" },
        });
    });
});
