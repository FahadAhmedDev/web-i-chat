-- Drop existing policies
DO $$ 
BEGIN
  -- Drop policies if they exist
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'chat_messages'
  ) THEN
    DROP POLICY IF EXISTS "chat_messages_insert_policy" ON chat_messages;
    DROP POLICY IF EXISTS "chat_messages_select_policy" ON chat_messages;
    DROP POLICY IF EXISTS "Anyone can read chat messages" ON chat_messages;
    DROP POLICY IF EXISTS "Anyone can insert chat messages" ON chat_messages;
    DROP POLICY IF EXISTS "Anonymous users can read chat messages" ON chat_messages;
    DROP POLICY IF EXISTS "Anonymous users can insert chat messages" ON chat_messages;
    DROP POLICY IF EXISTS "Public read access to chat messages" ON chat_messages;
    DROP POLICY IF EXISTS "Public insert access to chat messages" ON chat_messages;
  END IF;
END $$;

-- Create new simplified policies
CREATE POLICY "Public read access for chat messages"
  ON chat_messages FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public insert access for chat messages"
  ON chat_messages FOR INSERT
  TO public
  WITH CHECK (true);

-- Ensure RLS is enabled but allow public access
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Update contacts table to allow anonymous access
DROP POLICY IF EXISTS "Anyone can insert contact info" ON contacts;
CREATE POLICY "Public insert access for contacts"
  ON contacts FOR INSERT
  TO public
  WITH CHECK (true);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS contacts_webinar_email_idx ON contacts(webinar_id, email);