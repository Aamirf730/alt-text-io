import { Webhooks } from "@polar-sh/nextjs";
import {
    handleOrderPaid,
    handleOrderRefunded,
    handleRefund,
    handleSubscriptionActive,
    handleSubscriptionCanceled,
    handleSubscriptionRevoked,
    handleSubscriptionUncanceled,
    handleSubscriptionUpdated,
} from "@/lib/polar-webhook-handlers";
import { safeServerError } from "@/lib/safe-server-log";

// The billing logic lives in lib/polar-webhook-handlers.ts so the admin
// reconciliation route can replay a stored event through the same code.
// Handler errors are rethrown: returning 200 would stop Polar retrying an
// event that was not recorded or fulfilled.
function withErrorLogging<T>(
    label: string,
    handler: (data: T) => Promise<unknown>,
): (payload: { data: T }) => Promise<void> {
    return async (payload) => {
        try {
            await handler(payload.data);
        } catch (error) {
            console.error(`Error processing ${label} webhook:`, safeServerError(error));
            throw error;
        }
    };
}

const polarWebhookHandlers = {
    onOrderPaid: withErrorLogging("order paid", (order) => handleOrderPaid(order)),
    onSubscriptionActive: withErrorLogging("subscription active", (subscription) => handleSubscriptionActive(subscription)),
    onSubscriptionCanceled: withErrorLogging("subscription canceled", (subscription) => handleSubscriptionCanceled(subscription)),
    onSubscriptionRevoked: withErrorLogging("subscription revoked", (subscription) => handleSubscriptionRevoked(subscription)),
    onSubscriptionUncanceled: withErrorLogging("subscription uncanceled", (subscription) => handleSubscriptionUncanceled(subscription)),
    onSubscriptionUpdated: withErrorLogging("subscription updated", (subscription) => handleSubscriptionUpdated(subscription)),
    onOrderRefunded: withErrorLogging("order refunded", (order) => handleOrderRefunded(order)),
    // refund.created can arrive before or after order.refunded, and a refund
    // may be pending when it does; refund.updated reprocesses the final
    // status. Both are idempotent.
    onRefundCreated: withErrorLogging("refund created", (refund) => handleRefund(refund, "refund_created")),
    onRefundUpdated: withErrorLogging("refund updated", (refund) => handleRefund(refund, "refund_updated")),
} satisfies Omit<Parameters<typeof Webhooks>[0], "webhookSecret">;

const polarWebhookSecret = process.env.POLAR_WEBHOOK_SECRET;

if (!polarWebhookSecret) {
    console.error("POLAR_WEBHOOK_SECRET is not configured; Polar webhooks are disabled");
}

export const POST = polarWebhookSecret
    ? Webhooks({
        webhookSecret: polarWebhookSecret,
        ...polarWebhookHandlers,
    })
    : async () => new Response(
        JSON.stringify({ success: false, error: "Webhook service unavailable" }),
        {
            status: 503,
            headers: { "content-type": "application/json" },
        },
    );
