# Superuser Configuration

## Current Superuser

**Email:** `help@wpgeared.com`

## Setup Instructions

To enable superuser access for `help@wpgeared.com`, you need to set the `SUPERUSER_EMAILS` environment variable in Netlify.

### Steps:

1. **Go to Netlify Dashboard**
   - Navigate to your site
   - Go to **Site settings** → **Environment variables**

2. **Add Environment Variable**
   - Click **Add variable**
   - **Key:** `SUPERUSER_EMAILS`
   - **Value:** `help@wpgeared.com`
   - **Scopes:** Select "All scopes" (or specific scopes as needed)
   - Click **Save**

3. **Redeploy (if needed)**
   - After adding the environment variable, you may need to trigger a new deployment
   - Or wait for the next automatic deployment

### Verification

After setting up:
1. Log in to the website with `help@wpgeared.com`
2. Navigate to `/admin`
3. You should see the admin dashboard with all users

### Adding More Superusers

To add multiple superusers, use a comma-separated list:
```
help@wpgeared.com,admin@example.com,another@example.com
```

## Important Notes

- The environment variable must be set in Netlify for production
- For local development, set it in your `.env` file or Netlify CLI
- Changes to environment variables require a redeploy to take effect
- Only users with emails in `SUPERUSER_EMAILS` can access `/admin`

