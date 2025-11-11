# Reset Test User Guide

## Quick Reset: Use Supabase SQL Editor (Easiest)

1. **Go to your Supabase Dashboard**
   - Navigate to: https://app.supabase.com
   - Select your project
   - Go to **SQL Editor** in the left sidebar

2. **Run the SQL Script**
   - Open the file: `supabase-migration/reset-test-user.sql`
   - Copy the entire contents
   - Paste into Supabase SQL Editor
   - Click **Run** (or press Cmd/Ctrl + Enter)

3. **Verify Results**
   - The script will output:
     - Current user state (before reset)
     - Reset confirmation
     - New user state (after reset)
     - User isolation verification

## What Gets Reset

✅ **Credits**: Reset to 100 (free plan default)
✅ **Total Processed**: Reset to 0
✅ **Subscription Plan**: Reset to 'free'
✅ **Subscription Status**: Reset to 'active'
✅ **Usage Logs**: All deleted
✅ **Subscription ID**: Cleared
✅ **Billing Date**: Cleared

## User Isolation Verification

The script also verifies that:
- ✅ Each user has separate credits
- ✅ Each user has separate usage logs
- ✅ User data is completely isolated
- ✅ No data leakage between users

## Alternative: Node.js Script

If you prefer to use the Node.js script:

1. **Set environment variables:**
   ```bash
   export SUPABASE_URL="https://your-project.supabase.co"
   export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   ```

2. **Run the script:**
   ```bash
   cd netlify-functions
   node reset-test-user.js
   ```

## After Reset

Your test user `aamirf730@gmail.com` will have:
- 100 credits (free plan)
- 0 images processed
- No usage history
- Fresh state for testing

## Testing Checklist

After reset, test:
- [ ] Generate alt-text for 1 image → Credits should become 99
- [ ] Check dashboard → Should show 99 credits
- [ ] Generate alt-text for 5 more images → Credits should become 94
- [ ] Bulk process 10 images → Should work if credits >= 10
- [ ] Exhaust credits → Should stop processing when credits = 0
- [ ] Verify other users' credits are unaffected

