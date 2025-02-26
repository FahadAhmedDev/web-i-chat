import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Clock, Edit2 } from 'lucide-react';
import { useStore } from '../lib/store';
import type { Database } from '../lib/database.types';

type AvatarMessage = Database['public']['Tables']['avatar_messages']['Row'];

interface AvatarMessageManagerProps {
  webinarId: string;
  currentTime: number;
  editingMessageId?: string | null;
}

export default function AvatarMessageManager({ 
  webinarId, 
  currentTime,
  editingMessageId 
}: AvatarMessageManagerProps) {
  const { avatarMessages, createAvatarMessage, deleteAvatarMessage, fetchAvatarMessages } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [timestamp, setTimestamp] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAvatarMessages(webinarId);
  }, [webinarId]);

  useEffect(() => {
    if (editingMessageId) {
      const message = avatarMessages.find(msg => msg.id === editingMessageId);
      if (message) {
        setName(message.name);
        setMessage(message.message);
        setTimestamp(message.timestamp);
        setShowModal(true);
      }
    }
  }, [editingMessageId, avatarMessages]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(1);
    return `${minutes}:${remainingSeconds.padStart(4, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (!name.trim() || !message.trim()) {
        throw new Error('Name and message are required');
      }

      await createAvatarMessage({
        webinar_id: webinarId,
        name: name.trim(),
        message: message.trim(),
        timestamp: Number(timestamp.toFixed(1)), // Round to 1 decimal place
      });

      setShowModal(false);
      setName('');
      setMessage('');
      setTimestamp(0);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create avatar message');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAvatarMessage(id);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete avatar message');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Avatar Messages</h3>
        <button
          onClick={() => {
            setTimestamp(Number(currentTime.toFixed(1))); // Round to 1 decimal place
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Message
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg">
          {error}
        </div>
      )}

      {avatarMessages.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
          <Clock className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg">No avatar messages</p>
          <p className="text-sm mt-1">Add messages to appear during the webinar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {avatarMessages
            .sort((a, b) => a.timestamp - b.timestamp)
            .map((msg) => (
              <div
                key={msg.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{msg.name}</span>
                    <span className="text-sm text-gray-500">
                      at {formatTime(msg.timestamp)}
                    </span>
                  </div>
                  <p className="text-gray-600 mt-1">{msg.message}</p>
                </div>
                <button
                  onClick={() => handleDelete(msg.id)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  title="Delete message"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-semibold mb-4">Add Avatar Message</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Avatar Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="e.g., John Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Enter the message..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Timestamp
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={timestamp.toString()} // Convert to string to avoid NaN warning
                    onChange={(e) => setTimestamp(Number(parseFloat(e.target.value).toFixed(1)))}
                    step="0.1"
                    min="0"
                    className="w-24 rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-500">seconds</span>
                  <button
                    type="button"
                    onClick={() => setTimestamp(Number(currentTime.toFixed(1)))}
                    className="ml-2 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                  >
                    Use Current Time
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Message
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}