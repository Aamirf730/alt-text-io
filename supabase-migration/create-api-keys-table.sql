-- Create API Keys table for user authentication
-- This allows each user to have a persistent API key for plugin integration

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    api_key TEXT NOT NULL UNIQUE,
    name TEXT DEFAULT 'WordPress Plugin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    
    CONSTRAINT api_keys_user_id_fkey FOREIGN KEY (user_id) 
        REFERENCES profiles(id) ON DELETE CASCADE
);

-- Create index for fast API key lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_api_key ON api_keys(api_key) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own API keys
CREATE POLICY "Users can view their own API keys"
    ON api_keys FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own API keys
CREATE POLICY "Users can insert their own API keys"
    ON api_keys FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own API keys
CREATE POLICY "Users can update their own API keys"
    ON api_keys FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy: Users can delete their own API keys
CREATE POLICY "Users can delete their own API keys"
    ON api_keys FOR DELETE
    USING (auth.uid() = user_id);

-- Function to generate a unique API key
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS TEXT AS $$
DECLARE
    new_key TEXT;
    key_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate a random API key (64 characters)
        new_key := 'alt_' || encode(gen_random_bytes(32), 'base64');
        new_key := replace(new_key, '/', '_');
        new_key := replace(new_key, '+', '-');
        
        -- Check if key already exists
        SELECT EXISTS(SELECT 1 FROM api_keys WHERE api_key = new_key) INTO key_exists;
        
        -- If unique, exit loop
        EXIT WHEN NOT key_exists;
    END LOOP;
    
    RETURN new_key;
END;
$$ LANGUAGE plpgsql;

-- Function to get or create API key for a user
CREATE OR REPLACE FUNCTION get_or_create_api_key(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
    existing_key TEXT;
    new_key TEXT;
BEGIN
    -- Try to get existing active API key
    SELECT api_key INTO existing_key
    FROM api_keys
    WHERE user_id = p_user_id 
      AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- If no active key exists, create one
    IF existing_key IS NULL THEN
        new_key := generate_api_key();
        
        INSERT INTO api_keys (user_id, api_key, name)
        VALUES (p_user_id, new_key, 'WordPress Plugin')
        RETURNING api_key INTO new_key;
        
        RETURN new_key;
    END IF;
    
    RETURN existing_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate API key and return user_id
CREATE OR REPLACE FUNCTION validate_api_key(p_api_key TEXT)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Find user by API key
    SELECT user_id INTO v_user_id
    FROM api_keys
    WHERE api_key = p_api_key
      AND is_active = true;
    
    -- Update last_used_at if key is found
    IF v_user_id IS NOT NULL THEN
        UPDATE api_keys
        SET last_used_at = NOW()
        WHERE api_key = p_api_key;
    END IF;
    
    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

