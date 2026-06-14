-- =============================================
-- UPGRADE SCHEMA 2: prompt_presets + parent_id em messages
-- =============================================
-- Execute no Supabase Dashboard > SQL Editor
-- =============================================

-- =============================================
-- 1. CRIAR TABELA prompt_presets
-- =============================================
CREATE TABLE IF NOT EXISTS prompt_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  instructions TEXT NOT NULL,
  temperature NUMERIC(3,2) DEFAULT 0.7,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_prompt_presets_user_id ON prompt_presets(user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_presets_name ON prompt_presets(name);

-- =============================================
-- 2. TRIGGER updated_at PARA prompt_presets
-- =============================================
DROP TRIGGER IF EXISTS update_prompt_presets_updated_at ON prompt_presets;
CREATE TRIGGER update_prompt_presets_updated_at
  BEFORE UPDATE ON prompt_presets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 3. ROW LEVEL SECURITY (RLS)
-- =============================================
ALTER TABLE prompt_presets ENABLE ROW LEVEL SECURITY;

-- Policy: usuarios veem apenas seus proprios presets
DROP POLICY IF EXISTS "Users can view own presets" ON prompt_presets;
CREATE POLICY "Users can view own presets" ON prompt_presets
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- Policy: usuarios podem inserir proprios presets
DROP POLICY IF EXISTS "Users can insert own presets" ON prompt_presets;
CREATE POLICY "Users can insert own presets" ON prompt_presets
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Policy: usuarios podem atualizar proprios presets
DROP POLICY IF EXISTS "Users can update own presets" ON prompt_presets;
CREATE POLICY "Users can update own presets" ON prompt_presets
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

-- Policy: usuarios podem deletar proprios presets
DROP POLICY IF EXISTS "Users can delete own presets" ON prompt_presets;
CREATE POLICY "Users can delete own presets" ON prompt_presets
  FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);

-- =============================================
-- 4. ADICIONAR parent_id NA TABELA messages
-- =============================================
ALTER TABLE messages ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES messages(id) ON DELETE SET NULL;

-- Indice para consultas hierarquicas de mensagens
CREATE INDEX IF NOT EXISTS idx_messages_parent_id ON messages(parent_id);
