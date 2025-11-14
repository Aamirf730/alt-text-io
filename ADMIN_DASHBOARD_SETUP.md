# Admin Dashboard Setup Guide

## Overview

The admin dashboard allows superusers to view and manage all users, their credits, subscription plans, payments, and usage statistics.

## Access

The admin dashboard is available at: `/admin`

## Setup

### 1. Configure Superuser Emails

To access the admin dashboard, you need to set the `SUPERUSER_EMAILS` environment variable in your Netlify environment variables.

**In Netlify Dashboard:**
1. Go to Site settings → Environment variables
2. Add a new variable:
   - **Key:** `SUPERUSER_EMAILS`
   - **Value:** `help@wpgeared.com` (or comma-separated list for multiple: `help@wpgeared.com,admin@example.com`)

**For Local Development:**
Add to your `.env` file or Netlify CLI:
```bash
SUPERUSER_EMAILS=help@wpgeared.com
```

**Current Superuser:**
- `help@wpgeared.com`

### 2. Deploy the Netlify Function

The admin function (`admin-get-users.js`) needs to be deployed to Netlify. It will automatically be available at:
- Production: `/.netlify/functions/admin-get-users`
- Local: `http://localhost:8888/.netlify/functions/admin-get-users`

## Features

### Statistics Overview
- **Total Users:** Count of all registered users
- **Total Revenue:** Sum of all completed payments
- **Active Users:** Users with active subscription status
- **Total Credits Used:** Sum of all credits used across all users

### User Management
- **Search:** Search users by email or user ID
- **Filter by Plan:** Filter users by subscription plan (free, tier1, tier2, tier3, pay_as_go)
- **Filter by Status:** Filter users by subscription status (active, cancelled, expired, pending)

### User Details
Each user entry shows:
- Email address
- User ID
- Subscription plan
- Subscription status
- Credits remaining
- Total credits used
- Total images processed
- Total amount paid
- Payment count
- Account creation date

### Detailed User View
Click "View Details" on any user to see:
- Full user information
- Latest payment details
- Next billing date (if applicable)
- Expiration date (if applicable)
- Subscription ID
- All timestamps

## Security

- Only users with emails listed in `SUPERUSER_EMAILS` can access the admin dashboard
- The dashboard requires authentication (users must be logged in)
- The Netlify function validates the user's email against the superuser list
- All database queries use the service role key for proper access

## Usage

1. **Login:** First, log in to the main website with a superuser email
2. **Navigate:** Go to `/admin` in your browser
3. **View Users:** The dashboard will automatically load all users
4. **Filter/Search:** Use the filters and search to find specific users
5. **View Details:** Click "View Details" on any user to see comprehensive information
6. **Refresh:** Click the "Refresh" button to reload user data

## Notes

- The admin dashboard does not affect the main website functionality
- It's a read-only dashboard (no editing capabilities currently)
- All data is fetched in real-time from the Supabase database
- The dashboard is completely separate from the regular user dashboard

