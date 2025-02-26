import { useState, useCallback } from 'react';
import type { Database } from '../lib/database.types';

type ChatMessage = Database['public']['Tables']['chat_messages']['Row'];

const AVATAR_MESSAGES = [
  "This is really interesting! Thanks for sharing.",
  "Could you explain that in more detail?",
  "Great presentation so far!",
  "I'm learning a lot from this webinar.",
  "That's a fascinating point.",
  "How does this compare to other approaches?",
  "Thanks for addressing my question!",
  "The examples are very helpful.",
  "Looking forward to trying this out.",
  "This is exactly what I was looking for.",
  "Can you share some real-world applications?",
  "The visuals really help explain the concept.",
  "I appreciate the step-by-step explanation.",
  "This will be very useful in my work.",
  "Excellent presentation!",
];

const AVATAR_NAMES = [
  "Sarah",
  "Michael",
  "Emma",
  "David",
  "Lisa",
  "James",
  "Anna",
  "John",
  "Maria",
  "Robert",
];

export function useAvatarMessages(enabled: boolean = false) {
  const [avatarMessages, setAvatarMessages] = useState<ChatMessage[]>([]);

  const triggerAvatarMessage = useCallback(() => {
    if (!enabled) return;

    const randomMessage = AVATAR_MESSAGES[Math.floor(Math.random() * AVATAR_MESSAGES.length)];
    const randomName = AVATAR_NAMES[Math.floor(Math.random() * AVATAR_NAMES.length)];
    
    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      webinar_id: '',  // Not needed for preview
      session_id: '',  // Not needed for preview
      user_id: randomName,  // Using name as ID for avatars
      message: randomMessage,
      created_at: new Date().toISOString(),
      is_admin: false,
    };

    setAvatarMessages(prev => [...prev, newMessage]);

    // 30% chance to trigger another message after a delay
    if (Math.random() < 0.3) {
      setTimeout(() => {
        triggerAvatarMessage();
      }, Math.random() * 5000 + 2000); // Random delay between 2-7 seconds
    }
  }, [enabled]);

  return {
    avatarMessages,
    triggerAvatarMessage,
  };
}