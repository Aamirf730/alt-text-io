# Credit Synchronization Guide

## Overview

This document explains how credits are synchronized between the WordPress plugin, user dashboard, and subscription system to ensure accurate credit tracking across all platforms.

## Architecture

```
WordPress Plugin
    ↓ (API Key)
Netlify Functions (generate-alt-text.js)
    ↓ (Validates & Checks Credits)
Supabase Database (profiles table)
    ↓ (Single Source of Truth)
User Dashboard (alt-text.pro)
```

## Credit Flow

### 1. **Single Source of Truth: Supabase `profiles` Table**

All credits are stored and managed in the Supabase `profiles` table:
- `credits_remaining`: Current available credits
- `subscription_plan`: Active subscription plan
- `subscription_status`: Status (active, cancelled, expired)
- `total_processed`: Total images processed

### 2. **Credit Checking (Before Generation)**

Every time the plugin generates alt-text:

1. **Plugin sends request** → `POST /api/generate-alt-text` with API key
2. **Netlify function validates API key** → Checks Supabase `api_keys` table
3. **Function fetches fresh credits** → Queries `profiles` table (no caching)
4. **Function checks credits** → Returns 402 if `credits_remaining <= 0`
5. **If credits available** → Proceeds with generation

**Key Point**: Credits are **always** checked fresh from the database - no local caching in the plugin.

### 3. **Credit Deduction (After Generation)**

After successful alt-text generation:

1. **Alt-text generated** → Using Gemini API
2. **Credits deducted** → Using `use_credit()` RPC function
3. **Database updated** → `credits_remaining` decremented, `total_processed` incremented
4. **Usage logged** → Entry added to `usage_logs` table
5. **Updated credits returned** → Plugin receives new `credits_remaining` value

**Code Location**: `netlify-functions/generate-alt-text.js` (lines 768-870)

### 4. **Credit Synchronization Points**

#### A. Plugin → Backend (Real-time)
- **Every generation**: Plugin checks credits before processing
- **Every response**: Plugin receives updated credits after generation
- **No caching**: Plugin never stores credits locally

#### B. Dashboard → Backend (Real-time)
- **Dashboard loads**: Fetches credits from `profiles` table
- **After payment**: Credits updated via `upgrade_subscription()` RPC
- **After generation**: Credits updated via `use_credit()` RPC

#### C. Subscription Changes → Credits
When user upgrades/changes subscription:

1. **Payment processed** → `complete-payment.js` function
2. **Subscription updated** → `upgrade_subscription()` RPC function called
3. **Credits updated**:
   - **Pay-as-you-go plans**: Credits ADDED to existing (`credits_remaining + plan_credits`)
   - **Monthly plans**: Credits REPLACED (`credits_remaining = plan_credits`)
4. **Database updated** → `profiles` table updated immediately
5. **Next API call**: Plugin sees updated credits immediately

**Code Location**: `supabase-migration/schema.sql` (lines 156-211)

## Implementation Details

### WordPress Plugin Credit Handling

**File**: `wordpress-plugin/alt-text-ai/includes/class-api-client.php`

```php
// Credits are NEVER cached in the plugin
// Every API call fetches fresh credits from backend

public function generate_alt_text($attachment_id, $context = '') {
    // Makes API request
    $response = $this->make_request('generate-alt-text', 'POST', $request_data);
    
    // Returns updated credits from backend response
    return array(
        'success' => true,
        'credits_remaining' => $response['data']['credits_remaining'] ?? 0
    );
}

public function get_usage_stats() {
    // Always fetches fresh credits from backend
    return $this->make_request('get-usage', 'GET');
}
```

### Backend Credit Management

**File**: `netlify-functions/generate-alt-text.js`

```javascript
// 1. Check credits BEFORE generation
const { data: profile } = await supabase
  .from('profiles')
  .select('credits_remaining')
  .eq('id', userId)
  .single();

if (profile.credits_remaining <= 0) {
  return { statusCode: 402, error: 'No credits remaining' };
}

// 2. Generate alt-text
const altText = await generateAltTextWithGemini(imageBase64, context);

// 3. Deduct credits AFTER successful generation
const { data: result } = await supabase.rpc('use_credit', {
  user_uuid: userId,
  alt_text: altText,
  context: context || null
});

// 4. Return updated credits
return {
  credits_remaining: result.credits_remaining,
  credits_used: 1
};
```

