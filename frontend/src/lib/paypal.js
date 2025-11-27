// PayPal configuration
export const PAYPAL_CLIENT_ID = process.env.REACT_APP_PAYPAL_CLIENT_ID || 'test';

// PayPal plan ID mapping - production plan IDs from PayPal dashboard
// You can also override these via environment variables: REACT_APP_PAYPAL_PLAN_TIER1, etc.
export const PAYPAL_PLAN_IDS = {
    tier1: {
        monthly: process.env.REACT_APP_PAYPAL_PLAN_TIER1 || 'P-8R4278588L5455645NEMOH6A',
        annual: process.env.REACT_APP_PAYPAL_PLAN_TIER1_ANNUAL || 'P-ANNUAL_TIER1_PLACEHOLDER'
    },
    tier2: {
        monthly: process.env.REACT_APP_PAYPAL_PLAN_TIER2 || 'P-5XP84993MM234080GNEMOTRQ',
        annual: process.env.REACT_APP_PAYPAL_PLAN_TIER2_ANNUAL || 'P-ANNUAL_TIER2_PLACEHOLDER'
    },
    tier3: {
        monthly: process.env.REACT_APP_PAYPAL_PLAN_TIER3 || 'P-2DC95956TS8763323NEMOWJQ',
        annual: process.env.REACT_APP_PAYPAL_PLAN_TIER3_ANNUAL || 'P-ANNUAL_TIER3_PLACEHOLDER'
    }
};

export const paypalOptions = {
    "client-id": PAYPAL_CLIENT_ID,
    currency: "USD",
    intent: "capture",
    "enable-funding": "venmo",
    "disable-funding": "paylater,card"
};

// PayPal subscription options (for subscription plans)
export const paypalSubscriptionOptions = {
    "client-id": PAYPAL_CLIENT_ID,
    currency: "USD",
    vault: true,
    intent: "subscription"
};
