-- Add polar_customer_id column to profiles table
-- Date: January 2024
-- Description: Stores the customer ID from Polar.sh to enable access to the customer portal.

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS polar_customer_id TEXT;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_polar_customer_id ON public.profiles(polar_customer_id);
