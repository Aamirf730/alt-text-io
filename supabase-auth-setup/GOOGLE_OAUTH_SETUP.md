# 🔐 Google OAuth Setup for Alt-Text AI SaaS (Supabase)

## 📋 Complete Setup Guide

This guide will help you set up **Google OAuth** authentication for your Alt-Text AI SaaS using Supabase.

---

## 🚀 Step 1: Google Cloud Console Setup

### 1.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"Select a project"** → **"NEW PROJECT"**
3. Enter project name: **"Alt-Text AI SaaS"**
4. Click **"CREATE"**

### 1.2 Enable Google+ API

1. In your project, go to **"APIs & Services"** → **"Library"**
2. Search for **"Google+ API"**
3. Click on it and press **"ENABLE"**

### 1.3 Configure OAuth Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. Choose **"External"** user type → **"CREATE"**
3. Fill in the required information:

```
App name: Alt-Text AI
User support email: your-email@domain.com
Developer contact: your-email@domain.com
```

4. **Scopes**: Add these scopes:
   - `userinfo.email`
   - `userinfo.profile`
   - `openid`

5. **Test users** (for development):
   - Add your email and test user emails

6. Click **"SAVE AND CONTINUE"** through all steps

### 1.4 Create OAuth Credentials

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"** → **"OAuth 2.0 Client IDs"**
3. Choose **"Web application"**
4. Configure:

```
Name: Alt-Text AI Web Client

Authorized JavaScript origins:
- https://your-supabase-project.supabase.co
- https://your-domain.netlify.app
- http://localhost:3000 (for development)

Authorized redirect URIs:
- https://your-supabase-project.supabase.co/auth/v1/callback
```

5. Click **"CREATE"**
6. **Save** the `Client ID` and `Client Secret` - you'll need these!

---

## 🔧 Step 2: Supabase Configuration

### 2.1 Configure Google Provider

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your Alt-Text AI project
3. Go to **"Authentication"** → **"Providers"**
4. Find **"Google"** and click **"Enable"**

### 2.2 Add Google Credentials

In the Google provider settings, add:

```
Client ID: YOUR_GOOGLE_CLIENT_ID
Client Secret: YOUR_GOOGLE_CLIENT_SECRET
```

### 2.3 Configure Redirect URLs

In **"Authentication"** → **"URL Configuration"**:

```
Site URL: https://your-domain.netlify.app
Redirect URLs: 
- https://your-domain.netlify.app/dashboard
- http://localhost:3000/dashboard (for development)
```

### 2.4 Update RLS Policies (if needed)

The existing RLS policies should work, but verify they're active:

```sql
-- Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';
```

---

## ⚙️ Step 3: Frontend Configuration

### 3.1 Environment Variables

Update your `.env` file:

```bash
# Supabase Configuration
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key

# Google OAuth (optional, for custom config)
REACT_APP_GOOGLE_CLIENT_ID=your-google-client-id
```

### 3.2 Supabase Client Configuration

The client is already configured in the updated `App.js`:

```javascript
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Google sign-in
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/dashboard`,
    queryParams: {
      access_type: 'offline',
      prompt: 'consent',
    }
  }
});
```

---

## 🧪 Step 4: Testing the Integration

### 4.1 Test Email Authentication

1. Go to your app homepage
2. Click **"Start Free Trial"**
3. Enter email and password
4. Verify account creation works

### 4.2 Test Google Authentication

1. Click **"Continue with Google"**
2. Should redirect to Google login
3. After authentication, should redirect to dashboard
4. Verify user profile shows Google as provider

### 4.3 Test Dashboard Access

1. Verify user information displays correctly
2. Check that usage stats load
3. Test alt-text generation functionality
4. Confirm logout works

---

## 🔐 Step 5: Security Configuration

### 5.1 Email Templates (Optional)

In Supabase **"Authentication"** → **"Email Templates"**:

Customize the confirmation email:

```html
<h2>Welcome to Alt-Text AI!</h2>
<p>Thanks for signing up. Please confirm your email address:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your account</a></p>
```

### 5.2 Auth Settings

In **"Authentication"** → **"Settings"**:

```
Enable email confirmations: Yes (recommended)
Enable phone confirmations: No
Minimum password length: 6
```

### 5.3 Rate Limiting

Configure rate limiting for auth endpoints:

```
Max requests per hour: 100 (per IP)
Max requests per minute: 10 (per IP)
```

---

## 🚀 Step 6: Production Deployment

### 6.1 Update Netlify Environment Variables

In your Netlify dashboard, add/update:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Frontend
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key

# API
GEMINI_API_KEY=your-gemini-key
```

