# Email Confirmation Troubleshooting Guide

## 🚨 Issue: Not Receiving Confirmation Email

If you didn't receive the confirmation email, here are the steps to fix it:

## ✅ Quick Fix: Manual Confirmation (Fastest Solution)

### Option 1: Confirm via Supabase Dashboard

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/qurbdtzrngzfzevgoolp)
2. Navigate to **Authentication** → **Users**
3. Find your email address in the list
4. Click on the user
5. Click the **"Confirm User"** button (or toggle the "Email Confirmed" switch)
6. The user can now sign in immediately

### Option 2: Resend Confirmation Email

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/qurbdtzrngzfzevgoolp)
2. Navigate to **Authentication** → **Users**
3. Find your email address
4. Click on the user
5. Click **"Resend Confirmation Email"** (if available)
6. Check your email (and spam folder)

---

## 🔍 Check Email Settings in Supabase

### Step 1: Verify Email Confirmation is Enabled

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/qurbdtzrngzfzevgoolp)
2. Navigate to **Authentication** → **Settings**
3. Scroll to **"Email Auth"** section
4. Make sure **"Enable email confirmations"** is checked ✅
5. If it's unchecked, check it and save

### Step 2: Check Email Templates

1. Go to **Authentication** → **Email Templates**
2. Click on **"Confirm signup"** template
3. Make sure it includes: `{{ .ConfirmationURL }}`
4. If missing, add it to the template

### Step 3: Verify Site URL Configuration

1. Go to **Authentication** → **URL Configuration**
2. Check **Site URL** is set to: `https://www.alt-text.pro`
3. Check **Redirect URLs** include:
   - `https://www.alt-text.pro/**`
   - `https://www.alt-text.pro/email-confirmed`

---

## 📧 Check Email Delivery

### Common Reasons Emails Don't Arrive:

1. **Spam Folder**
   - Check your spam/junk folder
   - Mark as "Not Spam" if found
   - Add `noreply@mail.app.supabase.io` to your contacts

2. **Email Provider Filtering**
   - Some providers (Gmail, Outlook) filter Supabase emails
   - Try with a different email provider
   - Check email provider's security settings

3. **Email Address Typo**
   - Double-check the email address you used
   - Make sure there are no typos

4. **Supabase Email Limits**
   - Free tier has email sending limits
   - Check if you've exceeded the limit
   - Upgrade plan if needed

---

## 🔧 Alternative: Disable Email Confirmation (For Testing)

If you just want to test the app without email verification:

1. Go to **Authentication** → **Settings**
2. Under **"Email Auth"**, uncheck **"Enable email confirmations"**
3. Click **Save**
4. Try signing up again - you'll be automatically logged in

⚠️ **Note:** This is NOT recommended for production. Only use for testing.

---

## 🚀 Use Custom SMTP (For Production)

If you need reliable email delivery, configure custom SMTP:

1. Go to **Settings** → **Auth** → **SMTP Settings**
2. Configure with your email provider:
   - **Gmail**: Use App Password
   - **SendGrid**: Use API key
   - **AWS SES**: Use AWS credentials
   - **Mailgun**: Use SMTP credentials

3. Test email delivery
4. Save settings

---

## ✅ After Fixing

1. **Try signing up again** with the same email (or a new one)
2. **Check your email** (including spam folder)
3. **Click the confirmation link** in the email
4. **Sign in** to your account

---

## 🆘 Still Not Working?

If emails still don't arrive:

1. **Manually confirm the user** in Supabase Dashboard (fastest solution)
2. **Check Supabase status**: https://status.supabase.com
3. **Check Supabase logs**: Go to **Logs** → **Auth Logs** to see if emails were sent
4. **Contact Supabase support** if the issue persists

---

## 📋 Quick Checklist

- [ ] Checked spam folder
- [ ] Email confirmation enabled in Supabase
- [ ] Site URL configured correctly
- [ ] Redirect URLs include your domain
- [ ] Email address is correct (no typos)
- [ ] Tried with a different email provider
- [ ] Manually confirmed user in Supabase Dashboard
- [ ] Checked Supabase auth logs

