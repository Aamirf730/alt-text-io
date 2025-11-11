# PayPal Native Subscription Buttons Setup

We've updated the code to use PayPal's native subscription buttons instead of the custom redirect flow. This is more reliable and matches PayPal's recommended approach.

## What Changed

1. **Replaced custom subscription flow** with PayPal's native `PayPalButtons` component using `createSubscription`
2. **Added PayPal plan ID mapping** at the top of `App.js`
3. **Integrated with our backend** - subscriptions still call our `complete-payment` function to update the database

## Configuration Required

### Step 1: Get Your PayPal Plan IDs

From your PayPal dashboard, copy the Plan IDs for each tier:
- **Tier 1 Plan ID:** `P-8MW1788774227562KNEJXD6Q` (you already have this)
- **Tier 2 Plan ID:** Copy from PayPal dashboard
- **Tier 3 Plan ID:** Copy from PayPal dashboard

### Step 2: Update Environment Variables (Recommended)

Add these to your Netlify environment variables:

```
REACT_APP_PAYPAL_PLAN_TIER1=P-8MW1788774227562KNEJXD6Q
REACT_APP_PAYPAL_PLAN_TIER2=P-XXXXXXXXXXXXX
REACT_APP_PAYPAL_PLAN_TIER3=P-YYYYYYYYYYYYY
```

**OR** update the hardcoded values in `frontend/src/App.js`:

```javascript
const PAYPAL_PLAN_IDS = {
  tier1: 'P-8MW1788774227562KNEJXD6Q', // Your Tier 1 plan ID
  tier2: 'P-XXXXXXXXXXXXX', // Your Tier 2 plan ID
  tier3: 'P-YYYYYYYYYYYYY'  // Your Tier 3 plan ID
};
```

## How It Works

1. **User clicks "Subscribe"** → PayPal button appears
2. **User clicks PayPal button** → PayPal SDK creates subscription using the plan ID
3. **User approves on PayPal** → `onApprove` callback fires
4. **We call `complete-payment`** → Updates database with subscription details
5. **User redirected to dashboard** → Subscription is active

## Benefits

✅ **More reliable** - Uses PayPal's official subscription flow  
✅ **Better UX** - Native PayPal buttons with proper styling  
✅ **No redirects** - Everything happens in-page  
✅ **Automatic handling** - PayPal handles approval flow  
✅ **Still integrated** - Works with our backend for database updates

## Testing

1. Make sure all plan IDs are configured
2. Test subscription flow for each tier (Tier 1, Tier 2, Tier 3)
3. Verify subscription appears in PayPal dashboard
4. Verify database is updated correctly
5. Verify credits are added to user account

## Troubleshooting

### "PayPal plan ID not found" error
- Make sure you've set the plan IDs in `PAYPAL_PLAN_IDS` object or environment variables
- Check that the plan IDs match exactly (including the `P-` prefix)

### Subscription not completing
- Check browser console for errors
- Verify `complete-payment` function is being called
- Check Netlify function logs for errors
- Verify user is authenticated (has valid session)

### Button not appearing
- Check that `REACT_APP_PAYPAL_CLIENT_ID` is set correctly
- Verify PayPal SDK is loading (check browser console)
- Make sure you're using the correct PayPal Client ID (production vs sandbox)

