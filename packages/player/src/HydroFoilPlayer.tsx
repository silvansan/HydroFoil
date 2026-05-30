import React from 'react';
import Hls from 'hls.js';

import type { HydroFoilPlayerProps } from './types';

const shellStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  background: '#0a1628',
  borderRadius: '0.5rem',
  overflow: 'hidden',
  border: '1px solid rgba(45, 212, 191, 0.15)',
};

const chromeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  padding: '0.5rem 0.75rem',
  background: 'linear-gradient(180deg, rgba(10,22,40,0.95) 0%, rgba(10,22,40,0.6) 100%)',
  borderBottom: '1px solid rgba(45, 212, 191, 0.1)',
};

const badgeLive: React.CSSProperties = {
  fontSize: '0.65rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#fff',
  background: '#dc2626',
  padding: '0.15rem 0.45rem',
  borderRadius: '0.25rem',
};

const badgeVod: React.CSSProperties = {
  ...badgeLive,
  background: '#0891b2',
};

export const HydroFoilPlayer: React.FC<HydroFoilPlayerProps> = ({
  src,
  title,
  isLive,
  playbackMode = 'live-hls',
  className = '',
  autoPlay = true,
  muted = true,
}) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const showLive = isLive ?? playbackMode === 'live-hls';

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setError(null);

    const onVideoError = () => {
      setError(showLive ? 'Stream offline or unavailable.' : 'Media failed to load.');
    };
    video.addEventListener('error', onVideoError);

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      if (autoPlay) video.play().catch(() => undefined);
      return () => video.removeEventListener('error', onVideoError);
    }

    if (!Hls.isSupported()) {
      setError('HLS is not supported in this browser.');
      return () => video.removeEventListener('error', onVideoError);
    }

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: playbackMode === 'live-hls',
    });
    hls.loadSource(src);
    hls.attachMedia(video);
    if (autoPlay) {
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => undefined);
      });
    }
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;
      const detail =
        data.type === Hls.ErrorTypes.NETWORK_ERROR
          ? showLive
            ? 'Could not reach the live stream.'
            : 'Could not load media segments.'
          : 'Playback error.';
      setError(detail);
    });

    return () => {
      video.removeEventListener('error', onVideoError);
      hls.destroy();
    };
  }, [src, autoPlay, playbackMode, showLive]);

  return (
    <div className={`hydrofoil-player ${className}`.trim()} style={shellStyle}>
      {(title || showLive) && (
        <div style={chromeStyle}>
          <span
            style={{
              fontSize: '0.8rem',
              color: '#e2e8f0',
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title ?? 'HydroFoil'}
          </span>
          <span style={showLive ? badgeLive : badgeVod}>{showLive ? 'Live' : 'VOD'}</span>
        </div>
      )}
      <video
        ref={videoRef}
        controls
        playsInline
        muted={muted}
        style={{ width: '100%', display: 'block', background: '#000', aspectRatio: '16 / 9' }}
      />
      {error && (
        <p
          style={{
            position: 'absolute',
            bottom: '0.5rem',
            left: '0.5rem',
            right: '0.5rem',
            margin: 0,
            borderRadius: '0.375rem',
            background: 'rgba(127, 29, 29, 0.92)',
            padding: '0.5rem 0.75rem',
            fontSize: '0.75rem',
            color: '#fecaca',
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
};
