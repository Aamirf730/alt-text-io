# Production Token Verification Fix

## 🔍 **The Problem**

"Token signature verification failed" in production but works in sandbox means:
- **Frontend** is generating tokens from one Supabase project
- **Backend** is trying to verify tokens against a different Supabase project

## ✅ **The Solution: Verify Supabase Project Consistency**

All Supabase environment variables must be from the **SAME project**.

### **Frontend Variables (Build scope):**
```
REACT_APP_SUPABASE_URL=https://xxxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### **Backend Variables (Functions scope):**
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 🔧 **Step-by-Step Fix**

### **Step 1: Get Your Supabase Project URL**

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy the **Project URL** (looks like `https://xxxxx.supabase.co`)

### **Step 2: Get Your Supabase Keys**

From the same **Settings** → **API** page:

1. **Anon/Public Key** (for frontend):
   - Under "Project API keys"
   - Copy the `anon` `public` key
   - This goes in `REACT_APP_SUPABASE_ANON_KEY`

2. **Service Role Key** (for backend):
   - Under "Project API keys"
   - Copy the `service_role` `secret` key
   - ⚠️ **Keep this secret!** Never expose it in frontend code
   - This goes in `SUPABASE_SERVICE_ROLE_KEY`

### **Step 3: Verify Netlify Environment Variables**

Go to Netlify → **Site settings** → **Environment variables**

**Check these match:**

1. **`REACT_APP_SUPABASE_URL`** (Build scope)
   - Should be: `https://xxxxx.supabase.co`
   - Must match your Supabase project URL

2. **`SUPABASE_URL`** (Functions scope)
   - Should be: `https://xxxxx.supabase.co`
   - ⚠️ **MUST BE THE SAME** as `REACT_APP_SUPABASE_URL`

3. **`REACT_APP_SUPABASE_ANON_KEY`** (Build scope)
   - Should start with: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Must be from the same project as the URL

4. **`SUPABASE_SERVICE_ROLE_KEY`** (Functions scope)
   - Should start with: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Must be from the same project as the URL
   - Different from the anon key (this is the secret key)

### **Step 4: Quick Verification**

**The URLs MUST match:**
```
REACT_APP_SUPABASE_URL = SUPABASE_URL
```

**Example (CORRECT):**
```
REACT_APP_SUPABASE_URL=https://qurbdtzrngzfzevgoolp.supabase.co
SUPABASE_URL=https://qurbdtzrngzfzevgoolp.supabase.co
```

**Example (WRONG - will cause token verification to fail):**
```
REACT_APP_SUPABASE_URL=https://project1.supabase.co
SUPABASE_URL=https://project2.supabase.co  ❌ Different projects!
```

## 🧪 **Test After Fix**

1. **Redeploy** Netlify (or wait for auto-deploy)
2. **Clear browser cache** and cookies
3. **Sign out** and **sign in again** (to get a fresh token)
4. **Try the payment button** again

## 📋 **Common Mistakes**

1. ❌ Using different Supabase projects for frontend and backend
2. ❌ Copying sandbox Supabase keys to production
3. ❌ Using anon key instead of service role key in backend
4. ❌ Using service role key in frontend (security risk!)

## 🔍 **How to Check if Variables Match**

1. Go to Netlify → Environment variables
2. Check `REACT_APP_SUPABASE_URL` and `SUPABASE_URL`
3. They should have the **exact same value**
4. If different, update one to match the other

## 💡 **Why This Happens**

- Sandbox might use one Supabase project
- Production might accidentally use a different project
- Or environment variables got mixed up during migration

## ✅ **After Fixing**

The token verification should work because:
- Frontend generates token using Project A's anon key
- Backend verifies token using Project A's service role key
- Both keys are from the same project, so signature matches ✅

