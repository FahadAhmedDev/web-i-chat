/*
  # Fix webinar policies to prevent recursion
  
  This migration:
  1. Drops problematic policies
  2. Creates simplified policies without recursive logic
  3. Ensures proper access control
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "webinars_select_policy" ON webinars;
DROP POLICY IF EXISTS "webinar_sessions_select_policy" ON webinar_sessions;
DROP POLICY IF EXISTS "avatar_messages_select_policy" ON avatar_messages;

-- Create simplified webinar select policy
CREATE POLICY "webinars_select_policy" ON webinars
  FOR SELECT USING (
    -- Users can see their own webinars
    auth.uid() = user_id OR
    -- Or webinars they're registered for as contacts
    id IN (
      SELECT webinar_id 
      FROM contacts 
      WHERE email = auth.email()
    )
  );

-- Create simplified webinar sessions select policy
CREATE POLICY "webinar_sessions_select_policy" ON webinar_sessions
  FOR SELECT USING (
    -- Sessions for webinars owned by the user
    EXISTS (
      SELECT 1 
      FROM webinars 
      WHERE webinars.id = webinar_id 
      AND webinars.user_id = auth.uid()
    ) OR
    -- Or sessions for webinars they're registered for
    webinar_id IN (
      SELECT webinar_id 
      FROM contacts 
      WHERE email = auth.email()
    )
  );

-- Create simplified avatar messages select policy
CREATE POLICY "avatar_messages_select_policy" ON avatar_messages
  FOR SELECT USING (
    -- Messages for webinars owned by the user
    EXISTS (
      SELECT 1 
      FROM webinars 
      WHERE webinars.id = webinar_id 
      AND webinars.user_id = auth.uid()
    ) OR
    -- Or messages for webinars they're registered for
    webinar_id IN (
      SELECT webinar_id 
      FROM contacts 
      WHERE email = auth.email()
    )
  );