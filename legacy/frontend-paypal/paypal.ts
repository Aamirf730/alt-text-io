
// PayPal configuration
export const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'test';

// PayPal plan ID mapping - production plan IDs from PayPal dashboard
// You can also override these via environment variables: NEXT_PUBLIC_PAYPAL_PLAN_TIER1, etc.
export const PAYPAL_PLAN_IDS: Record<string, { monthly: string; annual: string }> = {
    tier1: {
        monthly: process.env.NEXT_PUBLIC_PAYPAL_PLAN_TIER1 || 'P-8R4278588L5455645NEMOH6A',
        annual: process.env.NEXT_PUBLIC_PAYPAL_PLAN_TIER1_ANNUAL || 'P-72F7073340143723RNEO5MJQ'
    },
    tier2: {
        monthly: process.env.NEXT_PUBLIC_PAYPAL_PLAN_TIER2 || 'P-5XP84993MM234080GNEMOTRQ',
        annual: process.env.NEXT_PUBLIC_PAYPAL_PLAN_TIER2_ANNUAL || 'P-72E84789X7765625DNEO5MWQ'
    },
    tier3: {
        monthly: process.env.NEXT_PUBLIC_PAYPAL_PLAN_TIER3 || 'P-2DC95956TS8763323NEMOWJQ',
        annual: process.env.NEXT_PUBLIC_PAYPAL_PLAN_TIER3_ANNUAL || 'P-0LS99266WU663161ENEO5NCQ'
    }
};

export const paypalOptions = {
    "clientId": PAYPAL_CLIENT_ID,
    currency: "USD",
    intent: "capture",
    "enableFunding": "venmo",
    "disableFunding": "paylater,card"
};

// PayPal subscription options (for subscription plans)
export const paypalSubscriptionOptions = {
    "clientId": PAYPAL_CLIENT_ID,
    currency: "USD",
    vault: true,
    intent: "subscription"
};
