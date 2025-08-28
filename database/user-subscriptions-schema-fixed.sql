-- StudioSix User Subscriptions Schema (Fixed for Supabase)
-- Extends user authentication with subscription management

-- Create user_profiles table to extend auth.users
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    
    -- Subscription fields
    subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'studio', 'enterprise')),
    subscription_status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (subscription_status IN ('active', 'cancelled', 'paused', 'trial')),
    subscription_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    subscription_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_billing_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_billing_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
    
    -- Payment fields (for Stripe integration)
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT,
    payment_method_id TEXT,
    
    -- Usage tracking fields
    usage_ai_tokens_this_month INTEGER NOT NULL DEFAULT 0,
    usage_image_renders_this_month INTEGER NOT NULL DEFAULT 0,
    usage_bim_exports_this_month INTEGER NOT NULL DEFAULT 0,
    usage_last_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Total lifetime usage
    total_ai_tokens_used INTEGER NOT NULL DEFAULT 0,
    total_image_renders_used INTEGER NOT NULL DEFAULT 0,
    total_bim_exports_used INTEGER NOT NULL DEFAULT 0,
    total_cost_incurred DECIMAL(10,4) NOT NULL DEFAULT 0,
    
    -- Account metadata
    is_trial_used BOOLEAN NOT NULL DEFAULT FALSE,
    trial_started_at TIMESTAMPTZ,
    trial_ends_at TIMESTAMPTZ,
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    preferred_ai_model VARCHAR(50) DEFAULT 'gpt-3.5-turbo',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create subscription usage history table
CREATE TABLE IF NOT EXISTS public.subscription_usage_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Usage details
    usage_type VARCHAR(20) NOT NULL CHECK (usage_type IN ('ai_chat', 'image_render', 'bim_export')),
    usage_amount INTEGER NOT NULL DEFAULT 1,
    model_used VARCHAR(50),
    cost_incurred DECIMAL(10,6) NOT NULL DEFAULT 0,
    
    -- Context
    action_description TEXT,
    metadata JSONB,
    subscription_tier VARCHAR(20) NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create subscription changes log table
