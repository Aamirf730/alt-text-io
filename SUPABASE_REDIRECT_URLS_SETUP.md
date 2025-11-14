# 📋 Supabase Redirect URLs Configuration Guide

## 🔗 Direct Link to Configuration Page

**Direct Link:** https://supabase.com/dashboard/project/qurbdtzrngzfzevgoolp/auth/url-configuration

---

## ✅ Step-by-Step Instructions

### Step 1: Open Supabase Dashboard

1. Go to: https://supabase.com/dashboard
2. Select your project: **ALT-Text-Ai** (or click the link above)

### Step 2: Navigate to URL Configuration

1. In the left sidebar, click **Authentication**
2. Click **URL Configuration** (under Authentication menu)

### Step 3: Set Site URL

In the **Site URL** field, enter:
```
https://www.alt-text.pro
```

Click **Save** if there's a save button for Site URL.

### Step 4: Add Redirect URLs

In the **Redirect URLs** section, click **Add URL** and add each of these **one by one**:

```
http://localhost:3000/**
```

```
https://www.alt-text.pro/**
```

```
http://localhost:3000/dashboard
```

```
https://www.alt-text.pro/dashboard
```

**Important Notes:**
- Use wildcard `**` to match all paths under that domain
- Add each URL separately (one per line or one per "Add URL" click)
- Make sure there are no trailing slashes unless needed
- The `**` wildcard covers all paths, so you technically only need 2 URLs, but having specific ones is fine too

### Step 5: Save Changes

Click **Save** or the checkmark button to save all changes.

---

## ✅ Minimal Required URLs

If you want to keep it simple, you only need **3 URLs**:

1. `http://localhost:8888/**` (for Netlify Dev - recommended)
2. `http://localhost:3000/**` (for React dev server standalone)
3. `https://www.alt-text.pro/**` (for production)

The `**` wildcard will match:
- `http://localhost:8888/dashboard` (Netlify Dev)
- `http://localhost:3000/dashboard` (React dev server)
- `https://www.alt-text.pro/dashboard` (Production)
- Any other paths on those domains

**Note**: When using `npm run dev` (Netlify Dev), the app runs on port **8888**, not 3000.

---

## 🧪 After Adding URLs

1. **Test Localhost:**
   - Run: `cd frontend && yarn start`
   - Go to: http://localhost:3000
   - Try signing up or logging in
   - Should redirect to `/dashboard` after auth

2. **Test Production:**
   - Go to: https://www.alt-text.pro
   - Try signing up or logging in
   - Should redirect to `/dashboard` after auth

---

## ⚠️ Common Issues

### Issue: "Redirect URL not allowed"
- **Solution**: Make sure you added the exact URL pattern
- Check for typos (http vs https, localhost vs 127.0.0.1)
- Make sure you saved the changes

### Issue: "Redirect works but shows error"
- **Solution**: Check browser console for errors
- Verify environment variables are set in Netlify

### Issue: "Works on localhost but not production"
- **Solution**: 
  - Make sure you added the production URL
  - Check Netlify environment variables are set
  - Verify Site URL is set to production URL

---

## 📸 What You Should See

After configuration, your Supabase URL Configuration page should show:

**Site URL:**
```
https://www.alt-text.pro
```

**Redirect URLs:**
```
http://localhost:8888/**
http://localhost:3000/**
https://www.alt-text.pro/**
```

---

## ✅ Verification Checklist

- [ ] Site URL set to: `https://www.alt-text.pro`
- [ ] Redirect URL added: `http://localhost:3000/**`
- [ ] Redirect URL added: `https://www.alt-text.pro/**`
- [ ] Changes saved
- [ ] Tested signup on localhost
- [ ] Tested signup on production

---

## 🚀 Quick Reference

**Project ID:** qurbdtzrngzfzevgoolp  
**Project URL:** https://qurbdtzrngzfzevgoolp.supabase.co  
**Production Site:** https://www.alt-text.pro  
**Local Development (Netlify Dev):** http://localhost:8888  
**Local Development (React only):** http://localhost:3000

