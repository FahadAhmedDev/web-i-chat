import { io } from 'socket.io-client';
import { supabase } from './supabase';
import type { Database } from './database.types';

type ChatMessage = Database['public']['Tables']['chat_messages']['Row'];

// Initialize Socket.IO client
const SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? 'wss://fluffy-pegasus-5cb073.netlify.app'
  : 'http://localhost:3000';

const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  path: '/socket.io',
  reconnectionDelays: 1000,
  reconnectionAttempts: 10,
  autoConnect: true
});

// Track active rooms and their event handlers
const activeRooms = new Map<string, {
  messageHandler: (message: ChatMessage) => void;
  viewerHandler: (count: number) => void;
}>();

// Connection state
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// Set up connection event handlers
socket.on('connect', () => {
  console.log('Connected to Socket.IO server');
  isConnected = true;
  reconnectAttempts = 0;
  
  // Rejoin all active rooms after reconnection
  for (const roomId of activeRooms.keys()) {
    socket.emit('join-room', roomId);
  }
});

socket.on('disconnect', () => {
  console.log('Disconnected from Socket.IO server');
  isConnected = false;
});

socket.on('error', (error) => {
  console.error('Socket.IO error:', error);
  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    setTimeout(() => {
      socket.connect();
    }, 1000 * Math.pow(2, reconnectAttempts)); // Exponential backoff
  }
});

export const connectToRoom = (roomId: string) => {
  if (activeRooms.has(roomId)) return;

  // Create message handler
  const messageHandler = (message: ChatMessage) => {
    const event = new CustomEvent('chat-message', { detail: message });
    window.dispatchEvent(event);
  };

  // Create viewer count handler
  const viewerHandler = (count: number) => {
    const event = new CustomEvent('viewer-count', { detail: count });
    window.dispatchEvent(event);
  };

  // Store handlers
  activeRooms.set(roomId, {
    messageHandler,
    viewerHandler
  });

  // Set up Socket.IO event listeners
  const webinarRoomId = roomId.split(':')[0];
  socket.on(`chat-message-${webinarRoomId}`, messageHandler);
    socket.on(`viewer-count-${roomId}`, viewerHandler);

  // Join room
  socket.emit('join-room', roomId);
};

export const disconnectFromRoom = (roomId: string) => {
  const handlers = activeRooms.get(roomId);
  if (!handlers) return;

  // Remove event listeners
  socket.off(`chat-message-${roomId}`, handlers.messageHandler);
  socket.off(`viewer-count-${roomId}`, handlers.viewerHandler);

  // Leave room
  socket.emit('leave-room', roomId);
  activeRooms.delete(roomId);
};

export const sendMessage = async (roomId: string, message: ChatMessage) => {
  try {
    // Generate a unique ID for the message
    const messageId = crypto.randomUUID();
    
    // Save message to database
    const { data, error } = await supabase
      .from('chat_messages')
      .insert([{
        id: messageId,
        webinar_id: message.webinar_id,
        session_id: message.session_id,
        user_id: message.user_id,
        message: message.message,
        is_admin: message.is_admin,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    // Broadcast through Socket.IO
    socket.emit('chat-message', { roomId, ...data });

    return data;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

// Export connection status
export const getConnectionStatus = () => ({
  isConnected,
  reconnectAttempts,
});

// Export socket instance for direct access if needed
export { socket };