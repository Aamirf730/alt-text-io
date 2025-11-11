# Testing Signup Flow - aamirf730@gmail.com

## 🧪 Test Checklist

### Step 1: Sign Up as New User
1. **Navigate to**: http://localhost:3000
2. **Click**: "Get Started" or "Sign Up" button
3. **Fill in form**:
   - Email: `aamirf730@gmail.com`
   - Password: (choose a secure password)
4. **Click**: "Sign Up" button
5. **Expected Result**:
   - ✅ Success message: "Account created! Please check your email..."
   - ✅ OR: Immediate redirect to dashboard (if email confirmation disabled)
   - ✅ Profile created with 100 free credits
   - ✅ Subscription plan set to 'free'

### Step 2: Email Confirmation (if required)
1. **Check email**: aamirf730@gmail.com
2. **Click**: Confirmation link in email
3. **Expected**: Redirected to dashboard

### Step 3: Dashboard Access
1. **Verify**:
   - ✅ User email displayed: aamirf730@gmail.com
   - ✅ Credits shown: 100 credits
   - ✅ Subscription: Free Plan
   - ✅ API Key visible and copyable

### Step 4: Generate Alt Text (Test Product)
1. **Upload an image**:
   - Click "Upload Image" or drag & drop
   - Select a test image
2. **Generate Alt Text**:
   - Click "Generate Alt Text"
   - Wait for processing
3. **Expected Result**:
   - ✅ Alt text generated successfully
   - ✅ Credits decremented (99 remaining)
   - ✅ Alt text displayed in text area
   - ✅ Copy button works

### Step 5: Test WordPress Plugin Integration
1. **Get API Key**:
   - Copy API key from dashboard
   - Note: This should be a Supabase session token
2. **WordPress Plugin Setup**:
   - Install plugin on your WordPress site
   - Go to: Alt Text Pro → Settings
   - Paste API key
   - Test connection
3. **Expected Result**:
   - ✅ Connection test successful
   - ✅ Usage statistics displayed
   - ✅ Credits shown correctly

### Step 6: Test Bulk Processing (if available)
1. **Upload multiple images**
2. **Use bulk processing feature**
3. **Verify**:
   - ✅ All images processed
   - ✅ Credits deducted correctly
   - ✅ Alt text generated for each

## 🔍 Debugging

### Check Browser Console
Open Developer Tools (F12) and check:
- ✅ No Supabase configuration warnings
- ✅ No authentication errors
- ✅ API calls successful (200 status)

### Check Network Tab
- ✅ Signup request: POST to Supabase auth
- ✅ Profile creation: INSERT to profiles table
- ✅ Generate alt text: POST to /generate-alt-text

### Common Issues

**Issue**: "Database error saving new user"
- **Fix**: Check Supabase trigger `handle_new_user()` is working
- **Verify**: Profile table has correct constraints

**Issue**: "Email not confirmed"
- **Fix**: Check Supabase email settings
- **Option**: Disable email confirmation in Supabase dashboard

**Issue**: "No credits remaining"
- **Fix**: Verify profile was created with `credits_remaining: 100`
- **Check**: Database trigger sets credits correctly

## 📝 Test Results

Fill in as you test:

- [ ] Signup successful
- [ ] Email confirmation received (if enabled)
- [ ] Dashboard loads correctly
- [ ] Credits displayed: 100
- [ ] API key generated
- [ ] Alt text generation works
- [ ] Credits decrement correctly
- [ ] WordPress plugin connection works
- [ ] Bulk processing works (if tested)

## 🚀 Next Steps After Testing

1. **If signup fails**: Check Supabase logs
2. **If credits not showing**: Verify database trigger
3. **If API key not working**: Check token format
4. **If WordPress plugin fails**: Verify API endpoint URLs

