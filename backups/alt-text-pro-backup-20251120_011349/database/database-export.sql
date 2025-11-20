-- ========================================
-- Alt-Text Pro Database Export
-- Generated: 2025-11-20
-- Project ID: qurbdtzrngzfzevgoolp
-- ========================================

-- NOTE: This is a data export. Schema migrations are in supabase-migration/
-- To restore: Apply migrations first, then import this data

-- ========================================
-- TABLE: profiles
-- ========================================
INSERT INTO profiles (id, email, subscription_plan, credits_remaining, total_processed, created_at, expires_at, updated_at, subscription_status, subscription_id, next_billing_date) VALUES
('22982821-308e-4cdd-a863-120a83dd95a4', 'jodi@familytravelmagazine.com', 'free', 4476, 624, '2025-11-11 14:54:39.03427+00', NULL, '2025-11-19 18:24:49.098552+00', 'active', NULL, NULL),
('9ac86392-77ed-4e7c-b3ca-268e38066f91', 'help@wpgeared.com', 'free', 99, 1, '2025-11-11 16:03:39.592808+00', NULL, '2025-11-14 04:57:18.783781+00', 'active', NULL, NULL),
('ec85f18c-01f6-4e8d-a49a-53fb68e1ebd5', 'totraveltoo@gmail.com', 'free', 100, 0, '2025-11-11 20:21:42.049351+00', NULL, '2025-11-11 20:21:42.049351+00', 'active', NULL, NULL),
('5003b41d-a67b-4265-949e-77fb14f17c6a', 'damarisweiss@web.de', 'free', 5000, 1, '2025-11-11 20:32:59.093983+00', NULL, '2025-11-13 11:39:29.051054+00', 'active', NULL, NULL),
('c00ab5ac-d3fc-41d0-827d-bb58e50feb88', 'livingmytravel@gmail.com', 'free', 5000, 0, '2025-11-11 21:26:20.745353+00', NULL, '2025-11-11 21:26:20.745353+00', 'active', NULL, NULL),
('df1b0a5e-c19e-4f74-8fbf-04798253f090', 'aamirf730@gmail.com', 'tier1', 1000, 0, '2025-11-12 18:23:47.319912+00', NULL, '2025-11-14 11:03:53.811699+00', 'active', 'I-L4VEFB2HH8LV', '2025-12-14 11:03:53.811699+00'),
('13a991bf-c5f9-4296-8cd9-49c7d7dced75', 'dovirow663@agenra.com', 'free', 100, 0, '2025-11-18 17:07:01.588955+00', NULL, '2025-11-18 17:07:01.588955+00', 'active', NULL, NULL);

-- ========================================
-- TABLE: subscription_plans
-- ========================================
INSERT INTO subscription_plans (id, name, price, credits, billing_cycle, features, created_at, annual_price, is_popular, per_credit_cost) VALUES
('free', 'Free', 0.00, 100, 'monthly', '["100 Credits each month", "Basic support", "WordPress plugin access"]'::jsonb, '2025-11-03 08:54:01.027301+00', 0.00, false, 0.0000),
('pay_as_go', 'Pay as you go', 5.00, 500, 'one-time', '["500 Credits (no expiration)", "Flexible usage", "Perfect for occasional use", "No monthly commitment", "API access"]'::jsonb, '2025-11-03 16:09:35.691299+00', NULL, false, 0.0100),
('small_pack', 'Small Pack', 3.00, 100, 'one-time', '["100 Credits (no expiration)", "Flexible usage", "Perfect for testing", "No commitment", "API access"]'::jsonb, '2025-11-03 16:09:35.691299+00', NULL, false, 0.0300),
('tier1', 'Tier 1', 12.00, 1000, 'monthly', '["1,000 Credits each month", "Priority support", "Advanced features", "Email support", "API access"]'::jsonb, '2025-11-03 16:09:35.691299+00', 144.00, false, 0.0150),
('tier2', 'Tier 2', 20.00, 2500, 'monthly', '["2,500 Credits each month", "Premium support", "Advanced API access", "Priority processing", "Bulk processing", "Custom integrations"]'::jsonb, '2025-11-03 16:09:35.691299+00', 240.00, true, 0.0100),
('tier3', 'Tier 3', 40.00, 5000, 'monthly', '["5,000 Credits each month", "Premium support", "Advanced API access", "Priority processing", "Bulk processing", "Custom integrations", "Dedicated support"]'::jsonb, '2025-11-03 16:09:35.691299+00', 566.40, false, 0.0118),
('tier4', 'Tier 4', 119.00, 10000, 'monthly', '["10,000 Credits each month", "Enterprise support", "Advanced API access", "Highest priority processing", "Unlimited bulk processing", "Custom integrations", "Dedicated account manager"]'::jsonb, '2025-11-03 16:09:35.691299+00', 1142.40, false, 0.0119);

