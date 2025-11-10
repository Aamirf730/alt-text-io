# Contact Form Setup Guide

## ✅ What's Been Created

1. **Contact Page** (`/contact`) - A beautiful, responsive contact form page
2. **Email Function** - Netlify function that sends emails to `aamirf730@gmail.com`
3. **Navigation Links** - Updated navigation to include Contact page

## 🔧 Required Setup: Email Configuration

To make the contact form work, you need to configure email credentials in Netlify.

### Step 1: Get Gmail App Password (Recommended)

1. Go to your Google Account: https://myaccount.google.com/
2. Navigate to **Security** → **2-Step Verification** (enable if not already)
3. Go to **App passwords**: https://myaccount.google.com/apppasswords
4. Select **Mail** and **Other (Custom name)**
5. Enter "Alt Text Pro Contact Form"
6. Click **Generate**
7. Copy the 16-character password (you'll use this as `EMAIL_PASSWORD`)

### Step 2: Add Environment Variables in Netlify

1. Go to Netlify Dashboard: https://app.netlify.com/projects/alt-text-ai
2. Navigate to **Site settings** → **Environment variables**
3. Add these variables:

```
EMAIL_USER = help@wpgeared.com
EMAIL_PASSWORD = ydppmcqpmapxiju
EMAIL_SERVICE = gmail
```

**Important Notes:**
- `EMAIL_USER` is set to `help@wpgeared.com` (the sender email)
- `EMAIL_PASSWORD` is the Gmail App Password for `help@wpgeared.com`
- The email will be sent FROM `help@wpgeared.com` TO `aamirf730@gmail.com`
- Make sure `help@wpgeared.com` has 2-Step Verification enabled and you've generated an App Password

### Step 3: Alternative Email Services

If you prefer not to use Gmail, you can use other services:

#### Option A: SendGrid (Free tier: 100 emails/day)
```
EMAIL_SERVICE = sendgrid
EMAIL_USER = apikey
EMAIL_PASSWORD = your-sendgrid-api-key
```

#### Option B: Mailgun (Free tier: 5,000 emails/month)
```
EMAIL_SERVICE = mailgun
EMAIL_USER = your-mailgun-smtp-username
EMAIL_PASSWORD = your-mailgun-smtp-password
```

#### Option C: Custom SMTP
Update `netlify-functions/send-contact-email.js` to use custom SMTP settings.

### Step 4: Redeploy

After adding environment variables:
1. Go to **Deploys** in Netlify
2. Click **Trigger deploy** → **Deploy site**

## 🧪 Testing

1. Visit: https://www.alt-text.pro/contact
2. Fill out the form
3. Submit
4. Check `aamirf730@gmail.com` for the email

## 📧 Email Format

Emails will include:
- Sender's name and email
- Subject (if provided)
- Message content
- Reply-to set to sender's email (so you can reply directly)

## 🔒 Security

- Form validation on both client and server
- Email format validation
- Required fields enforced
- Error handling for failed sends

## 🎨 Features

- ✅ Responsive design
- ✅ Loading states
- ✅ Success/error notifications
- ✅ Form validation
- ✅ Accessible form labels
- ✅ Matches site branding (teal color scheme)

