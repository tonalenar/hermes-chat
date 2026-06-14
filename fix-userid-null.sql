-- Remove NOT NULL constraint de user_id nas conversas
-- (o chat nao tem autenticacao de usuario ainda)

ALTER TABLE conversations ALTER COLUMN user_id DROP NOT NULL;

-- Tambem remove a FK se ela existir (nao precisamos da tabela users por enquanto)
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_user_id_fkey;

-- Libera user_id pra ser NULL nas messages tambem
ALTER TABLE messages ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_user_id_fkey;

-- Verifica resultado
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name IN ('conversations', 'messages') 
  AND column_name = 'user_id'
ORDER BY table_name;
