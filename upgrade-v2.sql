-- =============================================
-- UPGRADE V2: pinned, archived, share, token tracking
-- =============================================
-- Execute no Supabase Dashboard > SQL Editor
-- =============================================

-- =============================================
-- 1. NOVAS COLUNAS EM conversations
-- =============================================

-- pinned: conversa fixada no topo
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false;

-- archived: conversa arquivada (soft-delete visivel)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- share_token: token unico para compartilhar conversa
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT gen_random_uuid();

-- =============================================
-- 2. INDICES
-- =============================================

-- Indice para buscar conversas fixadas
CREATE INDEX IF NOT EXISTS idx_conversations_pinned ON conversations(pinned) WHERE pinned = true;

-- Indice para filtrar conversas arquivadas
CREATE INDEX IF NOT EXISTS idx_conversations_archived ON conversations(archived) WHERE archived = true;

-- Indice para busca por share_token
CREATE INDEX IF NOT EXISTS idx_conversations_share_token ON conversations(share_token);

-- Indice para busca full-text em mensagens (search)
CREATE INDEX IF NOT EXISTS idx_messages_content_gin ON messages USING gin(to_tsvector('portuguese', content));

-- =============================================
-- 3. TOKEN COUNT: garantir que messages tem tokens_used
-- =============================================

-- tokens_used ja deve existir na tabela messages (criado no schema inicial)
-- mas garantimos com IF NOT EXISTS
ALTER TABLE messages ADD COLUMN IF NOT EXISTS tokens_used INTEGER;

-- =============================================
-- 4. ATUALIZAR POLICIES RLS PARA archived/share
-- =============================================

-- Policy: archived ainda respeita mesma regra (user_id match)
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
CREATE POLICY "Users can view own conversations" ON conversations
  FOR SELECT USING (
    auth.uid() = user_id
    OR user_id IS NULL
    OR archived = false  -- shared/public conversations visible
  );

-- Policy para updates (incluir pinned/archived)
DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;
CREATE POLICY "Users can update own conversations" ON conversations
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- =============================================
-- 5. FUNCAO: gerar novo share_token
-- =============================================

CREATE OR REPLACE FUNCTION regenerate_share_token(conv_id UUID)
RETURNS UUID AS $$
DECLARE
  new_token UUID;
BEGIN
  new_token := gen_random_uuid();
  UPDATE conversations SET share_token = new_token WHERE id = conv_id;
  RETURN new_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 6. ATUALIZAR TODAS AS CONVERSAS EXISTENTES COM SHARE_TOKEN
-- =============================================

UPDATE conversations
SET share_token = gen_random_uuid()
WHERE share_token IS NULL;

-- Garantir que share_token tem NOT NULL apos update
ALTER TABLE conversations ALTER COLUMN share_token SET NOT NULL;
