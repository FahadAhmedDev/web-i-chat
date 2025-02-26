ALTER TABLE chat_messages 
ALTER COLUMN user_id TYPE text;

-- Update policies to work with text user_id
DROP POLICY IF EXISTS "Users can insert chat messages if registered" ON chat_messages;

CREATE POLICY "Users can insert chat messages if registered"
  ON chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.webinar_id = chat_messages.webinar_id
      AND contacts.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM webinars
      WHERE webinars.id = chat_messages.webinar_id
      AND webinars.user_id = auth.uid()
    )
  );