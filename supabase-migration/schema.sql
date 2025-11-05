-- Alt-Text AI SaaS Database Schema for Supabase PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (leverages Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  subscription_plan TEXT DEFAULT 'free' CHECK (subscription_plan IN ('free', 'tier1', 'tier2', 'pay_as_go')),
  credits_remaining INTEGER DEFAULT 100,
  total_processed INTEGER DEFAULT 0,
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'cancelled', 'expired', 'pending')),
  subscription_id TEXT, -- PayPal subscription ID
  next_billing_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage logs table
CREATE TABLE public.usage_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  credits_used INTEGER DEFAULT 1,
  alt_text_generated TEXT,
  image_context TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments table for tracking transactions
CREATE TABLE public.payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_id TEXT NOT NULL, -- PayPal payment ID
  subscription_id TEXT, -- PayPal subscription ID (if applicable)
  plan_id TEXT REFERENCES public.subscription_plans(id),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'refunded')),
  payment_method TEXT DEFAULT 'paypal',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription plans reference table
CREATE TABLE public.subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  credits INTEGER NOT NULL,
  billing_cycle TEXT NOT NULL,
  features JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default subscription plans
INSERT INTO public.subscription_plans (id, name, price, credits, billing_cycle, features) VALUES
('free', 'Free', 0, 100, 'monthly', 
 '["100 Credits", "Basic support", "API access"]'),
('tier1', 'Tier 1', 9.00, 1000, 'monthly', 
 '["1,000 Credits", "Priority support", "API access", "Bulk processing"]'),
('tier2', 'Tier 2', 19.00, 2500, 'monthly', 
 '["2,500 Credits", "Premium support", "API access", "Bulk processing", "Custom integrations"]'),
('pay_as_go', 'Pay as you go', 4.00, 500, 'one-time', 
 '["No monthly commitment", "Pay only for what you use", "API access", "Standard support"]');

-- Row Level Security (RLS) policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Usage logs policies  
CREATE POLICY "Users can view own usage logs" ON public.usage_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage logs" ON public.usage_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Payments policies
CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payments" ON public.payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Public read access to subscription plans
CREATE POLICY "Anyone can view subscription plans" ON public.subscription_plans
  FOR SELECT USING (true);

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update credits after alt-text generation
CREATE OR REPLACE FUNCTION public.use_credit(user_uuid UUID, alt_text TEXT, context TEXT DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  current_credits INTEGER;
  result JSON;
BEGIN
  -- Get current credits
  SELECT credits_remaining INTO current_credits 
  FROM public.profiles 
  WHERE id = user_uuid;
  
  -- Check if user has credits
  IF current_credits <= 0 THEN
    RETURN JSON_BUILD_OBJECT('error', 'No credits remaining');
  END IF;
  
  -- Deduct credit and update stats
  UPDATE public.profiles 
  SET 
    credits_remaining = credits_remaining - 1,
    total_processed = total_processed + 1,
    updated_at = NOW()
  WHERE id = user_uuid;
  
  -- Log usage
  INSERT INTO public.usage_logs (user_id, credits_used, alt_text_generated, image_context)
  VALUES (user_uuid, 1, alt_text, context);
  
  -- Return result
  SELECT JSON_BUILD_OBJECT(
    'success', true,
    'credits_used', 1,
    'credits_remaining', credits_remaining - 1,
    'total_processed', total_processed + 1
  ) INTO result
  FROM public.profiles 
  WHERE id = user_uuid;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to upgrade user subscription
CREATE OR REPLACE FUNCTION public.upgrade_subscription(
  user_uuid UUID, 
  new_plan TEXT, 
  payment_id TEXT,
  subscription_id TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  plan_credits INTEGER;
  plan_price DECIMAL(10,2);
  result JSON;
BEGIN
  -- Get plan details
  SELECT credits, price INTO plan_credits, plan_price
  FROM public.subscription_plans 
  WHERE id = new_plan;
  
  IF plan_credits IS NULL THEN
    RETURN JSON_BUILD_OBJECT('error', 'Invalid plan');
  END IF;
  
  -- Update user subscription
  UPDATE public.profiles 
  SET 
    subscription_plan = new_plan,
    credits_remaining = CASE 
      WHEN new_plan = 'pay_as_go' THEN credits_remaining + plan_credits
      ELSE plan_credits
    END,
    subscription_status = 'active',
    subscription_id = COALESCE(subscription_id, subscription_id),
    next_billing_date = CASE 
      WHEN new_plan IN ('tier1', 'tier2') THEN NOW() + INTERVAL '1 month'
      ELSE NULL
    END,
    updated_at = NOW()
  WHERE id = user_uuid;
  
  -- Record payment
  INSERT INTO public.payments (user_id, payment_id, subscription_id, plan_id, amount, status)
  VALUES (user_uuid, payment_id, subscription_id, new_plan, plan_price, 'completed');
  
  -- Return result
  SELECT JSON_BUILD_OBJECT(
    'success', true,
    'plan', subscription_plan,
    'credits_remaining', credits_remaining,
    'next_billing_date', next_billing_date
  ) INTO result
  FROM public.profiles 
  WHERE id = user_uuid;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cancel subscription
CREATE OR REPLACE FUNCTION public.cancel_subscription(user_uuid UUID)
RETURNS JSON AS $$
BEGIN
  UPDATE public.profiles 
  SET 
    subscription_status = 'cancelled',
    subscription_id = NULL,
    next_billing_date = NULL,
    updated_at = NOW()
  WHERE id = user_uuid;
  
  RETURN JSON_BUILD_OBJECT('success', true, 'message', 'Subscription cancelled');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;