### 6.2 Update Google OAuth URLs

Once deployed, update your Google Cloud Console with production URLs:

```
Authorized JavaScript origins:
- https://your-domain.netlify.app
- https://your-supabase-project.supabase.co

Authorized redirect URIs:
- https://your-supabase-project.supabase.co/auth/v1/callback
```

### 6.3 Test Production

1. Test both email and Google authentication
2. Verify redirects work correctly
3. Check all dashboard functionality
4. Test with different user accounts

---

## 🐛 Step 7: Troubleshooting

### Common Issues & Solutions

#### Issue: "Invalid redirect URI"
**Solution:** 
- Check Google Cloud Console redirect URIs match exactly
- Ensure no trailing slashes
- Verify Supabase callback URL is correct

#### Issue: "Google sign-in button not working"
**Solution:**
```javascript
// Check if Supabase client is initialized
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key:', supabaseAnonKey ? 'Set' : 'Missing');

// Test auth state
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth event:', event, session);
});
```

#### Issue: "User not created in profiles table"
**Solution:** Check the trigger function:

```sql
-- Verify trigger exists
SELECT trigger_name, event_manipulation, event_object_table, action_statement 
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- If missing, recreate:
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

#### Issue: "CORS errors with Google OAuth"
**Solution:** In Supabase dashboard:
1. Go to **"Settings"** → **"API"**
2. Add your domains to CORS origins:
   ```
   https://your-domain.netlify.app
   http://localhost:3000
   ```

---

## 📊 Step 8: Monitoring & Analytics

### 8.1 Supabase Auth Analytics

Monitor authentication in Supabase:
- **"Authentication"** → **"Users"** - See all registered users
- Check user metadata for provider information
- Monitor sign-in patterns and methods

### 8.2 Google Analytics (Optional)

Track authentication events:

```javascript
// Add to your authentication functions
gtag('event', 'sign_up', {
  method: 'google'
});

gtag('event', 'login', {
  method: 'email'
});
```

---

## ✅ Final Checklist

Before going live, verify:

- [ ] Google Cloud Console project configured
- [ ] OAuth consent screen approved (if needed)
- [ ] Supabase Google provider enabled
- [ ] Environment variables set in Netlify
- [ ] Both email and Google auth working
- [ ] User profiles created automatically
- [ ] Dashboard loads user data correctly
- [ ] Alt-text generation works with both auth methods
- [ ] Logout functionality works
- [ ] Production URLs updated in Google Console
- [ ] Error handling for auth failures
- [ ] Loading states for auth buttons
- [ ] Email confirmation flow tested

---

## 🔄 User Experience Flow

### New User with Google:
1. Clicks **"Continue with Google"**
2. Redirected to Google OAuth
3. Approves permissions
4. Redirected to dashboard
5. Profile automatically created with 30 free credits

### New User with Email:
1. Enters email and password
2. Receives confirmation email
3. Clicks confirmation link
4. Redirected to dashboard
5. Profile created with 30 free credits

### Returning User:
1. Chooses sign-in method (email or Google)
2. Authenticates
3. Redirected to dashboard
4. Existing profile and credits loaded

---

## 🎉 Success!

Your Alt-Text AI SaaS now supports both email/password and Google OAuth authentication! Users can:

✅ **Sign up/in with email & password**  
✅ **Sign up/in with Google account**  
✅ **Seamless dashboard experience**  
✅ **Automatic profile creation**  
✅ **Secure authentication flow**  
✅ **Professional user experience**

**Your SaaS now provides multiple convenient authentication options for better user adoption!** 🚀