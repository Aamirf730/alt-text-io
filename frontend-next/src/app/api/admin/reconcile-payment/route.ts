import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";
import {
    isReplayableEvent,
    loadBillingProfileById,
    replayPolarEvent,
    type PolarHandlerOutcome,
} from "@/lib/polar-webhook-handlers";
import { safeServerError } from "@/lib/safe-server-log";

/*
 * POST /api/admin/reconcile-payment
 *
 * Assigns an unmatched Polar event (a payment_reconciliation row) to a user
 * and replays it through the webhook handlers with that profile.
 *
 * Auth:    Authorization: Bearer <Supabase access token> of a confirmed
 *          SUPERUSER_EMAILS account.
 * Body:    { "reconciliation_id": "<uuid>", "user_id": "<uuid>" }
 * 200:     { success: true, result: { reconciliation_id, user_id, event_name, outcome, reason? } }
 * 400:     invalid body
 * 401/403: not signed in / not an admin
 * 404:     reconciliation row or user profile not found
 * 409:     row already resolved or ignored, or another request is replaying it
 *          (nothing replayed)
 * 422:     the event cannot be applied by a replay (unsupported event, the
 *          handler queued it again, e.g. an unknown product, or ignored it,
 *          e.g. a stale or mismatched subscription); the row stays open
 * 500:     replay or database failure; the row stays open and can be retried
 *
 * The row is claimed (status "processing") before the replay and set to
 * "resolved" after it, or back to "open" on any failure or 422 outcome.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

// A "processing" claim older than this belongs to a request that died
// mid-replay; it may be claimed again.
const PROCESSING_STALE_MS = 10 * 60 * 1000;

function isClaimable(row: { status?: unknown; updated_at?: unknown }): boolean {
    if (row.status === "open") return true;
    if (row.status !== "processing") return false;
    const updatedAt = new Date(String(row.updated_at || 0)).getTime();
    return Number.isFinite(updatedAt) && Date.now() - updatedAt >= PROCESSING_STALE_MS;
}

function jsonError(status: number, error: string, extra: Record<string, unknown> = {}) {
    return NextResponse.json({ success: false, error, ...extra }, { status });
}

export async function POST(request: NextRequest) {
    const supabase = getSupabaseClient();

    const auth = await requireAdmin(request, supabase);
    if (!auth.ok) {
        return jsonError(auth.status, auth.error);
    }

    let body: { reconciliation_id?: unknown; user_id?: unknown };
    try {
        body = await request.json();
    } catch {
        return jsonError(400, "Request body must be JSON");
    }

    const reconciliationId = typeof body?.reconciliation_id === "string" ? body.reconciliation_id.trim() : "";
    const userId = typeof body?.user_id === "string" ? body.user_id.trim() : "";
    if (!UUID_PATTERN.test(reconciliationId) || !UUID_PATTERN.test(userId)) {
        return jsonError(400, "reconciliation_id and user_id must be UUIDs");
    }

    try {
        const { data: row, error: rowError } = await supabase
            .from("payment_reconciliation")
            .select("id, event_name, status, payload, payment_id, subscription_id, reason, updated_at")
            .eq("id", reconciliationId)
            .maybeSingle();

        if (rowError) throw rowError;
        if (!row) {
            return jsonError(404, "Reconciliation row not found");
        }

        if (!isClaimable(row)) {
            return jsonError(409, `Reconciliation row is already ${row.status}`, { status: row.status });
        }

        const eventName = String(row.event_name || "");
        if (!isReplayableEvent(eventName)) {
            return jsonError(422, `Event ${eventName || "(none)"} cannot be replayed`);
        }

        const profile = await loadBillingProfileById(userId);
        if (!profile) {
            return jsonError(404, "User profile not found");
        }

        // Claim the row before replaying, so two admins cannot replay the
        // same event at once. A row left "processing" by a request that died
        // can be claimed again once it is stale.
        const claimedAt = new Date().toISOString();
        const staleBefore = new Date(Date.now() - PROCESSING_STALE_MS).toISOString();
        const { data: claimed, error: claimError } = await supabase
            .from("payment_reconciliation")
            .update({ status: "processing", updated_at: claimedAt })
            .eq("id", reconciliationId)
            .or(`status.eq.open,and(status.eq.processing,updated_at.lt."${staleBefore}")`)
            .select("id, payload");

        if (claimError) throw claimError;
        if (!claimed || claimed.length === 0) {
            return jsonError(409, "Reconciliation row is being processed by another request");
        }

        const releaseClaim = async () => {
            const { error: releaseError } = await supabase
                .from("payment_reconciliation")
                .update({ status: "open", updated_at: new Date().toISOString() })
                .eq("id", reconciliationId)
                .eq("status", "processing");
            if (releaseError) {
                console.error("Reconciliation claim release failed:", safeServerError(releaseError));
            }
        };

        let replay: PolarHandlerOutcome;
        try {
            replay = await replayPolarEvent(eventName, claimed[0].payload ?? row.payload ?? {}, profile);
        } catch (replayError) {
            await releaseClaim();
            throw replayError;
        }

        // Only an applied event resolves the row. "queued" (e.g. an unknown
        // product) and "ignored" (stale or mismatched subscription, Free
        // profile) changed nothing, so the row goes back to open.
        if (replay.outcome !== "applied") {
            await releaseClaim();
            return jsonError(422, "The event could not be applied to this user", {
                outcome: replay.outcome,
                reason: replay.reason || null,
            });
        }

        const now = new Date().toISOString();
        const resolutionNotes = replay.reason
            ? `Replayed ${eventName} for user ${userId} (${replay.reason})`
            : `Replayed ${eventName} for user ${userId}`;

        const { data: resolved, error: resolveError } = await supabase
            .from("payment_reconciliation")
            .update({
                status: "resolved",
                resolved_at: now,
                resolved_by: auth.admin.id,
                resolved_user_id: userId,
                resolution_notes: resolutionNotes,
                updated_at: now,
            })
            .eq("id", reconciliationId)
            .eq("status", "processing")
            .select("id");

        if (resolveError) throw resolveError;
        if (!resolved || resolved.length === 0) {
            // Our claim went stale and another request took the row over.
            // The handlers are idempotent, so the billing state is correct.
            return jsonError(409, "Reconciliation row was taken over by another request");
        }

        const result = {
            reconciliation_id: reconciliationId,
            user_id: userId,
            event_name: eventName,
            outcome: replay.outcome,
            ...(replay.reason ? { reason: replay.reason } : {}),
        };

        const { error: auditError } = await supabase.from("audit_logs").insert({
            actor_id: auth.admin.id,
            actor_email: auth.admin.email,
            action: "payment_reconciliation_resolved",
            resource_type: "payment_reconciliation",
            resource_id: reconciliationId,
            details: {
                ...result,
                payment_id: row.payment_id || null,
                subscription_id: row.subscription_id || null,
                original_reason: row.reason || null,
            },
            severity: "warning",
            ip_address: request.headers.get("x-nf-client-connection-ip")
                || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
                || null,
            user_agent: request.headers.get("user-agent"),
        });

        if (auditError) {
            // The billing change and resolution are committed; report the
            // missing audit row loudly rather than failing the request.
            console.error("Reconciliation audit log failed:", safeServerError(auditError));
        }

        return NextResponse.json({ success: true, result });
    } catch (error) {
        console.error("Payment reconciliation replay failed:", safeServerError(error));
        return jsonError(500, "Replay failed. The row is still open and can be retried.");
    }
}
