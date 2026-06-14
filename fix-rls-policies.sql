-- Fix RLS policies for Hermes Chat (anon key access)
-- Remove IF NOT EXISTS - nao suportado no Supabase free tier

-- 1. Conversations table
DROP POLICY IF EXISTS "Users can insert their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON conversations;

CREATE POLICY "Enable all operations for anon"
  ON conversations
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 2. Messages table
DROP POLICY IF EXISTS "Users can insert their own messages" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;

CREATE POLICY "Enable all operations for anon"
  ON messages
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. File attachments table (se existir)
DROP POLICY IF EXISTS "Users can insert their own files" ON file_attachments;
DROP POLICY IF EXISTS "Users can update their own files" ON file_attachments;

CREATE POLICY "Enable all operations for anon"
  ON file_attachments
  FOR ALL
  USING (true)
  WITH CHECK (true);
