# Local Development Setup

This guide will help you set up local development with all Netlify functions running locally, completely isolated from production.

## Prerequisites

1. **Node.js 18** (required by Netlify)
2. **Netlify CLI** - Will be installed automatically via npm
3. **Environment variables** - Copy from Netlify dashboard or use your own test values

## Quick Start

### 1. Install Dependencies

```bash
# Install root dependencies (includes Netlify CLI)
npm install

# Install Netlify functions dependencies
cd netlify-functions && npm install && cd ..

# Install frontend dependencies
cd frontend && yarn install --ignore-engines --frozen-lockfile --production=false && cd ..
```

Or use the convenience script:
```bash
npm run install:all
```

### 2. Set Up Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
# ============================================
# Supabase Configuration
# ============================================
# Get these from your Supabase project dashboard: https://app.supabase.com
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_ANON_KEY=your_anon_key_here

# Frontend Supabase (React App)
# These are prefixed with REACT_APP_ so they're available in the browser
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_anon_key_here

# ============================================
# PayPal Configuration (SANDBOX for local dev)
# ============================================
# Get sandbox credentials from: https://developer.paypal.com/dashboard/applications/sandbox
PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_paypal_sandbox_client_secret
PAYPAL_ENVIRONMENT=sandbox

# PayPal Plan IDs (optional - can be created automatically if PAYPAL_PRODUCT_ID is set)
# Get these from PayPal Dashboard after creating plans in SANDBOX mode
PAYPAL_PLAN_TIER1=your_tier1_plan_id
PAYPAL_PLAN_TIER2=your_tier2_plan_id
PAYPAL_PLAN_TIER3=your_tier3_plan_id

# PayPal Product ID (required if plans don't exist)
# Create a product in PayPal Dashboard SANDBOX first, then use its ID here
PAYPAL_PRODUCT_ID=your_paypal_product_id

# Frontend PayPal Client ID (for PayPal SDK)
REACT_APP_PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id

# ============================================
# Gemini AI Configuration
# ============================================
# Get your API key from: https://makersuite.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key

# ============================================
# Email Configuration (for contact form)
# ============================================
# For Gmail, you'll need an App Password: https://support.google.com/accounts/answer/185833
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_SERVICE=gmail

# ============================================
# Admin/Superuser Configuration (optional)
# ============================================
# Comma-separated list of superuser emails
SUPERUSER_EMAILS=your-admin@email.com
```

**Important:** 
- The `.env` file is gitignored and will NOT affect production
- **ALWAYS use SANDBOX PayPal credentials for local development** - this prevents accidental charges
- You can use the same Supabase project or a separate test project
- The frontend will automatically detect localhost and use local Netlify functions

### 3. Start Local Development Server

Run Netlify Dev which will:
- Start the frontend React app (usually on port 8888)
- Run all Netlify functions locally
- Proxy API requests to local functions

```bash
npm run dev
```

Or use the convenience script:
```bash
./start-dev.sh
```

This will start:
- **Frontend**: `http://localhost:8888`
- **Functions**: Available at `http://localhost:8888/.netlify/functions/*`

**Note:** The first time you run this, it may take a minute or two to:
1. Install dependencies (if not already installed)
2. Start the React dev server
3. Load all Netlify functions

You'll see output in your terminal showing the progress. Wait until you see:
```
⬥ Server now ready on http://localhost:8888
```

### 4. Access Your Local App

Open your browser to:
```
http://localhost:8888
```

All API calls will automatically route to your local Netlify functions, completely isolated from production.

