-- =============================================
-- AGENT PROFILES - Registro de Bots/Profiles do Hermes
-- =============================================
CREATE TABLE IF NOT EXISTS public.agent_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(200),
    telegram_bot_username VARCHAR(200),
    telegram_bot_status VARCHAR(50) DEFAULT 'offline',
    api_port INTEGER,
    description TEXT,
    model_default VARCHAR(100),
    fallback_models JSONB DEFAULT '[]',
    skills JSONB DEFAULT '[]',
    profile_type VARCHAR(50) DEFAULT 'agent',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.agent_profiles ENABLE ROW LEVEL SECURITY;

-- Allow public read
DROP POLICY IF EXISTS agent_profiles_select ON public.agent_profiles;
CREATE POLICY agent_profiles_select ON public.agent_profiles FOR SELECT USING (true);

-- Only authenticated users can modify
DROP POLICY IF EXISTS agent_profiles_insert ON public.agent_profiles;
CREATE POLICY agent_profiles_insert ON public.agent_profiles FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS agent_profiles_update ON public.agent_profiles;
CREATE POLICY agent_profiles_update ON public.agent_profiles FOR UPDATE USING (auth.role() = 'service_role');
