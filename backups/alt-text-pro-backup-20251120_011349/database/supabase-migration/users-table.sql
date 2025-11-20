-- Create users table for credit tracking
-- File: supabase-migration/users-table.sql

-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    api_key TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
                    credits_remaining INTEGER DEFAULT 100 NOT NULL,
    total_processed INTEGER DEFAULT 0 NOT NULL,
    plan TEXT DEFAULT 'Free Trial' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create index on api_key for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_api_key ON public.users(api_key);

-- Create index on email for potential future use
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for now (can be restricted later)
CREATE POLICY "Allow all operations for users" ON public.users
    FOR ALL USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON public.users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data for testing (optional)
-- INSERT INTO public.users (api_key, email, credits_remaining, total_processed, plan) 
-- VALUES 
--     ('altai_sample123_abc456_xyz789', 'test@example.com', 30, 0, 'Free Trial');

-- Grant necessary permissions
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.users TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon; 