CREATE TABLE IF NOT EXISTS public.subscription_changes_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Change details
    old_tier VARCHAR(20),
    new_tier VARCHAR(20) NOT NULL,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    change_reason VARCHAR(50) NOT NULL, -- 'upgrade', 'downgrade', 'payment_failed', 'cancellation', 'trial_started'
    
    -- Payment context
    stripe_event_id TEXT,
    amount_charged DECIMAL(10,2),
    
    -- Context
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription_tier ON public.user_profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer ON public.user_profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_usage_history_user_type ON public.subscription_usage_history(user_id, usage_type);
CREATE INDEX IF NOT EXISTS idx_usage_history_created_at ON public.subscription_usage_history(created_at);
CREATE INDEX IF NOT EXISTS idx_changes_log_user_id ON public.subscription_changes_log(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_usage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_changes_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for subscription_usage_history
CREATE POLICY "Users can view own usage history" ON public.subscription_usage_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can insert usage records" ON public.subscription_usage_history
    FOR INSERT WITH CHECK (true); -- Allow service account to insert

-- RLS Policies for subscription_changes_log
CREATE POLICY "Users can view own subscription changes" ON public.subscription_changes_log
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can insert subscription changes" ON public.subscription_changes_log
    FOR INSERT WITH CHECK (true); -- Allow service account to insert

-- Function to automatically update the updated_at column
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on user_profiles
CREATE TRIGGER handle_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function to reset monthly usage counts
CREATE OR REPLACE FUNCTION public.reset_monthly_usage()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if we need to reset monthly usage based on billing period
    IF NEW.current_billing_period_start > OLD.current_billing_period_start THEN
        NEW.usage_ai_tokens_this_month = 0;
        NEW.usage_image_renders_this_month = 0;
        NEW.usage_bim_exports_this_month = 0;
        NEW.usage_last_reset_at = NEW.current_billing_period_start;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically reset usage on billing period change
CREATE TRIGGER reset_usage_on_billing_period_change
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.reset_monthly_usage();

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (
        id,
        email,
        full_name,
        subscription_tier,
        subscription_status,
        subscription_started_at,
        current_billing_period_start,
        current_billing_period_end
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'firstName', split_part(NEW.email, '@', 1)),
        'free', -- Default to free tier
        'active',
        NOW(),
        NOW(),
        NOW() + INTERVAL '1 month'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile when user signs up
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to get user subscription limits based on tier
CREATE OR REPLACE FUNCTION public.get_subscription_limits(user_tier TEXT)
RETURNS JSONB AS $$
BEGIN
    RETURN CASE user_tier
        WHEN 'free' THEN jsonb_build_object(
            'aiTokensPerMonth', 5000,
            'imageRendersPerMonth', 20,
            'bimExportsPerMonth', 0,
            'availableModels', jsonb_build_array('gpt-3.5-turbo'),
            'maxImageResolution', 512,
            'supportLevel', 'community'
        )
        WHEN 'pro' THEN jsonb_build_object(
            'aiTokensPerMonth', 50000,
            'imageRendersPerMonth', 200,
            'bimExportsPerMonth', 10,
            'availableModels', jsonb_build_array('gpt-3.5-turbo', 'gpt-4'),
            'maxImageResolution', 768,
            'supportLevel', 'priority',
            'cloudStorage', '1GB'
        )
        WHEN 'studio' THEN jsonb_build_object(
            'aiTokensPerMonth', 200000,
            'imageRendersPerMonth', 1000,
            'bimExportsPerMonth', 50,
            'availableModels', jsonb_build_array('gpt-3.5-turbo', 'gpt-4', 'claude-3-5-sonnet-20241022'),
            'maxImageResolution', 1024,
            'supportLevel', 'priority',
            'cloudStorage', '5GB',
            'teamSeats', 5
        )
        WHEN 'enterprise' THEN jsonb_build_object(
            'aiTokensPerMonth', 1000000,
            'imageRendersPerMonth', -1, -- unlimited
            'bimExportsPerMonth', -1, -- unlimited
            'availableModels', jsonb_build_array('gpt-3.5-turbo', 'gpt-4', 'claude-3-5-sonnet-20241022', 'custom'),
            'maxImageResolution', 4096,
            'supportLevel', 'dedicated',
            'cloudStorage', '50GB',
            'teamSeats', -1, -- unlimited
            'customModels', true
        )
        ELSE jsonb_build_object('error', 'Invalid tier')
    END;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user can perform an action
CREATE OR REPLACE FUNCTION public.can_user_perform_action(
    p_user_id UUID,
    p_action_type TEXT,
    p_amount INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
    user_profile RECORD;
    limits JSONB;
    current_usage INTEGER;
BEGIN
    -- Get user profile
    SELECT * INTO user_profile 
    FROM public.user_profiles 
    WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Get tier limits
    limits := public.get_subscription_limits(user_profile.subscription_tier);
    
    -- Check based on action type
    CASE p_action_type
        WHEN 'ai_chat' THEN
            current_usage := user_profile.usage_ai_tokens_this_month;
            RETURN current_usage + p_amount <= (limits->>'aiTokensPerMonth')::INTEGER;
            
        WHEN 'image_render' THEN
            current_usage := user_profile.usage_image_renders_this_month;
            IF (limits->>'imageRendersPerMonth')::INTEGER = -1 THEN -- unlimited
                RETURN TRUE;
            END IF;
            RETURN current_usage + p_amount <= (limits->>'imageRendersPerMonth')::INTEGER;
            
        WHEN 'bim_export' THEN
            current_usage := user_profile.usage_bim_exports_this_month;
            IF (limits->>'bimExportsPerMonth')::INTEGER = -1 THEN -- unlimited
                RETURN TRUE;
            END IF;
            RETURN current_usage + p_amount <= (limits->>'bimExportsPerMonth')::INTEGER;
            
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record usage
CREATE OR REPLACE FUNCTION public.record_user_usage(
    p_user_id UUID,
    p_usage_type TEXT,
    p_amount INTEGER DEFAULT 1,
    p_model_used TEXT DEFAULT NULL,
    p_cost DECIMAL(10,6) DEFAULT 0,
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
    user_profile RECORD;
BEGIN
    -- Get current user profile
    SELECT * INTO user_profile 
    FROM public.user_profiles 
    WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Insert usage history record
    INSERT INTO public.subscription_usage_history (
        user_id, usage_type, usage_amount, model_used, 
        cost_incurred, action_description, metadata, subscription_tier
    )
    VALUES (
        p_user_id, p_usage_type, p_amount, p_model_used,
        p_cost, p_description, p_metadata, user_profile.subscription_tier
    );
    
    -- Update user profile usage counters
    CASE p_usage_type
        WHEN 'ai_chat' THEN
            UPDATE public.user_profiles 
            SET usage_ai_tokens_this_month = usage_ai_tokens_this_month + p_amount,
                total_ai_tokens_used = total_ai_tokens_used + p_amount,
                total_cost_incurred = total_cost_incurred + p_cost
            WHERE id = p_user_id;
            
        WHEN 'image_render' THEN
            UPDATE public.user_profiles 
            SET usage_image_renders_this_month = usage_image_renders_this_month + p_amount,
                total_image_renders_used = total_image_renders_used + p_amount,
                total_cost_incurred = total_cost_incurred + p_cost
            WHERE id = p_user_id;
            
        WHEN 'bim_export' THEN
            UPDATE public.user_profiles 
            SET usage_bim_exports_this_month = usage_bim_exports_this_month + p_amount,
                total_bim_exports_used = total_bim_exports_used + p_amount,
                total_cost_incurred = total_cost_incurred + p_cost
            WHERE id = p_user_id;
    END CASE;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;
GRANT SELECT, INSERT ON public.subscription_usage_history TO authenticated;
GRANT SELECT ON public.subscription_changes_log TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.get_subscription_limits(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_user_perform_action(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_user_usage(UUID, TEXT, INTEGER, TEXT, DECIMAL, TEXT, JSONB) TO authenticated;

-- Comments for documentation
COMMENT ON TABLE public.user_profiles IS 'Extended user profiles with subscription and usage tracking';
COMMENT ON TABLE public.subscription_usage_history IS 'Historical log of all user actions for billing and analytics';
COMMENT ON TABLE public.subscription_changes_log IS 'Log of all subscription tier and status changes';
COMMENT ON FUNCTION public.get_subscription_limits(TEXT) IS 'Returns usage limits and features for a given subscription tier';
COMMENT ON FUNCTION public.can_user_perform_action(UUID, TEXT, INTEGER) IS 'Checks if user can perform an action based on their tier limits and current usage';
COMMENT ON FUNCTION public.record_user_usage(UUID, TEXT, INTEGER, TEXT, DECIMAL, TEXT, JSONB) IS 'Records user usage and updates counters atomically';