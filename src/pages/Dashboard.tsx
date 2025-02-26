import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Users, Video, Plus, Pencil, Eye, Trash2, Radio, AlertTriangle, Clock, Calendar, BarChart as ChartBar } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../lib/store';
import VideoThumbnail from '../components/VideoThumbnail';
import { format, formatDistanceToNow } from 'date-fns';
import { supabase } from '../lib/supabase';

interface DashboardStats {
  totalViews: number;
  activeWebinars: number;
  totalAttendees: number;
  upcomingWebinars: number;
  totalContacts: number;
  averageAttendance: number;
  totalSessions: number;
  completionRate: number;
  contactGrowth: string;
  recentContacts: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { webinars, sessions, fetchWebinars, fetchWebinarSessions, createWebinar, deleteWebinar, loading } = useStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [webinarStatus, setWebinarStatus] = useState<Record<string, { isLive: boolean; nextSession: Date | null }>>({});
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalViews: 0,
    activeWebinars: 0,
    totalAttendees: 0,
    upcomingWebinars: 0,
    totalContacts: 0,
    averageAttendance: 0,
    totalSessions: 0,
    completionRate: 0,
    contactGrowth: '0%',
    recentContacts: 0
  });

  useEffect(() => {
    fetchWebinars();
  }, []);

  useEffect(() => {
    const fetchAllSessions = async () => {
      for (const webinar of webinars) {
        await fetchWebinarSessions(webinar.id);
      }
    };
    fetchAllSessions();
  }, [webinars]);

  useEffect(() => {
    const updateStatus = () => {
      const now = new Date();
      const status: Record<string, { isLive: boolean; nextSession: Date | null }> = {};

      webinars.forEach(webinar => {
        const webinarSessions = sessions.filter(s => s.webinar_id === webinar.id);
        const currentSession = webinarSessions.find(
          session =>
            new Date(session.start_time) <= now && new Date(session.end_time) >= now
        );

        const upcomingSessions = webinarSessions
          .filter(session => new Date(session.start_time) > now)
          .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

        status[webinar.id] = {
          isLive: !!currentSession,
          nextSession: upcomingSessions.length > 0 ? new Date(upcomingSessions[0].start_time) : null,
        };
      });

      setWebinarStatus(status);
    };

    updateStatus();
    const interval = setInterval(updateStatus, 1000);
    return () => clearInterval(interval);
  }, [webinars, sessions]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      try {
        // Get total contacts
        const { data: contacts, error: contactsError } = await supabase
          .from('contacts')
          .select('id, webinar_id, created_at', { count: 'exact' })
          .in('webinar_id', webinars.map(w => w.id));

        if (contactsError) throw contactsError;

        // Get total views from webinar settings
        const totalViews = webinars.reduce((total, webinar) => {
          const settings = webinar.settings as any;
          return total + (settings?.viewCount || 0);
        }, 0);

        // Calculate active and upcoming webinars
        const now = new Date();
        const activeWebinars = sessions.filter(session => {
          const startTime = new Date(session.start_time);
          const endTime = new Date(session.end_time);
          return now >= startTime && now <= endTime;
        }).length;

        const upcomingWebinars = sessions.filter(session =>
          new Date(session.start_time) > now
        ).length;

        // Calculate completion rate
        const completedSessions = sessions.filter(session => 
          new Date(session.end_time) < now
        ).length;

        const completionRate = sessions.length > 0 
          ? (completedSessions / sessions.length) * 100 
          : 0;

        // Calculate average attendance per webinar
        const webinarAttendees = contacts?.reduce((acc, contact) => {
          acc[contact.webinar_id] = (acc[contact.webinar_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {};

        const totalAttendees = Object.values(webinarAttendees).reduce((sum, count) => sum + count, 0);
        const averageAttendance = webinars.length > 0 ? totalAttendees / webinars.length : 0;

        // Calculate growth trends
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        
        const recentContacts = contacts?.filter(c => 
          new Date(c.created_at) > lastMonth
        ).length || 0;

        const contactGrowth = contacts?.length ? 
          ((recentContacts / contacts.length) * 100).toFixed(1) + '%' : 
          '0%';

        setStats({
          totalViews,
          activeWebinars,
          totalAttendees,
          upcomingWebinars,
          totalContacts: contacts?.length || 0,
          averageAttendance,
          totalSessions: sessions.length,
          completionRate,
          contactGrowth,
          recentContacts
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
  }, [user, webinars, sessions]);

  const validateWebinarInput = () => {
    if (!title.trim()) {
      setCreateError('Please enter a webinar title');
      return false;
    }
    if (!description.trim()) {
      setCreateError('Please enter a webinar description');
      return false;
    }
    if (!videoUrl.trim()) {
      setCreateError('Please enter a video URL');
      return false;
    }
    try {
      new URL(videoUrl);
    } catch {
      setCreateError('Please enter a valid video URL');
      return false;
    }
    return true;
  };

  const handleCreateWebinar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setCreateError(null);
    if (!validateWebinarInput()) return;

    try {
      await createWebinar({
        title: title.trim(),
        description: description.trim(),
        user_id: user.id,
        video_url: videoUrl.trim(),
        duration: 0,
        settings: {},
      });

      setShowCreateModal(false);
      setTitle('');
      setDescription('');
      setVideoUrl('');
    } catch (error) {
      setCreateError('Failed to create webinar. Please try again.');
    }
  };

  const handleDeleteWebinar = async (id: string) => {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await deleteWebinar(id);
      setShowDeleteModal(null);
    } catch (error) {
      console.error('Error deleting webinar:', error);
      setDeleteError('Failed to delete webinar and its associated data. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-8 rounded-lg shadow-lg">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold">Welcome back, {user?.email}</h1>
          <p className="mt-2 text-blue-100">Manage your webinars and view analytics</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow transform hover:scale-105">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <ChartBar className="text-blue-600 w-6 h-6" />
            </div>
            <span className="text-sm text-gray-500">Total Views</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.totalViews}</p>
          <p className="text-sm text-gray-500 mt-2">Across all webinars</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow transform hover:scale-105">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-full">
              <Radio className="text-green-600 w-6 h-6" />
            </div>
            <span className="text-sm text-gray-500">Live Now</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.activeWebinars}</p>
          <p className="text-sm text-gray-500 mt-2">Active webinars</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow transform hover:scale-105">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-full">
              <Users className="text-purple-600 w-6 h-6" />
            </div>
            <span className="text-sm text-gray-500">Total Attendees</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.totalAttendees}</p>
          <p className="text-sm text-gray-500 mt-2">Registered users</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow transform hover:scale-105">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-100 rounded-full">
              <Calendar className="text-yellow-600 w-6 h-6" />
            </div>
            <span className="text-sm text-gray-500">Upcoming</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.upcomingWebinars}</p>
          <p className="text-sm text-gray-500 mt-2">Scheduled webinars</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Your Webinars</h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-md"
            >
              <Plus className="w-4 h-4" />
              Create New Webinar
            </button>
          </div>
        </div>

        {webinars.length === 0 ? (
          <div className="text-center py-12">
            <Video className="w-16 h-16 mx-auto mb-4 text-gray-400 animate-bounce" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No webinars yet</h3>
            <p className="text-gray-500 max-w-sm mx-auto">
              Create your first webinar to start engaging with your audience in real-time
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            {webinars.map((webinar) => {
              const status = webinarStatus[webinar.id];
              const isLive = status?.isLive;
              const nextSession = status?.nextSession;

              return (
                <div
                  key={webinar.id}
                  className={`border rounded-lg overflow-hidden hover:shadow-lg transition-all transform hover:scale-[1.02] ${
                    isLive ? 'border-green-200 bg-green-50' : 'bg-white'
                  }`}
                >
                  <div className="relative">
                    <VideoThumbnail videoUrl={webinar.video_url} />
                    {isLive && (
                      <div className="absolute top-4 right-4 flex items-center gap-1 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium animate-pulse">
                        <Radio className="w-4 h-4" />
                        LIVE
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">{webinar.title}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-4">{webinar.description}</p>
                    <div className="flex items-center justify-between">
                      {nextSession && !isLive && (
                        <div className="text-sm text-gray-500">
                          <Clock className="w-4 h-4 inline mr-1" />
                          {formatDistanceToNow(nextSession, { addSuffix: true })}
                        </div>
                      )}
                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          onClick={() => navigate(`/webinar/${webinar.id}`)}
                          className="p-2 text-gray-500 hover:text-blue-600 transition-colors transform hover:scale-110"
                          title="Preview webinar"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => navigate(`/webinar/${webinar.id}/settings`)}
                          className="p-2 text-gray-500 hover:text-blue-600 transition-colors transform hover:scale-110"
                          title="Edit webinar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setShowDeleteModal(webinar.id)}
                          className="p-2 text-gray-500 hover:text-red-600 transition-colors transform hover:scale-110"
                          title="Delete webinar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 transform transition-all">
            <h2 className="text-xl font-semibold mb-4">Create New Webinar</h2>
            <form onSubmit={handleCreateWebinar} className="space-y-4">
              {createError && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-sm">
                  {createError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                  placeholder="Enter webinar title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={3}
                  className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                  placeholder="Enter webinar description" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Video URL
                </label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  required
                  placeholder="https://example.com/video.mp4"
                  className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-colors"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Enter a direct video URL (MP4) or YouTube video URL
                </p>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateError(null);
                  }}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating...' : 'Create Webinar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-2 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Delete Webinar</h2>
            </div>
            {deleteError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg">
                {deleteError}
              </div>
            )}
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this webinar? This action cannot be undone and will remove:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>All scheduled sessions</li>
                <li>All chat messages</li>
                <li>All avatar messages</li>
                <li>All contact information</li>
              </ul>
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDeleteModal(null);
                  setDeleteError(null);
                }}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteWebinar(showDeleteModal)}
                disabled={deleteLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors transform hover:scale-105 disabled:opacity-50 flex items-center gap-2"
              >
                {deleteLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Permanently
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}