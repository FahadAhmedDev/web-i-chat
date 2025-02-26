import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Settings, Palette, Clock, Users, Share2, Maximize2, Minimize2, Pencil, Calendar, Plus, Trash2, Check } from 'lucide-react';
import { useStore } from '../lib/store';
import AvatarMessageManager from '../components/AvatarMessageManager';
import VideoPlayer from '../components/VideoPlayer';
import Chat from '../components/Chat';
import { format, addSeconds, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';

type Tab = 'basic' | 'design' | 'schedule' | 'avatars' | 'publishing';

interface WebinarSettings {
  theme: 'light' | 'dark';
  viewCount: number;
  showLiveIndicator: boolean;
  chatEnabled: boolean;
}

const defaultSettings: WebinarSettings = {
  theme: 'light',
  viewCount: 100,
  showLiveIndicator: true,
  chatEnabled: true,
};

interface SessionFormData {
  startTime: string;
  timezone: string;
  recurrence: 'daily' | 'weekly' | 'monthly' | null;
}

const defaultSessionForm: SessionFormData = {
  startTime: '',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  recurrence: null,
};

interface RecurringSession {
  type: 'daily' | 'weekly' | 'monthly';
  time: string;
  timezone: string;
}

interface UserDetails {
  firstName: string;
  email: string;
  phoneNumber: string;
}

export default function WebinarSettings() {
  const { id } = useParams<{ id: string }>();
  const { webinars, sessions, avatarMessages, fetchWebinars, fetchWebinarSessions, updateWebinar, createSession, updateSession, deleteSession, fetchAvatarMessages } = useStore();
  const [activeTab, setActiveTab] = useState<Tab>('basic');
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [formValues, setFormValues] = useState({
    title: '',
    description: '',
    videoUrl: '',
    viewCount: defaultSettings.viewCount,
    showLiveIndicator: defaultSettings.showLiveIndicator,
    chatEnabled: defaultSettings.chatEnabled,
  });
  const [sessionForm, setSessionForm] = useState<SessionFormData>(defaultSessionForm);
  const [editingAvatarMessage, setEditingAvatarMessage] = useState<string | null>(null);
  const [recurringSession, setRecurringSession] = useState<RecurringSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const isEmbedded = window.self !== window.top;
  const [currentSession, setCurrentSession] = useState<string | null>(null);

  // Fetch initial data
  useEffect(() => {
    if (id) {
      fetchWebinars(id);
      fetchWebinarSessions(id);
      fetchAvatarMessages(id);
    }
  }, [id]);

  const webinar = webinars.find((w) => w.id === id);
  const settings: WebinarSettings = {
    ...defaultSettings,
    ...(webinar?.settings as Partial<WebinarSettings> || {})
  };

  // Update form values when webinar changes
  useEffect(() => {
    const tempSessionId = crypto.randomUUID();
    setCurrentSession(tempSessionId);

    if (webinar) {
      setFormValues({
        title: webinar.title || '',
        description: webinar.description || '',
        videoUrl: webinar.video_url || '',
        viewCount: settings.viewCount,
        showLiveIndicator: settings.showLiveIndicator,
        chatEnabled: settings.chatEnabled,
      });
    }
  }, [webinar?.id, settings.viewCount, settings.showLiveIndicator, settings.chatEnabled]);

  // Update session form when editing
  useEffect(() => {
    if (editingSession) {
      const session = sessions.find(s => s.id === editingSession);
      if (session) {
        setSessionForm({
          startTime: format(new Date(session.start_time), "yyyy-MM-dd'T'HH:mm"),
          timezone: session.timezone,
          recurrence: null,
        });
        setShowSessionModal(true);
      }
    } else {
      setSessionForm(defaultSessionForm);
    }
  }, [editingSession, sessions]);

  const handleUpdateWebinar = async (data: Partial<typeof webinar>) => {
    if (!webinar) return;
    await updateWebinar(webinar.id, data);
  };

  const handleUpdateSettings = async (newSettings: Partial<WebinarSettings>) => {
    if (!webinar) return;
    const updatedSettings = { ...settings, ...newSettings };
    await updateWebinar(webinar.id, {
      settings: updatedSettings,
    });
  };

  const hasTimeConflict = (startTime: string, endTime: string, excludeSessionId?: string) => {
    return sessions.some(session => {
      if (excludeSessionId && session.id === excludeSessionId) return false;
      
      const newStart = new Date(startTime).getTime();
      const newEnd = new Date(endTime).getTime();
      const existingStart = new Date(session.start_time).getTime();
      const existingEnd = new Date(session.end_time).getTime();

      return (
        (newStart >= existingStart && newStart < existingEnd) ||
        (newEnd > existingStart && newEnd <= existingEnd) ||
        (newStart <= existingStart && newEnd >= existingEnd)
      );
    });
  };

  const handleSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webinar) return;

    const startDate = new Date(sessionForm.startTime);
    const endDate = addSeconds(startDate, webinar.duration);

    if (hasTimeConflict(
      startDate.toISOString(),
      endDate.toISOString(),
      editingSession || undefined
    )) {
      setError('This time slot conflicts with an existing session');
      return;
    }

    if (sessionForm.recurrence) {
      setRecurringSession({
        type: sessionForm.recurrence,
        time: sessionForm.startTime,
        timezone: sessionForm.timezone,
      });
    }

    const sessionData = {
      webinar_id: webinar.id,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      timezone: sessionForm.timezone,
    };

    if (editingSession) {
      await updateSession(editingSession, sessionData);
    } else {
      await createSession({
        ...sessionData,
        recurrence: sessionForm.recurrence,
      });
    }

    setShowSessionModal(false);
    setEditingSession(null);
    setSessionForm(defaultSessionForm);
  };

  const handleCloseModal = () => {
    setShowSessionModal(false);
    setEditingSession(null);
    setSessionForm(defaultSessionForm);
  };

  const toggleSessionSelection = (sessionId: string) => {
    const newSelected = new Set(selectedSessions);
    if (newSelected.has(sessionId)) {
      newSelected.delete(sessionId);
    } else {
      newSelected.add(sessionId);
    }
    setSelectedSessions(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedSessions.size === sessions.length) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(sessions.map(s => s.id)));
    }
  };

  const handleDeleteSelected = async () => {
    try {
      for (const sessionId of selectedSessions) {
        await deleteSession(sessionId);
      }
      setSelectedSessions(new Set());
      setIsSelectionMode(false);
      setShowDeleteConfirmation(false);
    } catch (error) {
      console.error('Error deleting sessions:', error);
      setError('Failed to delete selected sessions');
    }
  };

  const getRecurringText = (session: RecurringSession) => {
    const time = format(parseISO(session.time), 'h:mm a');
    switch (session.type) {
      case 'daily':
        return `Daily at ${time}`;
      case 'weekly':
        return `Weekly at ${time}`;
      case 'monthly':
        return `Monthly at ${time}`;
      default:
        return `At ${time}`;
    }
  };

  const handleUserDetails = async (details: UserDetails) => {
    setJoinLoading(true);
    setJoinError(null);
    try {
      const { error } = await supabase.from('contacts').insert([{
        webinar_id: id,
        name: details.firstName,
        email: details.email,
        phone: details.phoneNumber,
        created_at: new Date().toISOString()
      }]);

      if (error && error.code !== '23505') {
        throw error;
      }

      setUserDetails(details);
      localStorage.setItem(`chat_contact_${id}`, JSON.stringify({
        name: details.firstName,
        email: details.email,
        phone: details.phoneNumber
      }));
      setShowJoinModal(false);
    } catch (error) {
      console.error('Error saving contact:', error);
      setJoinError('Failed to join webinar. Please try again.');
    } finally {
      setJoinLoading(false);
    }
  };

  const renderTabContent = () => {
    if (!webinar) return null;

    switch (activeTab) {
      case 'basic':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={formValues.title}
                onChange={(e) => {
                  setFormValues(prev => ({ ...prev, title: e.target.value }));
                  handleUpdateWebinar({ title: e.target.value });
                }}
                className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formValues.description}
                onChange={(e) => {
                  setFormValues(prev => ({ ...prev, description: e.target.value }));
                  handleUpdateWebinar({ description: e.target.value });
                }}
                rows={4}
                className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Video URL
              </label>
              <input
                type="url"
                value={formValues.videoUrl}
                onChange={(e) => {
                  setFormValues(prev => ({ ...prev, videoUrl: e.target.value }));
                  handleUpdateWebinar({ video_url: e.target.value });
                }}
                className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  View Count
                </label>
                <input
                  type="number"
                  min="0"
                  value={formValues.viewCount}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    setFormValues(prev => ({ ...prev, viewCount: value }));
                    handleUpdateSettings({ viewCount: value });
                  }}
                  className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Number of viewers shown during the webinar
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Live Indicator
                </label>
                <div className="mt-2">
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={formValues.showLiveIndicator}
                      onChange={(e) => {
                        setFormValues(prev => ({ ...prev, showLiveIndicator: e.target.checked }));
                        handleUpdateSettings({ showLiveIndicator: e.target.checked });
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-600">Show live indicator</span>
                  </label>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Display the "LIVE" badge during the webinar
                </p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chat Settings
              </label>
              <div className="mt-2">
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={formValues.chatEnabled}
                    onChange={(e) => {
                      setFormValues(prev => ({ ...prev, chatEnabled: e.target.checked }));
                      handleUpdateSettings({ chatEnabled: e.target.checked });
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-600">Enable chat</span>
                </label>
                <p className="mt-1 text-sm text-gray-500">
                  Allow viewers to chat during the webinar. When disabled, the chat interface will not be shown.
                </p>
              </div>
            </div>
          </div>
        );

      case 'design':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Theme Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  className={`p-4 rounded-lg border-2 cursor-pointer ${
                    settings.theme === 'light'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleUpdateSettings({ theme: 'light' })}
                >
                  <div className="bg-white p-4 rounded-md shadow-sm mb-2">
                    <div className="h-4 w-3/4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 w-1/2 bg-gray-200 rounded"></div>
                  </div>
                  <p className="text-sm font-medium text-gray-900">Light Theme</p>
                </div>
                <div
                  className={`p-4 rounded-lg border-2 cursor-pointer ${
                    settings.theme === 'dark'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleUpdateSettings({ theme: 'dark' })}
                >
                  <div className="bg-gray-900 p-4 rounded-md shadow-sm mb-2">
                    <div className="h-4 w-3/4 bg-gray-700 rounded mb-2"></div>
                    <div className="h-4 w-1/2 bg-gray-700 rounded"></div>
                  </div>
                  <p className="text-sm font-medium text-gray-900">Dark Theme</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'schedule':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Sessions</h3>
              <div className="flex items-center gap-2">
                {sessions.length > 0 && !recurringSession && (
                  <button
                    onClick={() => setIsSelectionMode(!isSelectionMode)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    {isSelectionMode ? 'Cancel Selection' : 'Select Sessions'}
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditingSession(null);
                    setShowSessionModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Session
                </button>
              </div>
            </div>

            {sessions.length === 0 && !recurringSession ? (
              <div className="text-center py-12 text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg">No sessions scheduled</p>
                <p className="text-sm mt-1">Add a session to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recurringSession && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className="font-medium text-gray-900">
                            {getRecurringText(recurringSession)}
                          </p>
                          <p className="text-sm text-gray-500">
                            {recurringSession.timezone}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setRecurringSession(null)}
                        className="text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        Remove Recurring Schedule
                      </button>
                    </div>
                  </div>
                )}

                {!recurringSession && sessions.length > 0 && (
                  <>
                    {isSelectionMode && (
                      <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center gap-4">
                          <button
                            onClick={toggleSelectAll}
                            className="text-sm text-gray-600 hover:text-gray-900"
                          >
                            {selectedSessions.size === sessions.length ? 'Deselect All' : 'Select All'}
                          </button>
                          <span className="text-sm text-gray-600">
                            {selectedSessions.size} selected
                          </span>
                        </div>
                        {selectedSessions.size > 0 && (
                          <button
                            onClick={() => setShowDeleteConfirmation(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete Selected
                          </button>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      {sessions
                        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                        .map((session) => {
                          const startTime = new Date(session.start_time);
                          const endTime = new Date(session.end_time);
                          const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

                          return (
                            <div
                              key={session.id}
                              className={`flex items-center justify-between p-4 rounded-lg ${
                                isSelectionMode
                                  ? selectedSessions.has(session.id)
                                    ? 'bg-blue-50 border border-blue-200'
                                    : 'bg-gray-50 border border-gray-200'
                                  : 'bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center gap-4">
                                {isSelectionMode && (
                                  <button
                                    onClick={() => toggleSessionSelection(session.id)}
                                    className={`p-2 rounded-full ${
                                      selectedSessions.has(session.id)
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-white border border-gray-300'
                                    }`}
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                )}
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {startTime.toLocaleString(undefined, {
                                      dateStyle: 'full',
                                      timeStyle: 'short',
                                    })}
                                  </p>
                                  <div className="space-y-1">
                                    <p className="text-sm text-gray-500">
                                      Duration: {duration} minutes ({session.timezone})
                                    </p>
                                    {recurringSession && format(startTime, 'HH:mm') === format(parseISO(recurringSession.time), 'HH:mm') && (
                                      <p className="text-sm text-blue-600 font-medium">
                                        {getRecurringText(recurringSession)}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {!isSelectionMode && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setEditingSession(session.id)}
                                    className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
                                    title="Edit session"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                      onClick={() => {
                                        const confirmed = window.confirm("Are you sure you want to delete?");
                                        if (confirmed) {
                                          deleteSession(session.id);
                                        }
                                      }}
                                      className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                                      title="Delete session"
                                    >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );

      case 'avatars':
        return (
          <AvatarMessageManager
            webinarId={webinar.id}
            currentTime={currentTime}
            editingMessageId={editingAvatarMessage}
          />
        );

      case 'publishing':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Share Your Webinar</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Public URL:</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={`${window.location.origin}/webinar/${webinar.id}`}
                    readOnly
                    className="flex-1 rounded-lg border-gray-300 bg-white focus:border-blue-500 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/webinar/${webinar.id}`
                      );
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Embed Code</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Add this code to your website:</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={`<iframe src="${window.location.origin}/webinar/${webinar.id}" width="100%" height="600" frameborder="0"></iframe>`}
                    readOnly
                    className="flex-1 rounded-lg border-gray-300 bg-white focus:border-blue-500 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `<iframe src="${window.location.origin}/webinar/${webinar.id}" width="100%" height="600" frameborder="0"></iframe>`
                      );
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  if (!webinar) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b px-6 py-4">
          <h1 className="text-xl font-semibold text-gray-900">Webinar Settings</h1>
          <p className="text-sm text-gray-500 mt-1">{webinar.title}</p>
        </div>

        {showPreview && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-6 border-b">
            <div className="lg:col-span-3">
              <div className="rounded-lg overflow-hidden">
                <VideoPlayer
                  url={webinar.video_url}
                  preview={true}
                  onDuration={(duration) => {
                    if (duration !== webinar.duration) {
                      handleUpdateWebinar({ duration: Math.round(duration) });
                    }
                  }}
                  onCurrentTime={setCurrentTime}
                  onPlayingChange={setIsPlaying}
                  avatarMarkers={avatarMessages.map(msg => ({
                    id: msg.id,
                    timestamp: msg.timestamp,
                    name: msg.name,
                    message: msg.message,
                  }))}
                  onAvatarClick={(id) => {
                    setActiveTab('avatars');
                    setEditingAvatarMessage(id);
                  }}
                  theme={settings.theme}
                  viewCount={formValues.viewCount}
                  showLiveIndicator={formValues.showLiveIndicator}
                />
              </div>
            </div>
            <div className="h-[600px]">
              <Chat
                webinarId={webinar.id}
                sessionId={currentSession}
                theme={settings.theme}
                currentTime={currentTime}
                isPlaying={isPlaying}
                embedded={isEmbedded}
                userDetails={{ 
                  firstName: "Host",
                  email: "host@example.com",
                  phoneNumber: ""
                }}
                chatEnabled={settings.chatEnabled}
              />
            </div>
          </div>
        )}

        <div className="px-6 py-2 border-b flex justify-end">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            {showPreview ? (
              <>
                <Minimize2 className="w-4 h-4" />
                Hide Preview
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4" />
                Show Preview
              </>
            )}
          </button>
        </div>

        <div className="border-b">
          <nav className="flex space-x-4 px-6" aria-label="Tabs">
            {[
              { id: 'basic', label: 'Basic Settings', icon: Settings },
              { id: 'design', label: 'Design', icon: Palette },
              { id: 'schedule', label: 'Schedule', icon: Clock },
              { id: 'avatars', label: 'Avatars', icon: Users },
              { id: 'publishing', label: 'Publishing', icon: Share2 },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as Tab)}
                className={`flex items-center gap-2 py-4 px-2 border-b-2 text-sm font-medium ${
                  activeTab === id
                    ? 'border-blue-500  text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>
        
        <div className="p-6">
          {renderTabContent()}
        </div>
      </div>

      {showSessionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-semibold mb-4">
              {editingSession ? 'Edit Session' : 'Add New Session'}
            </h2>
            <form onSubmit={handleSessionSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time
                </label>
                <input
                  type="datetime-local"
                  value={sessionForm.startTime}
                  onChange={(e) => setSessionForm({ ...sessionForm, startTime: e.target.value })}
                  required
                  className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Session duration will match the video length ({Math.floor(webinar.duration / 60)} minutes)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Timezone
                </label>
                <select
                  value={sessionForm.timezone}
                  onChange={(e) => setSessionForm({ ...sessionForm, timezone: e.target.value })}
                  className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                >
                  {Intl.supportedValuesOf('timeZone').map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
              {!editingSession && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recurrence
                  </label>
                  <select
                    value={sessionForm.recurrence || ''}
                    onChange={(e) => setSessionForm({ 
                      ...sessionForm, 
                      recurrence: e.target.value as 'daily' | 'weekly' | 'monthly' | null 
                    })}
                    className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">No recurrence</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingSession ? 'Save Changes' : 'Add Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-semibold mb-2">Delete Sessions</h2>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete {selectedSessions.size} selected {selectedSessions.size === 1 ? 'session' : 'sessions'}? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirmation(false)}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSelected}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Selected
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}