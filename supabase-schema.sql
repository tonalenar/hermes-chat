-- Hermes Chat - Schema do Supabase
-- Execute este SQL no Supabase Dashboard → SQL Editor

-- =====================
-- TABELAS
-- =====================

-- 1. USUARIOS
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CONVERSAS
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  model VARCHAR(100) DEFAULT 'kr/auto',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 3. MENSAGENS
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  role VARCHAR(20) CHECK (role IN ('user', 'assistant', 'system')) NOT NULL,
  content TEXT NOT NULL,
  model VARCHAR(100),
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ARQUIVOS
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  file_name VARCHAR(500) NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  file_size INTEGER,
  storage_path TEXT,
  url TEXT,
  content_text TEXT, -- para OCR/extrair texto de PDFs
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. AUDIOS (futuro)
CREATE TABLE IF NOT EXISTS audios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  file_name VARCHAR(500) NOT NULL,
  duration_seconds INTEGER,
  transcription TEXT,
  storage_path TEXT,
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- ÍNDICES
-- =====================

CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_files_message ON files(message_id);
CREATE INDEX IF NOT EXISTS idx_files_conversation ON files(conversation_id);
CREATE INDEX IF NOT EXISTS idx_audios_message ON audios(message_id);

-- =====================
-- ROW LEVEL SECURITY
-- =====================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE audios ENABLE ROW LEVEL SECURITY;

-- Política: usuários veem apenas seus dados
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own data" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own conversations" ON conversations
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can insert own conversations" ON conversations
  FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can update own conversations" ON conversations
  FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can view own messages" ON messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM conversations WHERE id = messages.conversation_id AND (user_id = auth.uid() OR user_id IS NULL))
  );

CREATE POLICY "Users can insert own messages" ON messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM conversations WHERE id = messages.conversation_id AND (user_id = auth.uid() OR user_id IS NULL))
  );

CREATE POLICY "Anyone can view files" ON files
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert files" ON files
  FOR INSERT WITH CHECK (true);

-- =====================
-- FUNÇÕES ÚTEIS
-- =====================

-- Contar mensagens de uma conversa
CREATE OR REPLACE FUNCTION count_messages(conv_id UUID)
RETURNS BIGINT AS $$
  SELECT COUNT(*) FROM messages WHERE conversation_id = conv_id;
$$ LANGUAGE sql;

-- Ultima mensagem de uma conversa
CREATE OR REPLACE FUNCTION last_message(conv_id UUID)
RETURNS TABLE(id UUID, role VARCHAR, content TEXT, created_at TIMESTAMPTZ) AS $$
  SELECT id, role, content, created_at 
  FROM messages 
  WHERE conversation_id = conv_id 
  ORDER BY created_at DESC 
  LIMIT 1;
$$ LANGUAGE sql;

-- =====================
-- STORAGE (para arquivos)
-- =====================

-- Criar bucket para arquivos do chat
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-files', 
  'chat-files', 
  true, 
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'application/zip', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO NOTHING;

-- Política de acesso ao storage
CREATE POLICY "Public access to chat-files" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-files');

CREATE POLICY "Anyone can upload to chat-files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'chat-files');

CREATE POLICY "Anyone can update chat-files" ON storage.objects
  FOR UPDATE USING (bucket_id = 'chat-files');

CREATE POLICY "Anyone can delete chat-files" ON storage.objects
  FOR DELETE USING (bucket_id = 'chat-files');