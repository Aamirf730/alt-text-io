import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { safeServerError } from "@/lib/safe-server-log";

/*
 * GET /api/account/export
 *
 * "Download my data": everything Alt Text Pro holds about the signed-in
 * account, as one JSON file. Only the session's own rows are read, and
 * internal values (API key hashes, provider IDs, IP addresses) are left out.
 * Polar holds the card and invoice details; the file says where to get them.
 */

const getSupabaseClient = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const PROFILE_COLUMNS = [
    "email",
    "subscription_plan",
    "subscription_status",
    "billing_cycle",
    "monthly_credit_allowance",
    "credits_remaining",
    "bonus_credits_remaining",
    "purchased_credits_remaining",
    "next_billing_date",
    "credits_last_renewed_at",
    "marketing_unsubscribed_at",
    "created_at",
].join(", ");

// Generation history can be long; the newest rows are what people look for.
const MAX_HISTORY_ROWS = 10000;

export async function GET(req: NextRequest) {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const supabase = getSupabaseClient();
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
        }

        const [profile, history, payments, sites, events, emails] = await Promise.all([
            supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).maybeSingle(),
            supabase.from("usage_logs")
                .select("created_at, credits_used, alt_text_generated, image_context")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false })
                .limit(MAX_HISTORY_ROWS),
            supabase.from("payments")
                .select("created_at, product_name, plan_id, amount, currency, status, discount_code")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false }),
            supabase.from("plugin_sites")
                .select("site_url, plugin_version, wp_locale, first_seen_at, last_seen_at, disconnected_at")
                .eq("user_id", user.id),
            supabase.from("marketing_events")
                .select("event_name, source, occurred_at")
                .eq("user_id", user.id)
                .order("occurred_at", { ascending: false })
                .limit(MAX_HISTORY_ROWS),
            supabase.from("marketing_automation_sends")
                .select("automation_key, subject, status, sent_at")
                .eq("user_id", user.id),
        ]);

        const firstError = [profile, history, payments, sites, events, emails].find((result) => result.error)?.error;
        if (firstError) throw firstError;

        const exportedAt = new Date().toISOString();
        const body = {
            exported_at: exportedAt,
            notes: [
                "This file holds the data Alt Text Pro keeps for your account.",
                "Card details, receipts and invoices are held by Polar, our payment provider: open Billing & receipts in your dashboard.",
                "Images are not stored after their alt text is written, so they are not included.",
            ],
            account: {
                id: user.id,
                sign_in_email: user.email,
                sign_in_methods: (user.identities || []).map((identity) => identity.provider),
                created_at: user.created_at,
                last_sign_in_at: user.last_sign_in_at,
            },
            profile: profile.data || null,
            generation_history: history.data || [],
            payments: payments.data || [],
            connected_sites: sites.data || [],
            activity_events: events.data || [],
            emails_sent: emails.data || [],
        };

        return new NextResponse(JSON.stringify(body, null, 2), {
            status: 200,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Content-Disposition": `attachment; filename="alt-text-pro-data-${exportedAt.slice(0, 10)}.json"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error: unknown) {
        console.error("Data export error:", safeServerError(error));
        return NextResponse.json({ error: "Could not prepare your data. Please try again later." }, { status: 500 });
    }
}
