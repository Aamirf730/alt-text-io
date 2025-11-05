# Netlify Deployment Guide

## Quick Deploy Steps

### 1. Environment Variables Required in Netlify Dashboard

After deploying, set these in **Netlify Dashboard → Site Settings → Environment Variables**:

```
REACT_APP_SUPABASE_URL=https://qurbdtzrngzfzevgoolp.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1cmJkdHpybmd6Znpldmdvb2xwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwMjIyNjcsImV4cCI6MjA3MTU5ODI2N30.CIZIlQ03Cx44Su6Qh45MyJ51ri1jeBpUSpWgJjI1fJU
SUPABASE_URL=https://qurbdtzrngzfzevgoolp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<GET_FROM_SUPABASE_DASHBOARD>
GEMINI_API_KEY=<YOUR_GEMINI_API_KEY>
```

### 2. Deploy via Netlify CLI

```bash
# Initialize and deploy
netlify init
netlify deploy --prod
```

### 3. Or Deploy via Git (Recommended)

1. Push your code to GitHub
2. Connect your repo to Netlify
3. Set environment variables in Netlify Dashboard
4. Netlify will auto-deploy on every push

## Build Settings (Already Configured)

- **Build command**: `cd frontend && yarn build`
- **Publish directory**: `frontend/build`
- **Functions directory**: `netlify-functions`

## Post-Deployment Checklist

- [ ] Set all environment variables
- [ ] Test signup/login
- [ ] Test alt-text generation
- [ ] Configure custom domain (optional)
- [ ] Set up Google OAuth redirect URL in Supabase

