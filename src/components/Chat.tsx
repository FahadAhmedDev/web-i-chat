import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { MessageSquare, Send, Users } from 'lucide-react';
import { connectToRoom, disconnectFromRoom, sendMessage } from '../lib/socket';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Database } from '../lib/database.types';

type ChatMessage = Database['public']['Tables']['chat_messages']['Row'];

interface ChatProps {
  webinarId: string;
  sessionId: string;
  preview?: boolean;
  theme?: 'light' | 'dark';
  currentTime?: number;
  isPlaying?: boolean;
  embedded?: boolean;
  userDetails?: {
    firstName: string;
    email: string;
    phoneNumber: string;
  } | null;
  chatEnabled?: boolean;
}

export default function Chat({
  webinarId,
  sessionId,
  preview = false,
  theme = 'light',
  currentTime = 0,
  isPlaying = false,
  embedded = false,
  userDetails = null,
  chatEnabled = true,
}: ChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const roomId = webinarId;
  const shouldScrollToBottom = useRef(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [lastMessageUpdate, setLastMessageUpdate] = useState<number>(0);
  const [sending, setSending] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const checkAdmin = async () => {
      const { data, error } = await supabase
        .from('webinars')
        .select('user_id')
        .eq('id', webinarId)
        .single();

      if (!error && data) {
        setIsAdmin(data.user_id === user.id);
      }
    };

    checkAdmin();
  }, [user, webinarId]);

  useEffect(() => {
    if (preview || !chatEnabled) return;

    const fetchChatHistory = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('webinar_id', webinarId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setMessages(data || []);
      } catch (error) {
        console.error('Error fetching chat history:', error);
        setError('Failed to load chat history');
      }
    };

    fetchChatHistory();
  }, [webinarId, preview, chatEnabled]);

  useEffect(() => {
    if (preview || !chatEnabled) return;

    const handleMessage = (event: CustomEvent<ChatMessage>) => {
      setMessages(prev => {
        const updatedMessages = [...prev, event.detail].sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        requestAnimationFrame(() => setLastMessageUpdate(Date.now()));
        return updatedMessages;
      });
    };

    const handleViewerCount = (event: CustomEvent<number>) => {
      setViewerCount(event.detail);
    };

    window.addEventListener('chat-message' as any, handleMessage as any);
    window.addEventListener('viewer-count' as any, handleViewerCount as any);
    connectToRoom(roomId);

    return () => {
      window.removeEventListener('chat-message' as any, handleMessage as any);
      window.removeEventListener('viewer-count' as any, handleViewerCount as any);
      disconnectFromRoom(roomId);
    };
  }, [roomId, preview, chatEnabled]);

  useEffect(() => {
    if (chatContainerRef.current) {
      if (shouldScrollToBottom.current) {
        requestAnimationFrame(() => {
          const container = chatContainerRef.current;
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        });
      }
    }
  }, [lastMessageUpdate]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      shouldScrollToBottom.current = scrollHeight - (scrollTop + clientHeight) < 100;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!userDetails && !isAdmin) || !newMessage.trim() || !isConnected || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      if (preview) {
        const previewMessage: ChatMessage = {
          id: crypto.randomUUID(),
          webinar_id: webinarId,
          session_id: null,
          user_id: isAdmin ? 'Host' : userDetails?.firstName || '',
          message: messageContent,
          created_at: new Date().toISOString(),
          is_admin: isAdmin,
          is_avatar: false,
        };
        setMessages(prev => [...prev, previewMessage]);
        return;
      }

      const { data, error } = await supabase
        .from('chat_messages')
        .insert([{
          webinar_id: webinarId,
          session_id: null,
          user_id: isAdmin ? 'Host' : userDetails?.firstName || '',
          message: messageContent,
          is_admin: isAdmin,
          is_avatar: false,
        }])
        .select()
        .single();

      if (error) throw error;
      if (data) {
        sendMessage(roomId, data);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
      setNewMessage(messageContent);
    } finally {
      setSending(false);
    }
  };

  if (!chatEnabled) {
    return null;
  }

  const isDark = theme === 'dark';

  return (
    <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-sm flex flex-col h-full`}>
      <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
            <h2 className={`font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
              {preview ? 'Preview Chat' : 'Live Chat'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            {viewerCount > 0 && (
              <div className={`flex items-center gap-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                <Users className="w-4 h-4" />
                <span>{viewerCount}</span>
              </div>
            )}
            {!preview && (
              <div className={`flex items-center gap-2 text-sm ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                {isConnected ? 'Connected' : 'Reconnecting...'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        ref={chatContainerRef}
        className={`flex-1 p-4 overflow-y-auto min-h-0 scroll-smooth ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}
      >
        {error && (
          <div className={`p-3 rounded-lg text-sm ${isDark ? 'bg-red-900 text-red-200' : 'bg-red-50 text-red-600'}`}>
            {error}
          </div>
        )}

        {messages.length === 0 ? (
          <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No messages yet</p>
            <p className="text-sm mt-1">Be the first to start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => {
              const isOwnMessage = (message.is_admin && isAdmin) || (!message.is_avatar && message.user_id === userDetails?.firstName);
              const isAvatarMessage = message.is_avatar;
              
              return (
                <div
                  key={message.id}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      isOwnMessage
                        ? isDark
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-500 text-white'
                        : isAvatarMessage
                          ? isDark
                            ? 'bg-purple-700 text-white'
                            : 'bg-purple-500 text-white'
                          : isDark
                            ? 'bg-gray-700 text-gray-100'
                            : 'bg-white text-gray-900 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-medium ${
                        isOwnMessage 
                          ? 'text-blue-100' 
                          : isAvatarMessage
                            ? 'text-purple-100'
                            : isDark 
                              ? 'text-gray-300' 
                              : 'text-gray-600'
                      }`}>
                        {message.is_admin ? 'Host' : message.user_id}
                      </span>
                      <span className={`text-xs ${
                        isOwnMessage 
                          ? 'text-blue-200' 
                          : isAvatarMessage
                            ? 'text-purple-200'
                            : isDark 
                              ? 'text-gray-400' 
                              : 'text-gray-500'
                      }`}>
                        {format(new Date(message.created_at), 'HH:mm')}
                      </span>
                    </div>
                    <p className="break-words">{message.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <form onSubmit={handleSendMessage} className={`p-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={isAdmin ? "Send a message as host..." : userDetails ? "Type your message..." : "Join chat to send messages"}
            disabled={!userDetails && !isAdmin}
            className={`flex-1 px-4 py-2 rounded-lg ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                : 'bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500'
            } ${!userDetails && !isAdmin && 'cursor-not-allowed'}`}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || !isConnected || (!userDetails && !isAdmin) || sending}
            className={`px-4 py-2 rounded-lg ${
              isDark
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            } transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
          >
            {sending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}