/*
  # Reset and recreate RLS policies
  
  This migration:
  1. Drops existing policies
  2. Enables RLS on all tables
  3. Creates new policies with correct syntax
  4. Adds performance indexes
*/

-- Reset RLS policies for all tables
DO $$ 
BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "Allow public read access to webinars" ON webinars;
  DROP POLICY IF EXISTS "Users can read their own webinars" ON webinars;
  DROP POLICY IF EXISTS "Users can insert their own webinars" ON webinars;
  DROP POLICY IF EXISTS "Users can update their own webinars" ON webinars;
  DROP POLICY IF EXISTS "Users can delete their own webinars" ON webinars;
  
  DROP POLICY IF EXISTS "Allow public read access to webinar sessions" ON webinar_sessions;
  DROP POLICY IF EXISTS "Users can manage sessions for their webinars" ON webinar_sessions;
  
  DROP POLICY IF EXISTS "Public read access for chat messages" ON chat_messages;
  DROP POLICY IF EXISTS "Public insert access for chat messages" ON chat_messages;
  
  DROP POLICY IF EXISTS "Anyone can insert contact info" ON contacts;
  DROP POLICY IF EXISTS "Webinar owners can read contacts" ON contacts;
  
  DROP POLICY IF EXISTS "Users can manage avatar messages for their webinars" ON avatar_messages;
  
  DROP POLICY IF EXISTS "Users can manage their own integrations" ON user_integrations;
END $$;

-- Enable RLS on all tables
ALTER TABLE webinars ENABLE ROW LEVEL SECURITY;
ALTER TABLE webinar_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE avatar_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

-- Webinars Policies
CREATE POLICY "webinars_select_policy" ON webinars
  FOR SELECT USING (true);

CREATE POLICY "webinars_insert_policy" ON webinars
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "webinars_update_policy" ON webinars
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "webinars_delete_policy" ON webinars
  FOR DELETE USING (auth.uid() = user_id);

-- Webinar Sessions Policies
CREATE POLICY "webinar_sessions_select_policy" ON webinar_sessions
  FOR SELECT USING (true);

CREATE POLICY "webinar_sessions_insert_policy" ON webinar_sessions
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM webinars
    WHERE webinars.id = webinar_id
    AND webinars.user_id = auth.uid()
  ));

CREATE POLICY "webinar_sessions_update_policy" ON webinar_sessions
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM webinars
    WHERE webinars.id = webinar_id
    AND webinars.user_id = auth.uid()
  ));

CREATE POLICY "webinar_sessions_delete_policy" ON webinar_sessions
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM webinars
    WHERE webinars.id = webinar_id
    AND webinars.user_id = auth.uid()
  ));

-- Chat Messages Policies
CREATE POLICY "chat_messages_select_policy" ON chat_messages
  FOR SELECT USING (true);

CREATE POLICY "chat_messages_insert_policy" ON chat_messages
  FOR INSERT WITH CHECK (true);

-- Avatar Messages Policies
CREATE POLICY "avatar_messages_select_policy" ON avatar_messages
  FOR SELECT USING (true);

CREATE POLICY "avatar_messages_insert_policy" ON avatar_messages
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM webinars
    WHERE webinars.id = webinar_id
    AND webinars.user_id = auth.uid()
  ));

CREATE POLICY "avatar_messages_update_policy" ON avatar_messages
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM webinars
    WHERE webinars.id = webinar_id
    AND webinars.user_id = auth.uid()
  ));

CREATE POLICY "avatar_messages_delete_policy" ON avatar_messages
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM webinars
    WHERE webinars.id = webinar_id
    AND webinars.user_id = auth.uid()
  ));

-- Contacts Policies
CREATE POLICY "contacts_select_policy" ON contacts
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM webinars
    WHERE webinars.id = webinar_id
    AND webinars.user_id = auth.uid()
  ));

CREATE POLICY "contacts_insert_policy" ON contacts
  FOR INSERT WITH CHECK (true);

-- Attendees Policies
CREATE POLICY "attendees_select_policy" ON attendees
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM webinars
    WHERE webinars.id = webinar_id
    AND webinars.user_id = auth.uid()
  ));

CREATE POLICY "attendees_insert_policy" ON attendees
  FOR INSERT WITH CHECK (true);

-- User Integrations Policies
CREATE POLICY "user_integrations_select_policy" ON user_integrations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_integrations_insert_policy" ON user_integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_integrations_update_policy" ON user_integrations
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_integrations_delete_policy" ON user_integrations
  FOR DELETE USING (auth.uid() = user_id);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_webinars_user_id ON webinars(user_id);
CREATE INDEX IF NOT EXISTS idx_webinar_sessions_webinar_id ON webinar_sessions(webinar_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_webinar_id ON chat_messages(webinar_id);
CREATE INDEX IF NOT EXISTS idx_avatar_messages_webinar_id ON avatar_messages(webinar_id);
CREATE INDEX IF NOT EXISTS idx_contacts_webinar_id ON contacts(webinar_id);
CREATE INDEX IF NOT EXISTS idx_attendees_webinar_id ON attendees(webinar_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_user_id ON user_integrations(user_id);