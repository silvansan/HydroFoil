import React from 'react';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';

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

const qualitySelectStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: '#e2e8f0',
  background: 'rgba(15, 23, 42, 0.9)',
  border: '1px solid rgba(45, 212, 191, 0.25)',
  borderRadius: '0.25rem',
  padding: '0.2rem 0.35rem',
  maxWidth: '8rem',
};

type QualityOption = { index: number; label: string };

function formatLevelLabel(height: number, bitrate: number): string {
  if (height >= 1080) return '1080p';
  if (height >= 720) return '720p';
  if (height >= 480) return '480p';
  if (height >= 360) return '360p';
  if (height > 0) return `${height}p`;
  if (bitrate > 0) return `${Math.round(bitrate / 1000)} kbps`;
  return 'Quality';
}

export const HydroFoilPlayer: React.FC<HydroFoilPlayerProps> = ({
  src,
  flvSrc,
  title,
  isLive,
  playbackMode = 'live-hls',
  className = '',
  autoPlay = true,
  muted = true,
}) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const hlsRef = React.useRef<Hls | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [qualityOptions, setQualityOptions] = React.useState<QualityOption[]>([]);
  const [selectedQuality, setSelectedQuality] = React.useState(-1);
  const [transport, setTransport] = React.useState<'hls' | 'flv'>(
    playbackMode === 'live-flv' ? 'flv' : 'hls'
  );
  const showLive = isLive ?? (playbackMode === 'live-hls' || playbackMode === 'live-flv');

  React.useEffect(() => {
    setTransport(playbackMode === 'live-flv' ? 'flv' : 'hls');
    setError(null);
  }, [src, flvSrc, playbackMode]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || transport !== 'flv' || !flvSrc) return;

    setError(null);
    setQualityOptions([]);
    hlsRef.current?.destroy();
    hlsRef.current = null;

    if (!mpegts.isSupported()) {
      setError('Live playback is not supported in this browser.');
      return;
    }

    const player = mpegts.createPlayer(
      {
        type: 'flv',
        url: flvSrc,
        isLive: true,
        hasAudio: true,
        hasVideo: true,
      },
      {
        // Workers fetch with opaque/null origin — breaks cross-site iframe embeds without CORS.
        enableWorker: false,
        enableStashBuffer: false,
        stashInitialSize: 128,
        lazyLoad: false,
      }
    );

    player.attachMediaElement(video);
    player.load();
    if (autoPlay) {
      player.play().catch(() => undefined);
    }

    const onFlvError = () => {
      setError(showLive ? 'Stream offline or unavailable.' : 'Media failed to load.');
    };
    player.on(mpegts.Events.ERROR, onFlvError);

    return () => {
      player.off(mpegts.Events.ERROR, onFlvError);
      player.pause();
      player.unload();
      player.detachMediaElement();
      player.destroy();
    };
  }, [transport, flvSrc, autoPlay, showLive]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || transport !== 'hls' || !src) return;

    setError(null);
    setQualityOptions([]);
    setSelectedQuality(-1);
    hlsRef.current?.destroy();
    hlsRef.current = null;

    const onVideoError = () => {
      if (flvSrc && showLive) {
        setTransport('flv');
        return;
      }
      setError(showLive ? 'Stream offline or unavailable.' : 'Media failed to load.');
    };
    video.addEventListener('error', onVideoError);

    const applyQualityOptions = (hls: Hls) => {
      const levels = hls.levels ?? [];
      if (levels.length <= 1) {
        setQualityOptions([]);
        return;
      }
      const options: QualityOption[] = levels.map((level, index) => ({
        index,
        label: formatLevelLabel(level.height ?? 0, level.bitrate ?? 0),
      }));
      setQualityOptions(options);
      setSelectedQuality(hls.currentLevel >= 0 ? hls.currentLevel : -1);
    };

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      if (autoPlay) video.play().catch(() => undefined);
      return () => video.removeEventListener('error', onVideoError);
    }

    if (!Hls.isSupported()) {
      if (flvSrc && showLive) {
        setTransport('flv');
        return () => video.removeEventListener('error', onVideoError);
      }
      setError('HLS is not supported in this browser.');
      return () => video.removeEventListener('error', onVideoError);
    }

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: playbackMode === 'live-hls',
    });
    hlsRef.current = hls;
    hls.loadSource(src);
    hls.attachMedia(video);
    if (autoPlay) {
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        applyQualityOptions(hls);
        video.play().catch(() => undefined);
      });
    } else {
      hls.on(Hls.Events.MANIFEST_PARSED, () => applyQualityOptions(hls));
    }
    hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
      setSelectedQuality(data.level);
    });
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;
      if (flvSrc && showLive) {
        setTransport('flv');
        return;
      }
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
      hlsRef.current = null;
    };
  }, [src, flvSrc, autoPlay, playbackMode, showLive, transport]);

  const onQualityChange = (value: string) => {
    const level = Number(value);
    setSelectedQuality(level);
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = level;
  };

  return (
    <div className={`hydrofoil-player ${className}`.trim()} style={shellStyle}>
      {(title || showLive || qualityOptions.length > 0) && (
        <div style={chromeStyle}>
          <span
            style={{
              fontSize: '0.8rem',
              color: '#e2e8f0',
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0,
            }}
          >
            {title ?? 'HydroFoil'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            {qualityOptions.length > 0 && (
              <select
                aria-label="Video quality"
                value={String(selectedQuality)}
                onChange={(e) => onQualityChange(e.target.value)}
                style={qualitySelectStyle}
              >
                <option value="-1">Auto</option>
                {qualityOptions.map((option) => (
                  <option key={option.index} value={String(option.index)}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
            <span style={showLive ? badgeLive : badgeVod}>{showLive ? 'Live' : 'VOD'}</span>
          </div>
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
