ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS share_token UUID;

ALTER TABLE messages ADD COLUMN IF NOT EXISTS parent_id UUID;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS tokens_used INTEGER;

CREATE TABLE IF NOT EXISTS prompt_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  instructions TEXT NOT NULL,
  temperature NUMERIC(3,2) DEFAULT 0.7,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE prompt_presets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for anon" ON prompt_presets;
CREATE POLICY "Enable all for anon" ON prompt_presets FOR ALL USING (true) WITH CHECK (true);
