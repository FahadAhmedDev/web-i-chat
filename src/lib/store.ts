import { create } from 'zustand';
import { supabase } from './supabase';
import { Database } from './database.types';
import { addDays, addWeeks, addMonths, parseISO } from 'date-fns';

type Webinar = Database['public']['Tables']['webinars']['Row'];
type WebinarSession = Database['public']['Tables']['webinar_sessions']['Row'];
type AvatarMessage = Database['public']['Tables']['avatar_messages']['Row'];

interface RecurringSession {
  type: 'daily' | 'weekly' | 'monthly';
  startTime: string;
  timezone: string;
}

interface WebinarStore {
  webinars: Webinar[];
  currentWebinar: Webinar | null;
  sessions: WebinarSession[];
  avatarMessages: AvatarMessage[];
  loading: boolean;
  error: string | null;
  recurringSession: RecurringSession | null;
  setRecurringSession: (session: RecurringSession | null) => void;
  fetchWebinars: (id?: string) => Promise<void>;
  createWebinar: (data: Omit<Webinar, 'id' | 'created_at'>) => Promise<void>;
  updateWebinar: (id: string, data: Partial<Webinar>) => Promise<void>;
  deleteWebinar: (id: string) => Promise<void>;
  fetchWebinarSessions: (webinarId: string) => Promise<void>;
  createSession: (data: Omit<WebinarSession, 'id'> & { recurrence?: 'daily' | 'weekly' | 'monthly' | null }) => Promise<void>;
  updateSession: (id: string, data: Partial<WebinarSession>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  fetchAvatarMessages: (webinarId: string) => Promise<void>;
  createAvatarMessage: (data: Omit<AvatarMessage, 'id' | 'created_at'>) => Promise<void>;
  deleteAvatarMessage: (id: string) => Promise<void>;
}

export const useStore = create<WebinarStore>((set, get) => ({
  webinars: [],
  currentWebinar: null,
  sessions: [],
  avatarMessages: [],
  loading: false,
  error: null,
  recurringSession: null,
  setRecurringSession: (session) => set({ recurringSession: session }),

  fetchWebinars: async (id?: string) => {
    set({ loading: true, error: null });
    try {
      let query = supabase.from('webinars').select('*');
      
      if (id) {
        query = query.eq('id', id);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      set({ webinars: data });
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  createWebinar: async (data) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.from('webinars').insert([data]);
      if (error) throw error;
      get().fetchWebinars();
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  updateWebinar: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('webinars')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
      await get().fetchWebinars(id);
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  deleteWebinar: async (id) => {
    set({ loading: true, error: null });
    try {
      // Delete all related data in order
      
      // 1. Delete contacts
      const { error: contactsError } = await supabase
        .from('contacts')
        .delete()
        .eq('webinar_id', id);
      
      if (contactsError) throw contactsError;

      // 2. Delete chat messages
      const { error: chatError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('webinar_id', id);
      
      if (chatError) throw chatError;

      // 3. Delete avatar messages
      const { error: avatarError } = await supabase
        .from('avatar_messages')
        .delete()
        .eq('webinar_id', id);
      
      if (avatarError) throw avatarError;

      // 4. Delete sessions
      const { error: sessionsError } = await supabase
        .from('webinar_sessions')
        .delete()
        .eq('webinar_id', id);
      
      if (sessionsError) throw sessionsError;

      // 5. Finally delete the webinar
      const { error: webinarError } = await supabase
        .from('webinars')
        .delete()
        .eq('id', id);
      
      if (webinarError) throw webinarError;

      // 6. Refresh the webinars list
      await get().fetchWebinars();
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  fetchWebinarSessions: async (webinarId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('webinar_sessions')
        .select('*')
        .eq('webinar_id', webinarId)
        .order('start_time', { ascending: true });

      if (error) throw error;
      set({ sessions: data });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  createSession: async ({ recurrence, ...data }) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.from('webinar_sessions').insert([data]);
      if (error) throw error;

      if (recurrence) {
        set({ recurringSession: {
          type: recurrence,
          startTime: data.start_time,
          timezone: data.timezone
        }});
      }
      
      get().fetchWebinarSessions(data.webinar_id);
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  updateSession: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('webinar_sessions')
        .update(data)
        .eq('id', id);

      if (error) throw error;
      
      const session = get().sessions.find(s => s.id === id);
      if (session) {
        get().fetchWebinarSessions(session.webinar_id);
      }
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  deleteSession: async (id) => {
    set({ loading: true, error: null });
    try {
      const session = get().sessions.find(s => s.id === id);
      if (!session) throw new Error('Session not found');

      const { error } = await supabase
        .from('webinar_sessions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      get().fetchWebinarSessions(session.webinar_id);
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  fetchAvatarMessages: async (webinarId: string) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('avatar_messages')
        .select('*')
        .eq('webinar_id', webinarId)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      set({ avatarMessages: data });
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  createAvatarMessage: async (data) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('avatar_messages')
        .insert([data]);

      if (error) throw error;
      get().fetchAvatarMessages(data.webinar_id);
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  deleteAvatarMessage: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase
        .from('avatar_messages')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      const webinarId = get().avatarMessages.find(m => m.id === id)?.webinar_id;
      if (webinarId) {
        get().fetchAvatarMessages(webinarId);
      }
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },
}));