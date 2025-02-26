/*
  # Update RLS policies for stricter access control
  
  This migration:
  1. Drops existing webinar select policies
  2. Creates new policies to restrict webinar access to owners
  3. Updates related policies for sessions and messages
*/

-- Drop existing select policies
DROP POLICY IF EXISTS "webinars_select_policy" ON webinars;
DROP POLICY IF EXISTS "webinar_sessions_select_policy" ON webinar_sessions;

-- Create new restricted select policies for webinars
CREATE POLICY "webinars_select_policy" ON webinars
  FOR SELECT USING (
    -- Allow users to see only their own webinars when authenticated
    (auth.uid() = user_id AND auth.role() = 'authenticated') OR
    -- Allow viewing specific webinar if user has the direct link
    EXISTS (
      SELECT 1 FROM contacts 
      WHERE contacts.webinar_id = id 
      AND contacts.email = auth.email()
    )
  );

-- Update webinar sessions select policy
CREATE POLICY "webinar_sessions_select_policy" ON webinar_sessions
  FOR SELECT USING (
    -- Allow users to see sessions for their own webinars
    EXISTS (
      SELECT 1 FROM webinars
      WHERE webinars.id = webinar_id
      AND (
        webinars.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM contacts 
          WHERE contacts.webinar_id = webinars.id 
          AND contacts.email = auth.email()
        )
      )
    )
  );

-- Update avatar messages select policy
DROP POLICY IF EXISTS "avatar_messages_select_policy" ON avatar_messages;
CREATE POLICY "avatar_messages_select_policy" ON avatar_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM webinars
      WHERE webinars.id = webinar_id
      AND (
        webinars.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM contacts 
          WHERE contacts.webinar_id = webinars.id 
          AND contacts.email = auth.email()
        )
      )
    )
  );