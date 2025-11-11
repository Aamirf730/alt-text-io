-- Add any other missing columns that might be needed by upgrade_subscription function

-- Add next_billing_date if it doesn't exist
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMP WITH TIME ZONE;