**✅ Your local setup is now ready!** The frontend automatically detects localhost and uses:
- Local Netlify functions at `http://localhost:8888/.netlify/functions`
- PayPal sandbox environment (no real charges)
- Your local `.env` file (doesn't affect production)

## Available Scripts

- `npm run dev` - Start Netlify Dev (frontend + functions)
- `npm run dev:functions` - Start Netlify Dev with live reload
- `npm run dev:frontend` - Start only the React frontend (standalone, will use production API)
- `npm run install:all` - Install all dependencies (functions + frontend)

## How It Works

### Netlify Dev

When you run `netlify dev`, it:
1. Reads your `netlify.toml` configuration
2. Starts a local server (default port 8888)
3. Serves your frontend from `frontend/build` or runs the build command
4. Runs all functions from `netlify-functions/` locally
5. Automatically proxies `/api/*` and `/.netlify/functions/*` to local functions

### Environment Variables

- **Local `.env` file**: Used by Netlify Dev for functions
- **Frontend environment**: Uses `REACT_APP_*` variables from `.env`
- **Production**: Uses variables from Netlify Dashboard (not affected by local `.env`)

### Isolation from Production

✅ **Completely isolated:**
- Local functions run on your machine
- Uses your local `.env` file (gitignored)
- No connection to production Netlify functions
- No impact on production database (unless you use the same Supabase project)

⚠️ **If using same Supabase project:**
- Your local development will use the same database
- Consider using a separate Supabase project for testing
- Or use Supabase's local development features

## Troubleshooting

### Port Already in Use

If port 8888 is already in use:
```bash
netlify dev --port 3000
```

### Functions Not Loading

1. Check that `netlify-functions/` has all dependencies installed:
   ```bash
   cd netlify-functions && npm install
   ```

2. Verify environment variables are set:
   ```bash
   netlify dev --debug
   ```

### Frontend Not Connecting to Functions

The frontend code **automatically detects localhost** and uses the correct API base (`http://localhost:8888/.netlify/functions`). 

If you need to override (not usually necessary):
```bash
# In .env file
REACT_APP_API_BASE=http://localhost:8888/.netlify/functions
```

**Note**: The frontend has been updated to automatically use localhost functions when running locally. You should NOT need to set `REACT_APP_API_BASE` manually.

### Netlify CLI Not Found

The Netlify CLI should be installed automatically when you run `npm install`. If you get an error:

```bash
# Install dependencies (includes Netlify CLI)
npm install

# Or install globally
npm install -g netlify-cli

# Or use npx
npx netlify dev
```

### Server Not Starting

If the server doesn't start:

1. **Check if dependencies are installed:**
   ```bash
   npm install
   cd netlify-functions && npm install
   ```

2. **Check if ports are available:**
   ```bash
   # Check what's using port 8888
   lsof -i :8888
   
   # Kill any process using the port
   kill -9 $(lsof -ti:8888)
   ```

3. **Run with debug output:**
   ```bash
   netlify dev --debug
   ```

4. **Check for environment variable issues:**
   - Make sure your `.env` file exists in the root directory
   - Verify all required variables are set

## Testing PayPal Payments Locally

### Important Notes for PayPal Testing

1. **Use PayPal Sandbox**: Your `.env` file should have `PAYPAL_ENVIRONMENT=sandbox`
2. **Sandbox Test Accounts**: Create test accounts at https://developer.paypal.com/dashboard/accounts
   - Use a personal sandbox account to test payments
   - Use a business sandbox account to receive payments
3. **Return URLs**: PayPal will redirect back to `http://localhost:8888/payment-success` after payment
4. **No Real Charges**: All payments in sandbox are simulated - no real money is charged

### Testing Payment Flow

1. **Start the local server**: `npm run dev`
2. **Open**: `http://localhost:8888`
3. **Sign up/Login**: Create an account or log in
4. **Select a Plan**: Choose a paid plan (Tier 1, 2, or 3)
5. **PayPal Checkout**: Click the PayPal button
6. **Sandbox Login**: Use your PayPal sandbox test account credentials
7. **Complete Payment**: Approve the payment in PayPal sandbox
8. **Return to App**: You'll be redirected back to `http://localhost:8888/payment-success`

### Troubleshooting PayPal Issues

**PayPal button not showing:**
- Check that `REACT_APP_PAYPAL_CLIENT_ID` is set in your `.env` file
- Verify the client ID is from PayPal **Sandbox** (not production)
- Check browser console for errors

**Payment creation fails:**
- Check Netlify Dev terminal for function logs
- Verify `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` are set
- Ensure `PAYPAL_ENVIRONMENT=sandbox` is set
- Check that PayPal plans exist or `PAYPAL_PRODUCT_ID` is set

**Return URL issues:**
- The app automatically detects localhost and uses the correct return URL
- If you see production URLs, check that you're accessing `http://localhost:8888` (not a different port)

## Testing Functions Locally

You can test functions directly:

```bash
# Test generate-alt-text function
curl -X POST http://localhost:8888/.netlify/functions/generate-alt-text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"image_base64": "test", "context": ""}'

# Test get-usage function
curl http://localhost:8888/.netlify/functions/get-usage \
  -H "Authorization: Bearer YOUR_API_KEY"

# Test create-payment function (requires auth token)
curl -X POST http://localhost:8888/.netlify/functions/create-payment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -d '{"planId": "tier1"}'
```

## Production Deployment

When you're ready to deploy:
1. Your local `.env` file is NOT used in production
2. Production uses environment variables from Netlify Dashboard
3. Deploy with: `netlify deploy --prod` or push to your connected Git branch

## Additional Resources

- [Netlify Dev Documentation](https://docs.netlify.com/cli/get-started/#run-a-local-development-environment)
- [Netlify Functions Documentation](https://docs.netlify.com/functions/overview/)
- [Environment Variables Guide](https://docs.netlify.com/environment-variables/overview/)

