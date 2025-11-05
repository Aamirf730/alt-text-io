# API Key System Setup Guide

## 🎯 Overview

I've built a complete **API key system** for your SaaS so each user gets their own persistent API key for WordPress plugin integration. This is much better than using session tokens because:

✅ **Persistent** - API keys don't expire like session tokens  
✅ **Unique** - Each user has their own API key  
✅ **Secure** - Keys are stored securely in the database  
✅ **Manageable** - Users can regenerate keys if needed  

---

## 📋 What's Been Implemented

### ✅ **Database Schema**
- Created `api_keys` table with user association
- Added functions: `generate_api_key()`, `get_or_create_api_key()`, `validate_api_key()`
- Added Row Level Security (RLS) policies

### ✅ **Backend Endpoints**
- **`get-api-key`** - Get or create API key for user
- **`auth-validate`** - Updated to validate API keys (supports both API keys and legacy JWT tokens)

### ✅ **Frontend Dashboard**
- Shows user's unique API key instead of session token
- Copy to clipboard functionality
- Show/hide toggle
- Refresh/regenerate button

---

## 🚀 **Setup Instructions**

### **Step 1: Apply Database Migration**

You need to run the SQL migration in your Supabase dashboard:

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project**
3. **Go to SQL Editor**
4. **Run the migration**: Copy and paste the contents of `supabase-migration/create-api-keys-table.sql`

Or use the Supabase CLI:
```bash
supabase migration new create_api_keys_table
# Copy the SQL to the new migration file
supabase db push
```

---

### **Step 2: Verify Migration**

After applying the migration, verify in Supabase:

1. Go to **Table Editor** → Check if `api_keys` table exists
2. Go to **Database Functions** → Check if these functions exist:
   - `generate_api_key()`
   - `get_or_create_api_key(p_user_id UUID)`
   - `validate_api_key(p_api_key TEXT)`

---

### **Step 3: Test the System**

1. **Visit Dashboard**: https://www.alt-text.pro/dashboard
2. **Check API Key Section**: Should show "Loading..." then display your API key
3. **Test in WordPress**: 
   - Copy the API key
   - Paste it in WordPress plugin settings
   - Test connection

---

## 🔑 **How API Keys Work**

### **Format**
- API keys start with `alt_` prefix
- Example: `alt_abc123xyz...`
- 64 characters total length

### **Generation**
- Automatically generated when user first accesses dashboard
- Stored securely in `api_keys` table
- One active key per user (by default)

### **Validation**
- WordPress plugin sends API key in `Authorization: Bearer alt_...` header
- Backend validates key against database
- Returns user info if valid

---

## 🛠️ **Troubleshooting**

### **API Key Not Showing**
- Check Netlify function logs: https://app.netlify.com/projects/alt-text-ai/logs/functions
- Look for `get-api-key` function errors
- Verify database migration was applied

### **"Invalid API Key" in WordPress**
- Verify API key starts with `alt_`
- Check `api_keys` table in Supabase - is the key there?
- Check function logs for validation errors

### **Migration Errors**
- Make sure you have permission to create tables
- Check if `api_keys` table already exists
- Verify foreign key constraints match your `profiles` table structure

---

## 📝 **Files Created/Modified**

### **New Files:**
- `supabase-migration/create-api-keys-table.sql` - Database migration
- `netlify-functions/get-api-key.js` - API key generation endpoint
- `API_KEY_SYSTEM_SETUP.md` - This guide

### **Modified Files:**
- `netlify-functions/auth-validate.js` - Now validates API keys
- `frontend/src/App.js` - Dashboard shows API keys

---

## ✅ **Next Steps**

1. **Apply the migration** (Step 1 above)
2. **Test with your account** 
3. **Update documentation** for users explaining how to get their API key
4. **Consider adding**: API key regeneration, multiple keys, key expiration dates

---

## 🎉 **Benefits**

Your SaaS now has:
- ✅ Proper API key system for production use
- ✅ Secure, persistent authentication for WordPress plugin
- ✅ Scalable solution for multiple users
- ✅ Better user experience with clear API key display

**Once the migration is applied, each user will have their own unique, persistent API key!** 🚀

