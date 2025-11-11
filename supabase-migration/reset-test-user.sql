-- Reset Test User Script for Supabase SQL Editor
-- Resets user "aamirf730@gmail.com" to fresh state
-- Also verifies user isolation in database

-- Step 1: Find the user ID
DO $$
DECLARE
    test_user_id UUID;
    test_email TEXT := 'aamirf730@gmail.com';
    usage_count INTEGER;
    payment_count INTEGER;
BEGIN
    -- Get user ID from auth.users
    SELECT id INTO test_user_id
    FROM auth.users
    WHERE email = test_email;
    
    IF test_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found: %', test_email;
    END IF;
    
    RAISE NOTICE 'Found user: % (ID: %)', test_email, test_user_id;
    
    -- Show current state
    RAISE NOTICE 'Current User State:';
    PERFORM * FROM profiles WHERE id = test_user_id;
    
    -- Count usage logs
    SELECT COUNT(*) INTO usage_count
    FROM usage_logs
    WHERE user_id = test_user_id;
    
    RAISE NOTICE 'Usage Logs: %', usage_count;
    
    -- Count payments
    SELECT COUNT(*) INTO payment_count
    FROM payments
    WHERE user_id = test_user_id;
    
    RAISE NOTICE 'Payments: %', payment_count;
    
    -- Delete usage logs
    DELETE FROM usage_logs
    WHERE user_id = test_user_id;
    
    RAISE NOTICE 'Deleted % usage logs', usage_count;
    
    -- Reset profile to fresh state
    UPDATE profiles
    SET
        credits_remaining = 100,
        total_processed = 0,
        subscription_plan = 'free',
        subscription_status = 'active',
        subscription_id = NULL,
        next_billing_date = NULL,
        expires_at = NULL,
        updated_at = NOW()
    WHERE id = test_user_id;
    
    RAISE NOTICE 'Reset profile to fresh state';
    
    -- Verify reset
    RAISE NOTICE 'New User State:';
    PERFORM * FROM profiles WHERE id = test_user_id;
    
END $$;

-- Step 2: Show current state of test user
SELECT 
    p.id,
    p.email,
    p.credits_remaining,
    p.total_processed,
    p.subscription_plan,
    p.subscription_status,
    p.updated_at,
    (SELECT COUNT(*) FROM usage_logs ul WHERE ul.user_id = p.id) as usage_logs_count,
    (SELECT COUNT(*) FROM payments pay WHERE pay.user_id = p.id) as payments_count
FROM profiles p
WHERE p.email = 'aamirf730@gmail.com';

-- Step 3: Verify user isolation - Show all users
SELECT 
    p.id,
    p.email,
    p.credits_remaining,
    p.total_processed,
    p.subscription_plan,
    (SELECT COUNT(*) FROM usage_logs ul WHERE ul.user_id = p.id) as usage_logs_count
FROM profiles p
ORDER BY p.created_at DESC
LIMIT 10;

-- Step 4: Verify user data isolation
-- Check that each user has separate usage logs
SELECT 
    ul.user_id,
    p.email,
    COUNT(*) as log_count,
    SUM(ul.credits_used) as total_credits_used
FROM usage_logs ul
JOIN profiles p ON ul.user_id = p.id
GROUP BY ul.user_id, p.email
ORDER BY log_count DESC;

-- Step 5: Verify credits are separate
SELECT 
    p1.email as user1_email,
    p1.credits_remaining as user1_credits,
    p2.email as user2_email,
    p2.credits_remaining as user2_credits,
    CASE 
        WHEN p1.credits_remaining = p2.credits_remaining THEN 'WARNING: Same credits!'
        ELSE 'OK: Credits are different'
    END as isolation_status
FROM profiles p1
CROSS JOIN profiles p2
WHERE p1.id < p2.id
ORDER BY p1.created_at DESC
LIMIT 5;

