import React, { useRef, useState, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { Play, Pause, RotateCcw, FastForward, Volume2, VolumeX, Radio, Volume1 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface VideoPlayerProps {
  url: string;
  onProgress?: (state: { played: number; playedSeconds: number }) => void;
  onDuration?: (duration: number) => void;
  preview?: boolean;
  avatarMarkers?: { id: string; timestamp: number; name: string; message: string }[];
  onCurrentTime?: (time: number) => void;
  onPlayingChange?: (playing: boolean) => void;
  theme?: 'light' | 'dark';
  forceAutoplay?: boolean;
  viewCount?: number;
  embedded?: boolean;
  showLiveIndicator?: boolean;
  initialStartTime?: number | null;
  onAvatarClick?: (id: string) => void;
  webinarId?: string;
}

export default function VideoPlayer({
  url,
  onProgress,
  onDuration,
  preview = false,
  avatarMarkers = [],
  onCurrentTime,
  onPlayingChange,
  theme = 'light',
  forceAutoplay = false,
  viewCount = 0,
  embedded = false,
  showLiveIndicator = true,
  initialStartTime = null,
  onAvatarClick,
  webinarId,
}: VideoPlayerProps) {
  const playerRef = useRef<ReactPlayer>(null);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const progressInterval = useRef<number>();
  const hasSetInitialTime = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const volumeTimeout = useRef<number>();
  const volumeControlRef = useRef<HTMLDivElement>(null);
  const lastAvatarMessageTime = useRef<number>(0);

  useEffect(() => {
    if (forceAutoplay) {
      setPlaying(true);
    }
  }, [forceAutoplay]);

  useEffect(() => {
    onPlayingChange?.(playing);
  }, [playing, onPlayingChange]);

  useEffect(() => {
    if (!webinarId || !playing) return;

    const checkAndSendAvatarMessage = async () => {
      const currentTimeInSeconds = playerRef.current?.getCurrentTime() || 0;
      
      // Check for avatar messages at current timestamp
      const avatarMessage = avatarMarkers.find(marker => {
        // Add a small buffer (0.5 seconds) to catch messages
        const isTimeMatch = Math.abs(marker.timestamp - currentTimeInSeconds) <= 0.5;
        // Ensure we haven't sent this message recently
        const isNewMessage = Math.abs(marker.timestamp - lastAvatarMessageTime.current) > 1;
        return isTimeMatch && isNewMessage;
      });

      if (avatarMessage) {
        // Update last sent message time
        lastAvatarMessageTime.current = avatarMessage.timestamp;
        
        // Send the avatar message to chat
        try {
          await supabase.from('chat_messages').insert([{
            webinar_id: webinarId,
            session_id: null,
            user_id: avatarMessage.name,
            message: avatarMessage.message,
            is_admin: false,
            is_avatar: true,
            timestamp: avatarMessage.timestamp
          }]);
        } catch (error) {
          console.error('Error sending avatar message:', error);
        }
      }
    };

    // Check every 100ms for avatar messages
    const interval = setInterval(checkAndSendAvatarMessage, 100);

    return () => clearInterval(interval);
  }, [webinarId, playing, avatarMarkers]);

  const handleReady = () => {
    setIsReady(true);
    if (initialStartTime !== null && playerRef.current && !hasSetInitialTime.current) {
      playerRef.current.seekTo(initialStartTime, 'seconds');
      hasSetInitialTime.current = true;
      setPlaying(true);
    }
  };

  useEffect(() => {
    if (playing && playerRef.current) {
      progressInterval.current = window.setInterval(() => {
        const currentTime = playerRef.current?.getCurrentTime() || 0;
        onCurrentTime?.(Number(currentTime.toFixed(1)));
      }, 100);
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [playing, onCurrentTime]);

  const handleProgress = (state: { played: number; playedSeconds: number }) => {
    setProgress(state.played);
    onProgress?.(state);
  };

  const handleDuration = (duration: number) => {
    setDuration(duration);
    onDuration?.(duration);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!preview || !playerRef.current || !progressBarRef.current || forceAutoplay) return;
    
    const bounds = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const percent = x / bounds.width;
    playerRef.current.seekTo(percent);
  };

  const handleRestart = () => {
    if (!playerRef.current || forceAutoplay) return;
    playerRef.current.seekTo(0);
    setPlaying(true);
  };

  const handleForward = () => {
    if (!playerRef.current || forceAutoplay) return;
    const currentTime = playerRef.current.getCurrentTime();
    playerRef.current.seekTo(currentTime + 30);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setMuted(newVolume === 0);
  };

  const handleVolumeButtonClick = () => {
    if (muted) {
      setMuted(false);
      setShowVolumeSlider(true);
    } else {
      setMuted(true);
    }
  };

  const handleVolumeMouseEnter = () => {
    if (volumeTimeout.current) {
      window.clearTimeout(volumeTimeout.current);
    }
    setShowVolumeSlider(true);
  };

  const handleVolumeMouseLeave = () => {
    volumeTimeout.current = window.setTimeout(() => {
      setShowVolumeSlider(false);
    }, 2000);
  };

  const formatTime = (seconds: number, forDisplay: boolean = false) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = forDisplay ? 
      seconds % 60 : 
      (seconds % 60).toFixed(1);
    return `${minutes}:${remainingSeconds.toString().padStart(forDisplay ? 5 : 4, '0')}`;
  };

  const getVolumeIcon = () => {
    if (muted || volume === 0) return <VolumeX className="w-5 h-5" />;
    if (volume < 0.5) return <Volume1 className="w-5 h-5" />;
    return <Volume2 className="w-5 h-5" />;
  };

  const isDark = theme === 'dark';

  return (
    <div className={`bg-transparent rounded-lg overflow-hidden ${embedded ? '' : 'shadow-lg border border-gray-200'} relative`}>
      <div className="absolute top-4 left-0 right-0 z-10 flex items-center justify-between px-4">
        <div className="flex items-center gap-2 bg-black/75 text-white px-3 py-1 rounded-full text-sm">
          <Radio className="w-4 h-4 text-red-500" />
          <span>{viewCount.toLocaleString()} watching</span>
        </div>
        {showLiveIndicator && (
          <div className="flex items-center gap-1 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            LIVE
          </div>
        )}
      </div>

      {forceAutoplay && (
        <div className="absolute bottom-4 right-4 z-10">
          <div
            ref={volumeControlRef}
            className="relative flex items-center group"
            onMouseEnter={handleVolumeMouseEnter}
            onMouseLeave={handleVolumeMouseLeave}
          >
            <button
              onClick={handleVolumeButtonClick}
              className="p-2 bg-black/75 text-white rounded-full hover:bg-black/90 transition-colors"
              title={muted ? 'Unmute' : 'Mute'}
            >
              {getVolumeIcon()}
            </button>
            <div className={`absolute right-full mr-2 bg-black/75 rounded-full overflow-hidden transition-all duration-200 ${
              showVolumeSlider ? 'w-24 opacity-100' : 'w-0 opacity-0'
            }`}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="w-24 h-10 px-3 accent-white opacity-75 hover:opacity-100 transition-opacity"
              />
            </div>
          </div>
        </div>
      )}

      {muted && isReady && (
        <button
          onClick={() => {
            setMuted(false);
            setShowVolumeSlider(true);
          }}
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 bg-black/75 text-white p-4 rounded-full hover:bg-black/90 transition-colors flex items-center gap-3"
        >
          <Volume2 className="w-6 h-6" />
          <span className="text-sm font-medium whitespace-nowrap">Click to unmute</span>
        </button>
      )}

      <div className={`aspect-video ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
        <ReactPlayer
          ref={playerRef}
          url={url}
          width="100%"
          height="100%"
          playing={playing}
          muted={muted}
          volume={volume}
          controls={false}
          onReady={handleReady}
          onProgress={handleProgress}
          onDuration={handleDuration}
          progressInterval={100}
          playsinline
          config={{
            file: {
              attributes: {
                crossOrigin: 'anonymous',
                playsInline: true,
              },
              forceVideo: true,
            },
          }}
        />
      </div>
      
      {preview && !forceAutoplay && (
        <div className={`${isDark ? 'bg-gray-800' : 'bg-gray-50'} p-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="relative mb-8">
            <div 
              ref={progressBarRef}
              className={`h-2 ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded-full cursor-pointer relative`}
              onClick={handleSeek}
            >
              <div 
                className="absolute inset-y-0 left-0 bg-blue-500 rounded-full"
                style={{ width: `${progress * 100}%` }}
              />
              {avatarMarkers.map((marker) => (
                <div
                  key={marker.id}
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-red-500 rounded-full transform -translate-x-1/2 cursor-pointer hover:scale-125 transition-transform group"
                  style={{ left: `${(marker.timestamp / duration) * 100}%` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAvatarClick?.(marker.id);
                  }}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-black text-white text-sm rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <p className="font-medium">{marker.name}</p>
                    <p className="text-xs">{marker.message}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className={`flex justify-between mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              <span>{formatTime(progress * duration, true)}</span>
              <span>{formatTime(duration, true)}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handleRestart}
              className={`p-2 ${isDark ? 'text-gray-400 hover:text-blue-400' : 'text-gray-600 hover:text-blue-600'} transition-colors`}
              title="Restart"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <button
              onClick={() => !forceAutoplay && setPlaying(!playing)}
              className={`p-2 ${isDark ? 'text-gray-400 hover:text-blue-400' : 'text-gray-600 hover:text-blue-600'} transition-colors`}
              title={playing ? 'Pause' : 'Play'}
            >
              {playing ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={handleForward}
              className={`p-2 ${isDark ? 'text-gray-400 hover:text-blue-400' : 'text-gray-600 hover:text-blue-600'} transition-colors`}
              title="Forward 30 seconds"
            >
              <FastForward className="w-5 h-5" />
            </button>
            <div
              className="relative flex items-center group"
              onMouseEnter={handleVolumeMouseEnter}
              onMouseLeave={handleVolumeMouseLeave}
            >
              <button
                onClick={handleVolumeButtonClick}
                className={`p-2 ${isDark ? 'text-gray-400 hover:text-blue-400' : 'text-gray-600 hover:text-blue-600'} transition-colors`}
                title={muted ? 'Unmute' : 'Mute'}
              >
                {getVolumeIcon()}
              </button>
              <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 ${
                isDark ? 'bg-gray-700' : 'bg-white'
              } rounded-lg shadow-lg overflow-hidden transition-all duration-200 ${
                showVolumeSlider ? 'h-32 opacity-100' : 'h-0 opacity-0'
              }`}>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="h-32 -rotate-90 translate-y-[50px] origin-top"
                  style={{
                    WebkitAppearance: 'slider-vertical',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}