### Subscription Upgrade Flow

**File**: `netlify-functions/complete-payment.js`

```javascript
// When payment completes, upgrade subscription
const { data: upgradeResult } = await supabase.rpc('upgrade_subscription', {
  user_uuid: authUser.id,
  new_plan: planId,
  payment_id: paymentId,
  subscription_id: subscriptionId
});

// Credits updated immediately in database
// Next API call from plugin will see updated credits
```

## Ensuring Credit Synchronization

### ✅ Current Implementation (Correct)

1. **No Local Caching**: Plugin never stores credits locally
2. **Fresh Checks**: Every API call checks credits from database
3. **Atomic Operations**: Credit deduction uses database RPC function (atomic)
4. **Single Source**: All credits managed in Supabase `profiles` table
5. **Real-time Updates**: Dashboard and plugin both read from same table

### ⚠️ Potential Issues & Solutions

#### Issue 1: Race Conditions
**Problem**: Multiple simultaneous requests could deduct credits incorrectly.

**Solution**: ✅ Already handled
- `use_credit()` RPC function uses database-level atomic operations
- Credits checked and deducted in single transaction

#### Issue 2: Stale Credit Display
**Problem**: Plugin dashboard might show outdated credits.

**Solution**: ✅ Already handled
- Plugin calls `get-usage` endpoint which fetches fresh credits
- No caching mechanism in plugin

#### Issue 3: Subscription Changes Not Reflected
**Problem**: User upgrades but plugin doesn't see new credits.

**Solution**: ✅ Already handled
- Subscription upgrades update database immediately
- Next API call from plugin fetches fresh credits
- No caching means changes are visible immediately

## Testing Credit Synchronization

### Test 1: Credit Deduction
1. User has 10 credits
2. Generate alt-text for 1 image
3. **Expected**: Credits become 9 in both plugin and dashboard
4. **Verify**: Check `profiles.credits_remaining` in Supabase

### Test 2: Credit Exhaustion
1. User has 1 credit
2. Generate alt-text for 1 image
3. **Expected**: Credits become 0, next generation blocked
4. **Verify**: Plugin shows "No credits remaining" error

### Test 3: Subscription Upgrade
1. User has 5 credits on free plan
2. Upgrade to Tier 1 (1000 credits)
3. **Expected**: Credits immediately become 1000
4. **Verify**: Plugin can generate alt-text immediately after upgrade

### Test 4: Concurrent Requests
1. User has 2 credits
2. Send 2 simultaneous generation requests
3. **Expected**: Both succeed, credits become 0
4. **Verify**: Third request fails with 402 error

### Test 5: Dashboard Sync
1. Generate alt-text via plugin
2. Check dashboard immediately
3. **Expected**: Dashboard shows updated credits
4. **Verify**: Both show same credit count

## Monitoring Credit Accuracy

### Database Queries for Verification

```sql
-- Check user's current credits
SELECT id, email, credits_remaining, subscription_plan, total_processed
FROM profiles
WHERE email = 'user@example.com';

-- Check recent credit usage
SELECT user_id, credits_used, created_at, alt_text_generated
FROM usage_logs
WHERE user_id = 'user-uuid'
ORDER BY created_at DESC
LIMIT 10;

-- Verify credit balance matches usage
SELECT 
  p.id,
  p.credits_remaining,
  p.total_processed,
  COUNT(ul.id) as logged_generations,
  SUM(ul.credits_used) as total_credits_used
FROM profiles p
LEFT JOIN usage_logs ul ON p.id = ul.user_id
WHERE p.id = 'user-uuid'
GROUP BY p.id, p.credits_remaining, p.total_processed;
```

## Best Practices

1. **Always check credits before processing** ✅ (Implemented)
2. **Never cache credits in plugin** ✅ (Implemented)
3. **Use atomic database operations** ✅ (Implemented via RPC)
4. **Log all credit transactions** ✅ (Implemented via usage_logs)
5. **Return updated credits in API responses** ✅ (Implemented)

## Summary

The credit system is properly configured with:
- ✅ Single source of truth (Supabase `profiles` table)
- ✅ Real-time synchronization (no caching)
- ✅ Atomic credit operations (database RPC functions)
- ✅ Proper error handling (402 for no credits)
- ✅ Complete audit trail (usage_logs table)

**The plugin, dashboard, and subscription system all read from and write to the same database table, ensuring perfect synchronization.**

