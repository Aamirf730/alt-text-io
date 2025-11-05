# 🔐 Supabase Email Verification Setup Guide

## Issue: Not Receiving Email Verification Emails

If you're not receiving email verification emails from Supabase, follow these steps:

## ✅ Step 1: Verify Supabase Environment Variables

Make sure your Supabase credentials are properly set:

### For Local Development:
Create a `.env` file in the `frontend` directory:

```bash
REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
```

### For Production (Netlify):
1. Go to Netlify Dashboard → Your Site → Site Settings → Environment Variables
2. Add/Update:
   - `REACT_APP_SUPABASE_URL` = `https://your-project-id.supabase.co`
   - `REACT_APP_SUPABASE_ANON_KEY` = Your Supabase anon key

### Where to Find Your Supabase Credentials:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → Use as `REACT_APP_SUPABASE_URL`
   - **anon public** key → Use as `REACT_APP_SUPABASE_ANON_KEY`

---

## ✅ Step 2: Check Supabase Email Settings

### 2.1 Enable Email Confirmation (Recommended for Production)

1. Go to Supabase Dashboard → **Authentication** → **Settings**
2. Scroll to **"Email Auth"** section
3. Check **"Enable email confirmations"**
4. Configure:
   - **Confirm email**: ON (recommended for security)
   - **Secure email change**: ON
   - **Double confirm email changes**: OFF (for better UX)

### 2.2 Configure Email Templates

1. Go to **Authentication** → **Email Templates**
2. Click on **"Confirm signup"** template
3. Customize if needed (optional)
4. Make sure the template includes: `{{ .ConfirmationURL }}`

### 2.3 Configure Site URL

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL**:
   - Development: `http://localhost:3000`
   - Production: `https://www.alt-text.pro` (or your domain)
3. Add **Redirect URLs**:
   ```
   http://localhost:3000/dashboard
   https://www.alt-text.pro/dashboard
   https://www.alt-text.pro/**
   ```

---

## ✅ Step 3: For Development - Disable Email Confirmation (Optional)

If you want to skip email confirmation during development:

### Option A: Disable in Supabase Dashboard
1. Go to **Authentication** → **Settings**
2. Under **"Email Auth"**, uncheck **"Enable email confirmations"**
3. Save

### Option B: Use Supabase CLI
```bash
# Install Supabase CLI if not installed
npm install -g supabase

# Link your project
supabase link --project-ref your-project-ref

# Update auth settings (if supported)
```

---

## ✅ Step 4: Check Email Delivery

### 4.1 Check Supabase Email Logs

1. Go to **Authentication** → **Users**
2. Find the user who signed up
3. Check if email was sent (may show in logs)

### 4.2 Check Spam Folder

- Check your email's spam/junk folder
- Some email providers filter Supabase emails

### 4.3 Verify Email Address

- Make sure the email address is correct (no typos)
- Try with a different email provider (Gmail, Outlook, etc.)

---

## ✅ Step 5: Test Supabase Connection

Open your browser's developer console (F12) and check for:

1. **Supabase Configuration Logs**:
   ```
   🔧 Supabase Configuration:
     - URL: https://your-project.supabase.co
     - Anon Key: eyJhbGc... (should show)
   ```

2. **If you see "placeholder" values**:
   - Environment variables are NOT set correctly
   - Fix the environment variables (see Step 1)

3. **Check for errors**:
   - Look for any red error messages
   - Check Network tab for failed requests to Supabase

---

## ✅ Step 6: Alternative - Manual Email Confirmation

If emails still don't arrive, you can manually confirm users:

1. Go to Supabase Dashboard → **Authentication** → **Users**
2. Find the unconfirmed user
3. Click on the user
4. Click **"Confirm User"** button
5. User can now sign in

---

## ✅ Step 7: Use Custom SMTP (Advanced)

If you need reliable email delivery, configure custom SMTP:

1. Go to **Settings** → **Auth** → **SMTP Settings**
2. Configure with your email provider:
   - **Gmail**: Use App Password
   - **SendGrid**: Use API key
   - **AWS SES**: Use AWS credentials
   - **Other**: Check your provider's SMTP settings

3. Test email delivery
4. Save settings

---

## 🐛 Troubleshooting Checklist

- [ ] Environment variables set correctly
- [ ] Supabase URL is correct (not placeholder)
- [ ] Supabase anon key is correct (not placeholder)
- [ ] Email confirmation enabled in Supabase dashboard
- [ ] Site URL configured correctly
- [ ] Redirect URLs include your domain
- [ ] Checked spam folder
- [ ] Email address is correct
- [ ] No errors in browser console
- [ ] Supabase project is active (not paused)

---

## 📝 Quick Fix for Development

If you just want to test the app without email verification:

1. In Supabase Dashboard → **Authentication** → **Settings**
2. Disable **"Enable email confirmations"**
3. Save
4. Try signing up again - you'll be automatically logged in

---

## 🚀 After Fixing

1. **Restart your development server**:
   ```bash
   cd frontend
   yarn start
   ```

2. **Clear browser cache** and try signing up again

3. **Check console logs** for Supabase connection status

4. **Try with a different email** to test

---

## Need More Help?

- Supabase Docs: https://supabase.com/docs/guides/auth
- Supabase Discord: https://discord.supabase.com
- Check Supabase Status: https://status.supabase.com

