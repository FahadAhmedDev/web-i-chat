import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { MessageSquare, Radio, AlertTriangle, X, Calendar } from 'lucide-react';
import { useStore } from '../lib/store';
import VideoPlayer from '../components/VideoPlayer';
import Chat from '../components/Chat';
import CountdownTimer from '../components/CountdownTimer';
import { supabase } from '../lib/supabase';
import { upsertContactToGHL } from '../lib/ghl';

interface UserDetails {
  firstName: string;
  email: string;
  phoneNumber: string;
}

export default function WebinarView() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { webinars, sessions, fetchWebinarSessions } = useStore();
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [webinar, setWebinar] = useState<any>(null);
  const [initialStartTime, setInitialStartTime] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [avatarMessages, setAvatarMessages] = useState([]);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const isEmbedded = window.self !== window.top;

  // Check URL parameters and local storage for user details
  useEffect(() => {
    const checkUserDetails = () => {
      const firstName = searchParams.get('firstName');
      const email = searchParams.get('email');
      const phoneNumber = searchParams.get('phoneNumber');

      if (firstName && email && phoneNumber) {
        handleUserDetails({ firstName, email, phoneNumber });
        return true;
      }

      const storedContact = localStorage.getItem(`chat_contact_${id}`);
      if (storedContact) {
        const contact = JSON.parse(storedContact);
        setUserDetails({
          firstName: contact.name,
          email: contact.email,
          phoneNumber: contact.phone
        });
        return true;
      }

      return false;
    };

    const hasUserDetails = checkUserDetails();
    if (!hasUserDetails) {
      setShowJoinModal(true);
    }
  }, [id, searchParams]);

  const handleUserDetails = async (details: UserDetails) => {
    if (!id) return;
    
    setJoinLoading(true);
    setJoinError(null);
    try {
      // Save contact info if not already saved
      const { error } = await supabase.from('contacts').insert([{
        webinar_id: id,
        name: details.firstName,
        email: details.email,
        phone: details.phoneNumber,
        created_at: new Date().toISOString()
      }]);

      if (error && error.code !== '23505') { // Ignore unique constraint violations
        throw error;
      }

      // Try to sync contact to GHL
      try {
        const nameParts = details.firstName.split(' ');
        await upsertContactToGHL({
          webinarId: id,
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(' '),
          email: details.email,
          phone: details.phoneNumber,
        });
      } catch (ghlError) {
        console.error('Failed to sync contact to GHL:', ghlError);
        // Don't throw error here - we still want to allow webinar access
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

  useEffect(() => {
    async function fetchWebinar() {
      if (!id) return;

      setLoading(true);

      try {
        const { data: webinarData, error: webinarError } = await supabase
          .from('webinars')
          .select('*')
          .eq('id', id)
          .single();

        if (webinarError) throw webinarError;
        if (!webinarData) throw new Error('Webinar not found');

        setWebinar(webinarData);

        const { data: sessionData, error: sessionError } = await supabase
          .from('webinar_sessions')
          .select('*')
          .eq('webinar_id', id)
          .order('start_time', { ascending: true });

        if (sessionError) throw sessionError;
        useStore.setState({ sessions: sessionData || [] });

        // If no sessions are scheduled, show not live message
        if (!sessionData || sessionData.length === 0) {
          setIsLive(false);
          return;
        }

        // Find current or next session
        const now = new Date();
        const currentSession = sessionData.find(
          session => {
            const startTime = new Date(session.start_time);
            const endTime = new Date(session.end_time);
            return now >= startTime && now <= endTime;
          }
        );

        if (currentSession) {
          setCurrentSession(currentSession.id);
          setIsLive(true);
          const sessionStart = new Date(currentSession.start_time);
          const elapsedSeconds = (now.getTime() - sessionStart.getTime()) / 1000;
          setInitialStartTime(elapsedSeconds);
        } else {
          // If no current session, use the first upcoming session
          const nextSession = sessionData.find(
            session => new Date(session.start_time) > now
          );
          if (nextSession) {
            setCurrentSession(nextSession.id);
            setIsLive(false);
          }
        }

        // Fetch avatar messages
        const { data: avatarData, error: avatarError } = await supabase
          .from('avatar_messages')
          .select('*')
          .eq('webinar_id', id)
          .order('timestamp', { ascending: true });

        if (avatarError) throw avatarError;
        setAvatarMessages(avatarData || []);
      } catch (error) {
        console.error('Error fetching webinar:', error);
        setWebinar(null);
      } finally {
        setLoading(false);
      }
    }

    fetchWebinar();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading webinar...</p>
        </div>
      </div>
    );
  }

  if (!webinar) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Webinar Not Found</h1>
          <p className="text-gray-600">The webinar you're looking for doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  // If no sessions are scheduled
  if (sessions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg text-center">
          <Calendar className="w-12 h-12 text-blue-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{webinar.title}</h1>
          <p className="text-gray-600 mb-4">{webinar.description}</p>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-blue-700">This webinar is not currently live.</p>
            <p className="text-sm text-blue-600 mt-2">No sessions have been scheduled yet.</p>
          </div>
        </div>
      </div>
    );
  }

  const settings = {
    theme: 'light',
    chatEnabled: true,
    autoplay: true,
    showAttendees: true,
    ...webinar.settings
  };

  if (!isLive) {
    return (
      <CountdownTimer
        theme={settings.theme}
        webinar={webinar}
        sessions={sessions}
        onSessionStart={() => setIsLive(true)}
      />
    );
  }

  return (
    <div className={`w-full ${isEmbedded ? 'p-0' : 'p-4'}`}>
      <div className={`grid grid-cols-1 ${settings.chatEnabled ? 'lg:grid-cols-4' : ''} gap-6`}>
        <div className={settings.chatEnabled ? 'lg:col-span-3' : 'w-full'}>
          <VideoPlayer
            url={webinar.video_url}
            onDuration={(duration) => {
              if (duration !== webinar.duration) {
                useStore.getState().updateWebinar(webinar.id, {
                  duration: Math.round(duration),
                });
              }
            }}
            onCurrentTime={setCurrentTime}
            onPlayingChange={setIsPlaying}
            theme={settings.theme}
            forceAutoplay={true}
            viewCount={100}
            showLiveIndicator={true}
            initialStartTime={initialStartTime}
            avatarMarkers={avatarMessages.map(msg => ({
              id: msg.id,
              timestamp: msg.timestamp,
              name: msg.name,
              message: msg.message,
            }))}
            embedded={isEmbedded}
            webinarId={webinar.id}
          />
        </div>

        {settings.chatEnabled && currentSession && (
          <div className="lg:h-[600px] h-[400px]">
            <Chat
              webinarId={webinar.id}
              sessionId={currentSession}
              theme={settings.theme}
              currentTime={currentTime}
              isPlaying={isPlaying}
              embedded={isEmbedded}
              userDetails={userDetails}
              chatEnabled={settings.chatEnabled}
            />
          </div>
        )}
      </div>

      {showJoinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg relative">
            <button
              onClick={() => setShowJoinModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="bg-blue-100 p-2 rounded-full">
                <MessageSquare className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Join Webinar</h2>
                <p className="text-sm text-gray-500 mt-1">Enter your details to join the chat</p>
              </div>
            </div>

            {joinError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                <p className="text-sm">{joinError}</p>
              </div>
            )}

            <form onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const firstName = (form.elements.namedItem('firstName') as HTMLInputElement).value;
              const email = (form.elements.namedItem('email') as HTMLInputElement).value;
              const phoneNumber = (form.elements.namedItem('phoneNumber') as HTMLInputElement).value;
              handleUserDetails({ firstName, email, phoneNumber });
            }} className="space-y-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  required
                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phoneNumber"
                  name="phoneNumber"
                  required
                  pattern="^\+?[0-9]{10,15}$"
                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-colors"
                  placeholder="+1234567890"
                />
                <p className="mt-1 text-sm text-gray-500">Format: +1234567890 or 1234567890</p>
              </div>
              <button
                type="submit"
                disabled={joinLoading}
                className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {joinLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Joining...
                  </>
                ) : (
                  <>
                    <Radio className="w-4 h-4" />
                    Join Webinar
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}