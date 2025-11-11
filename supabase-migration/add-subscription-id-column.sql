-- Add subscription_id column to profiles table if it doesn't exist
-- This column stores the PayPal subscription ID

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS subscription_id TEXT;

