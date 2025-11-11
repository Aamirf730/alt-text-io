# Reset Test User Instructions

## Option 1: Using Netlify CLI (Recommended)

If you have Netlify CLI installed and linked to your site:

```bash
cd netlify-functions
netlify functions:invoke reset-test-user --no-identity
```

## Option 2: Manual Script Execution

1. **Get your Supabase credentials:**
   - Go to your Supabase project dashboard
   - Go to Settings → API
   - Copy your `Project URL` (SUPABASE_URL)
   - Copy your `service_role` key (SUPABASE_SERVICE_ROLE_KEY) - this is secret!

2. **Run the script with environment variables:**

```bash
cd netlify-functions
SUPABASE_URL="your-project-url" SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" node reset-test-user.js
```

## Option 3: Create .env file (Local Development)

Create a `.env` file in the `netlify-functions` directory:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

Then install dotenv and run:
```bash
npm install dotenv
node reset-test-user.js
```

## What the Script Does

1. ✅ Finds user "aamirf730@gmail.com" in auth.users
2. ✅ Shows current state (credits, usage, etc.)
3. ✅ Deletes all usage logs for the user
4. ✅ Resets credits to 100 (free plan)
5. ✅ Resets total_processed to 0
6. ✅ Resets subscription to 'free' plan
7. ✅ Verifies user isolation (ensures data is separate)

## Verification

After running, the script will:
- Show the reset user's new state
- List other users in the database
- Verify that each user's data is isolated
- Confirm credits and usage logs are separate

