# PayPal Plan Status Invalid - Fix Guide

The error `PLAN_STATUS_INVALID` means PayPal is rejecting the subscription because the plan status is not "ACTIVE".

## Critical Steps to Fix

### Step 1: Verify Plans are ACTIVE in PayPal Dashboard

1. Go to **PayPal Developer Dashboard**: https://developer.paypal.com
2. **Switch to Production/Live tab** (not Sandbox)
3. Navigate to **Subscriptions** → **Plans**
4. Find each plan by ID:
   - `P-10836440LT044463FNEJT6IA` (Tier 1)
   - `P-7US9083943782122RNEJT6II` (Tier 2)
   - `P-0FH659595N652425UNEJT6II` (Tier 3)

5. **Check the Status column** - it MUST say **"ACTIVE"**

### Step 2: If Status is NOT "ACTIVE"

**For each plan that's not ACTIVE:**

1. Click on the plan
2. Look for:
   - A **"Status"** dropdown → Change to "ACTIVE"
   - An **"Activate"** button → Click it
   - A **"Publish"** button → Click it first, then activate
3. Click **"Save"** or **"Update"**
4. Wait 2-5 minutes for PayPal to sync

### Step 3: Verify Netlify Environment Variables

Even though the frontend has hardcoded plan IDs, make sure Netlify has them too (for backend verification):

1. Go to **Netlify Dashboard** → Your Site → **Environment Variables**
2. Verify these are set:
   ```
   PAYPAL_PLAN_TIER1=P-10836440LT044463FNEJT6IA
   PAYPAL_PLAN_TIER2=P-7US9083943782122RNEJT6II
   PAYPAL_PLAN_TIER3=P-0FH659595N652425UNEJT6II
   ```

### Step 4: Test Again

1. **Wait 5 minutes** after activating plans (PayPal needs time to sync)
2. **Hard refresh browser** (Cmd+Shift+R or Ctrl+Shift+R)
3. **Clear browser cache** if needed
4. Try subscribing again

## If Plans Show "ACTIVE" But Still Error

### Option 1: Check Plan Details
- Click on each plan in PayPal dashboard
- Verify:
  - Status is "ACTIVE" (not "CREATED" or "DRAFT")
  - Billing cycle is set correctly
  - Price matches ($12, $20, $40)
  - Setup fee is $0.00

### Option 2: Verify Plan via API
You can check the actual plan status via PayPal API:

```bash
# Get access token
curl -X POST https://api-m.paypal.com/v1/oauth2/token \
  -u "YOUR_CLIENT_ID:YOUR_SECRET" \
  -d "grant_type=client_credentials"

# Check plan status (replace ACCESS_TOKEN and PLAN_ID)
curl -X GET https://api-m.paypal.com/v1/billing/plans/P-10836440LT044463FNEJT6IA \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

Look for `"status": "ACTIVE"` in the response.

### Option 3: Recreate Plans
If plans are stuck, you might need to:
1. Create new plans in PayPal dashboard
2. Update the plan IDs in `frontend/src/App.js`
3. Update Netlify environment variables

## Common Issues

- **"CREATED" status**: Plan exists but isn't activated → Click "Activate"
- **"DRAFT" status**: Plan is in draft → Click "Publish" then "Activate"
- **"INACTIVE" status**: Plan was deactivated → Click "Activate"
- **Delay**: PayPal can take 2-5 minutes to sync status changes

## Still Not Working?

If plans are confirmed ACTIVE in PayPal but still error:
1. Check browser console for which plan ID is being used
2. Verify you're using Production credentials (not Sandbox)
3. Contact PayPal Support with debug_id: `f372037ba6c8c`

