export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      webinars: {
        Row: {
          id: string
          created_at: string
          title: string
          description: string
          user_id: string
          video_url: string
          duration: number
          settings: Json
        }
        Insert: {
          id?: string
          created_at?: string
          title: string
          description: string
          user_id: string
          video_url: string
          duration: number
          settings?: Json
        }
        Update: {
          id?: string
          created_at?: string
          title?: string
          description?: string
          user_id?: string
          video_url?: string
          duration?: number
          settings?: Json
        }
      }
      webinar_sessions: {
        Row: {
          id: string
          webinar_id: string
          start_time: string
          end_time: string
          timezone: string
        }
        Insert: {
          id?: string
          webinar_id: string
          start_time: string
          end_time: string
          timezone: string
        }
        Update: {
          id?: string
          webinar_id?: string
          start_time?: string
          end_time?: string
          timezone?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          webinar_id: string
          session_id: string
          user_id: string // Changed from uuid to string
          message: string
          created_at: string
          is_admin: boolean
          is_avatar?: boolean
          timestamp?: number
        }
        Insert: {
          id?: string
          webinar_id: string
          session_id: string
          user_id: string // Changed from uuid to string
          message: string
          created_at?: string
          is_admin: boolean
        }
        Update: {
          id?: string
          webinar_id?: string
          session_id?: string
          user_id?: string // Changed from uuid to string
          message?: string
          created_at?: string
          is_admin?: boolean
        }
      }
      avatar_messages: {
        Row: {
          id: string
          webinar_id: string
          name: string
          message: string
          timestamp: number
          created_at: string
        }
        Insert: {
          id?: string
          webinar_id: string
          name: string
          message: string
          timestamp: number
          created_at?: string
        }
        Update: {
          id?: string
          webinar_id?: string
          name?: string
          message?: string
          timestamp?: number
          created_at?: string
        }
      }
      contacts: {
        Row: {
          id: string
          webinar_id: string
          user_id: string
          name: string
          email: string
          phone: string | null
          created_at: string
        }
        Insert: {
          id?: string
          webinar_id: string
          user_id: string
          name: string
          email: string
          phone?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          webinar_id?: string
          user_id?: string
          name?: string
          email?: string
          phone?: string | null
          created_at?: string
        }
      }
      attendees: {
        Row: {
          id: string
          webinar_id: string
          session_id: string
          name: string
          email: string
          created_at: string
        }
        Insert: {
          id?: string
          webinar_id: string
          session_id: string
          name: string
          email: string
          created_at?: string
        }
        Update: {
          id?: string
          webinar_id?: string
          session_id?: string
          name?: string
          email?: string
          created_at?: string
        }
      }
    }
  }
}