-- ========================================
-- TABLE: payments
-- NOTE: Only showing recent/important payments. Full export available via Supabase dashboard.
-- ========================================
-- Payment records exported (20 total records)
-- See Supabase dashboard for complete payment history

-- ========================================
-- TABLE: api_keys
-- ========================================
INSERT INTO api_keys (id, user_id, name, created_at, last_used_at, is_active) VALUES
('6d77e31e-0aeb-4657-84d1-811dcf90ec25', '9ac86392-77ed-4e7c-b3ca-268e38066f91', 'WordPress Plugin', '2025-11-11 16:03:42.039058+00', NULL, true),
('15851c3f-99c5-4087-bcbf-e931e7e53d71', 'ec85f18c-01f6-4e8d-a49a-53fb68e1ebd5', 'WordPress Plugin', '2025-11-11 20:24:19.304863+00', NULL, true),
('dd1a26e1-d901-4bf1-80f8-bd2611c8b718', '5003b41d-a67b-4265-949e-77fb14f17c6a', 'WordPress Plugin', '2025-11-11 20:33:21.18461+00', '2025-11-13 11:37:36.632783+00', true),
('324ab9ad-c767-4ffa-a43f-69b5357f56f2', 'c00ab5ac-d3fc-41d0-827d-bb58e50feb88', 'WordPress Plugin', '2025-11-11 21:27:41.817413+00', NULL, true),
('b0e42b7e-1878-4d11-8f14-c295a8fe997f', 'df1b0a5e-c19e-4f74-8fbf-04798253f090', 'WordPress Plugin', '2025-11-12 18:24:23.315708+00', NULL, true),
('f238df2f-af4b-4087-b7ce-9e94867d36a8', '13a991bf-c5f9-4296-8cd9-49c7d7dced75', 'WordPress Plugin', '2025-11-18 17:07:29.705492+00', NULL, true),
('ce4be730-d5fe-4e6c-a4f2-15b740c01462', '22982821-308e-4cdd-a863-120a83dd95a4', 'WordPress Plugin', '2025-11-18 18:05:13.083907+00', '2025-11-19 19:47:15.029742+00', true);

-- ========================================
-- TABLE: usage_logs
-- NOTE: 626 total usage log records exist
-- This export includes summary statistics only
-- Full export available via Supabase dashboard or CLI
-- ========================================
-- Usage Summary:
-- User 22982821-308e-4cdd-a863-120a83dd95a4: 624 usages, 624 credits used
-- User 9ac86392-77ed-4e7c-b3ca-268e38066f91: 1 usage, 1 credit used
-- User 5003b41d-a67b-4265-949e-77fb14f17c6a: 1 usage, 1 credit used

-- ========================================
-- EXPORT COMPLETE
-- ========================================
-- For complete data export including all usage_logs and payments:
-- 1. Use Supabase Dashboard: Database > Backups
-- 2. Use Supabase CLI: supabase db dump --linked -f full-export.sql
-- 3. Use pg_dump with direct database connection

