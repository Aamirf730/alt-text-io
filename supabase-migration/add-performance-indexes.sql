-- ============================================================================
-- Database Performance Indexes Migration
-- File: supabase-migration/add-performance-indexes.sql
--
-- Adds indexes to frequently queried columns to prevent performance
-- degradation as the user base grows.
--
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
--
-- Tables affected: profiles, usage_logs, payments
-- Note: api_keys table already has indexes (from create-api-keys-table.sql)
--
-- Safe to run multiple times (IF NOT EXISTS).
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- PROFILES TABLE
-- ────────────────────────────────────────────────────────────────────────────

-- Fast user lookup by email (used in admin-get-users, delete-users)
CREATE INDEX IF NOT EXISTS idx_profiles_email
  ON public.profiles(email);

-- Filter by subscription plan (used in admin dashboards, plan analytics)
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_plan
  ON public.profiles(subscription_plan);

-- Filter by subscription status (used in renewal checks, admin queries)
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status
  ON public.profiles(subscription_status)
  WHERE subscription_status != 'active';  -- partial index: non-active are rare but important

-- Renewal date lookups (used in monthly credit drip, subscription management)
CREATE INDEX IF NOT EXISTS idx_profiles_next_billing_date
  ON public.profiles(next_billing_date)
  WHERE next_billing_date IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- USAGE_LOGS TABLE
-- ────────────────────────────────────────────────────────────────────────────

-- User usage history with date ordering (used in get-usage, dashboard)
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id_created_at
  ON public.usage_logs(user_id, created_at DESC);

-- Date-range queries for analytics (admin usage reports)
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at
  ON public.usage_logs(created_at DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- PAYMENTS TABLE
-- ────────────────────────────────────────────────────────────────────────────

-- User payment history with date ordering (used in admin, billing)
CREATE INDEX IF NOT EXISTS idx_payments_user_id_created_at
  ON public.payments(user_id, created_at DESC);

-- Payment status lookups (pending/failed payments monitoring)
CREATE INDEX IF NOT EXISTS idx_payments_status
  ON public.payments(status)
  WHERE status IN ('pending', 'failed');  -- partial index: only non-completed matter

-- Subscription ID lookups (webhook processing from payment providers)
CREATE INDEX IF NOT EXISTS idx_payments_subscription_id
  ON public.payments(subscription_id)
  WHERE subscription_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- VERIFY
-- ────────────────────────────────────────────────────────────────────────────

-- List all indexes to verify (run separately after migration)
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE tablename IN ('profiles', 'usage_logs', 'payments', 'api_keys')
-- ORDER BY tablename, indexname;
