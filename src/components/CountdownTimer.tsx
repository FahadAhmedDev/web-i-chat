import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import type { Database } from '../lib/database.types';

type WebinarSession = Database['public']['Tables']['webinar_sessions']['Row'];

interface CountdownTimerProps {
  webinar: Database['public']['Tables']['webinars']['Row'];
  sessions: WebinarSession[];
  theme?: 'light' | 'dark';
  onSessionStart: () => void;
}

export default function CountdownTimer({ webinar, sessions, theme = 'light', onSessionStart }: CountdownTimerProps) {
  const [nextSession, setNextSession] = useState<WebinarSession | null>(null);
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  // Find the next session
  useEffect(() => {
    const now = new Date().getTime();
    const upcomingSessions = sessions
      .filter(session => new Date(session.start_time).getTime() > now)
      .sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );

    const currentSession = sessions.find(session => {
      const startTime = new Date(session.start_time).getTime();
      const endTime = new Date(session.end_time).getTime();
      return now >= startTime && now <= endTime;
    });

    if (currentSession) {
      onSessionStart();
    } else if (upcomingSessions.length > 0) {
      setNextSession(upcomingSessions[0]);
    }
  }, [sessions, onSessionStart]);

  // Update countdown
  useEffect(() => {
    if (!nextSession) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const startTime = new Date(nextSession.start_time).getTime();
      const timeLeft = startTime - now;

      if (timeLeft <= 0) {
        clearInterval(timer);
        onSessionStart();
        return;
      }

      // Calculate time units
      const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

      setCountdown({ days, hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(timer);
  }, [nextSession, onSessionStart]);

  if (!nextSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-2xl w-full mx-auto p-8">
          <div className={`${
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          } rounded-xl shadow-xl p-8 text-center`}>
            <h1 className={`text-3xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            } mb-4`}>{webinar.title}</h1>
            {webinar.description && (
              <p className={`${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              } mb-8`}>{webinar.description}</p>
            )}
            <p className={`text-xl ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}>No upcoming sessions scheduled.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-2xl w-full mx-auto p-8">
        <div className={`${
          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        } rounded-xl shadow-xl p-8 text-center`}>
          <h1 className={`text-3xl font-bold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          } mb-4`}>{webinar.title}</h1>
          {webinar.description && (
            <p className={`${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            } mb-8`}>{webinar.description}</p>
          )}

          <div className="mb-8">
            <h2 className={`text-2xl font-semibold ${
              theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
            } mb-2`}>Next Session Starting In:</h2>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}>
              {format(new Date(nextSession.start_time), "EEEE, MMMM d, yyyy 'at' h:mm a")} ({nextSession.timezone})
            </p>
          </div>

          <div className="grid grid-cols-4 gap-6">
            {[
              { label: 'Days', value: countdown.days },
              { label: 'Hours', value: countdown.hours },
              { label: 'Minutes', value: countdown.minutes },
              { label: 'Seconds', value: countdown.seconds }
            ].map(({ label, value }) => (
              <div key={label} className={`${
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
              } rounded-lg p-6 shadow-sm`}>
                <div className={`text-4xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                } mb-1`}>
                  {String(value).padStart(2, '0')}
                </div>
                <div className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}