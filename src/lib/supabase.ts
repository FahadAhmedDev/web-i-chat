import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Retry configuration with exponential backoff
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 500; // 500ms initial delay

// Retry helper function
export async function withRetry<T>(
  operation: () => Promise<T>,
  options = {
    retries: MAX_RETRIES,
    delay: INITIAL_RETRY_DELAY,
    onRetry: (attempt: number) => {}
  }
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // Only retry on network errors or rate limits
    if (options.retries > 0 && (
      error instanceof Error && (
        error.message.includes('fetch') ||
        error.message.includes('Failed to fetch') ||
        error.message.includes('Network request failed')
      )
    )) {
      await new Promise(resolve => setTimeout(resolve, options.delay));
      options.onRetry(MAX_RETRIES - options.retries + 1);
      return withRetry(operation, {
        ...options,
        retries: options.retries - 1,
        delay: options.delay * 2
      });
    }
    throw error;
  }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  realtime: {
    params: {
      eventsPerSecond: 40,
    },
    config: {
      broadcast: { self: true },
      presence: { key: 'chat' },
    },
  },
  db: {
    schema: 'public',
  },
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      'Cache-Control': 'no-cache',
    },
  },
});