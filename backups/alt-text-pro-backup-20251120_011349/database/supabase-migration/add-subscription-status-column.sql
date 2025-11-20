-- Add subscription_status column to profiles table if it doesn't exist
-- This column is required by the upgrade_subscription function

-- Add the column if it doesn't exist
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active' 
  CHECK (subscription_status IN ('active', 'cancelled', 'expired', 'pending'));

-- Update existing rows to have 'active' status if they don't have one
UPDATE public.profiles 
SET subscription_status = 'active' 
WHERE subscription_status IS NULL;

