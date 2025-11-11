# How to Verify PayPal Plan Status

The error `PLAN_STATUS_INVALID` means PayPal says your plan is not active. Here's how to verify and fix it:

## Step 1: Check Plan Status in PayPal Dashboard

1. Go to **PayPal Developer Dashboard**: https://developer.paypal.com
2. Make sure you're on the **Production/Live** tab (not Sandbox)
3. Navigate to **Subscriptions** → **Plans** (or **Products & Plans**)
4. Find each of your plans:
   - `P-10836440LT044463FNEJT6IA` (Tier 1)
   - `P-7US9083943782122RNEJT6II` (Tier 2)
   - `P-0FH659595N652425UNEJT6II` (Tier 3)

5. **Check the Status column** - it should say **"ACTIVE"**

## Step 2: If Status is NOT "ACTIVE"

If the status shows:
- **"DRAFT"** → Click on the plan and look for "Publish" or "Activate" button
- **"INACTIVE"** → Click on the plan and change status to "Active"
- **"PENDING"** → Wait a few minutes, then refresh
- **"CREATED"** → You need to activate it

## Step 3: Activate the Plan

1. Click on the plan name/ID
2. Look for a **"Status"** dropdown or **"Activate"** button
3. Change status to **"ACTIVE"**
4. Click **"Save"** or **"Update"**
5. Wait 1-2 minutes for PayPal to process

## Step 4: Verify via PayPal API (Optional)

You can verify the plan status programmatically:

```bash
# Get your PayPal access token first
curl -X POST https://api-m.paypal.com/v1/oauth2/token \
  -H "Accept: application/json" \
  -H "Accept-Language: en_US" \
  -u "YOUR_CLIENT_ID:YOUR_SECRET" \
  -d "grant_type=client_credentials"

# Then check plan status (replace PLAN_ID and ACCESS_TOKEN)
curl -X GET https://api-m.paypal.com/v1/billing/plans/P-10836440LT044463FNEJT6IA \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

Look for `"status": "ACTIVE"` in the response.

## Common Issues

### Issue 1: Plan Shows Active but API Says Invalid
- **Solution**: Wait 2-5 minutes after activating. PayPal needs time to sync.

### Issue 2: Can't Find Activate Button
- **Solution**: Some plans need to be "published" first. Look for a "Publish" button.

### Issue 3: Plan is in Sandbox, Not Production
- **Solution**: Make sure you're checking the **Production/Live** tab, not Sandbox.

### Issue 4: Plan ID Mismatch
- **Solution**: Double-check the plan IDs match exactly (including the `P-` prefix).

## After Activating

1. Wait 2-5 minutes for PayPal to sync
2. Hard refresh your browser (Cmd+Shift+R)
3. Try the subscription again
4. Check browser console to see which plan ID is being used

## Still Not Working?

If the plan shows "ACTIVE" in the dashboard but still gives this error:

1. **Check the exact plan ID** being sent (check browser console logs)
2. **Verify you're using production credentials** (not sandbox)
3. **Try creating a new plan** if the current one seems stuck
4. **Contact PayPal Support** with the debug_id: `f372037ba6c8c`

