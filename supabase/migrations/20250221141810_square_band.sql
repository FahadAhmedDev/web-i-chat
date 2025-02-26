/*
  # Final policy fixes
  
  This migration:
  1. Drops all existing policies
  2. Creates simplified policies without recursion
  3. Ensures proper access control
*/

-- Drop all existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "webinars_select_policy" ON webinars;
  DROP POLICY IF EXISTS "webinar_sessions_select_policy" ON webinar_sessions;
  DROP POLICY IF EXISTS "avatar_messages_select_policy" ON avatar_messages;
  DROP POLICY IF EXISTS "contacts_select_policy" ON contacts;
END $$;

-- Create new simplified policies

-- Webinars: Users can only see their own webinars
CREATE POLICY "webinars_select_policy" ON webinars
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Webinar Sessions: Only visible to webinar owners
CREATE POLICY "webinar_sessions_select_policy" ON webinar_sessions
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 
      FROM webinars 
      WHERE webinars.id = webinar_id 
      AND webinars.user_id = auth.uid()
    )
  );

-- Avatar Messages: Only visible to webinar owners
CREATE POLICY "avatar_messages_select_policy" ON avatar_messages
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 
      FROM webinars 
      WHERE webinars.id = webinar_id 
      AND webinars.user_id = auth.uid()
    )
  );

-- Contacts: Only visible to webinar owners
CREATE POLICY "contacts_select_policy" ON contacts
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 
      FROM webinars 
      WHERE webinars.id = webinar_id 
      AND webinars.user_id = auth.uid()
    )
  );

-- Add indexes for better performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_webinars_user_id ON webinars(user_id);
CREATE INDEX IF NOT EXISTS idx_webinar_sessions_webinar_id ON webinar_sessions(webinar_id);
CREATE INDEX IF NOT EXISTS idx_avatar_messages_webinar_id ON avatar_messages(webinar_id);
CREATE INDEX IF NOT EXISTS idx_contacts_webinar_id ON contacts(webinar_id);