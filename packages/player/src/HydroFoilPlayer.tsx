import React from 'react';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';

import type { HydroFoilPlayerProps } from './types';
import './player.css';

type QualityOption = { index: number; label: string; height?: number };

function formatLevelLabel(height: number, bitrate: number): string {
  if (height >= 1080) return '1080p';
  if (height >= 720) return '720p';
  if (height >= 480) return '480p';
  if (height >= 360) return '360p';
  if (height > 0) return `${height}p`;
  if (bitrate > 0) return `${Math.round(bitrate / 1000)} kbps`;
  return 'Quality';
}

function hintLabelForHeight(
  height: number,
  hints?: Array<{ label: string; height: number }>
): string | undefined {
  if (!hints?.length || height <= 0) return undefined;
  const exact = hints.find((hint) => hint.height === height);
  if (exact) return exact.label;
  const close = hints.find((hint) => Math.abs(hint.height - height) <= 32);
  return close?.label;
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M19.4 13a7.9 7.9 0 0 0 .1-2l2-1.2-2-3.4-2.3.7a8 8 0 0 0-1.7-1L15 3.5h-6L8.5 6.1a8 8 0 0 0-1.7 1l-2.3-.7-2 3.4L4.5 11a7.9 7.9 0 0 0 0 2l-2 1.2 2 3.4 2.3-.7c.5.4 1.1.8 1.7 1L9 20.5h6l1.5-2.6c.6-.2 1.2-.6 1.7-1l2.3.7 2-3.4-2-1.2Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const HydroFoilPlayer: React.FC<HydroFoilPlayerProps> = ({
  src,
  flvSrc,
  flvFallbackSrcs = [],
  renditionHints,
  title,
  isLive,
  playbackMode = 'live-hls',
  variant = 'default',
  className = '',
  autoPlay = true,
  muted = true,
}) => {
  const isEmbed = variant === 'embed';
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const hlsRef = React.useRef<Hls | null>(null);
  const qualityRef = React.useRef<HTMLDivElement>(null);
  const flvCandidates = React.useMemo(
    () => [...new Set([flvSrc, ...flvFallbackSrcs].filter((url): url is string => Boolean(url)))],
    [flvSrc, flvFallbackSrcs]
  );
  const [flvCandidateIndex, setFlvCandidateIndex] = React.useState(0);
  const activeFlvSrc = flvCandidates[flvCandidateIndex] ?? '';
  const [error, setError] = React.useState<string | null>(null);
  const [qualityOptions, setQualityOptions] = React.useState<QualityOption[]>([]);
  const [selectedQuality, setSelectedQuality] = React.useState(-1);
  const [qualityOpen, setQualityOpen] = React.useState(false);
  const [pendingQualityHeight, setPendingQualityHeight] = React.useState<number | null>(null);
  const [transport, setTransport] = React.useState<'hls' | 'flv'>(
    playbackMode === 'live-flv' ? 'flv' : 'hls'
  );
  const showLive = isLive ?? (playbackMode === 'live-hls' || playbackMode === 'live-flv');
  const renditionHintsRef = React.useRef(renditionHints);
  renditionHintsRef.current = renditionHints;
  const autoPlayedSrcRef = React.useRef<string | null>(null);

  const renditionHintsKey = JSON.stringify(renditionHints ?? []);
  const hintOptions = React.useMemo<QualityOption[]>(
    () =>
      (renditionHints ?? []).map((hint, index) => ({
        index,
        label: hint.label,
        height: hint.height,
      })),
    [renditionHintsKey]
  );

  const menuOptions = qualityOptions.length > 0 ? qualityOptions : hintOptions;
  const showQualityMenu = menuOptions.length > 0;

  const applyHlsLevelForHeight = React.useCallback((height: number) => {
    const hls = hlsRef.current;
    if (!hls) return false;
    const match = hls.levels.findIndex((level) => Math.abs((level.height ?? 0) - height) <= 32);
    if (match >= 0) {
      hls.currentLevel = match;
      setSelectedQuality(match);
      return true;
    }
    hls.currentLevel = -1;
    setSelectedQuality(-1);
    return false;
  }, []);

  React.useEffect(() => {
    setFlvCandidateIndex(0);
  }, [flvCandidates]);

  React.useEffect(() => {
    setTransport(playbackMode === 'live-flv' ? 'flv' : 'hls');
    setError(null);
  }, [src, activeFlvSrc, playbackMode]);

  React.useEffect(() => {
    if (!qualityOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!qualityRef.current?.contains(event.target as Node)) {
        setQualityOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [qualityOpen]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || transport !== 'flv' || !activeFlvSrc) return;

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
        url: activeFlvSrc,
        isLive: true,
        hasAudio: true,
        hasVideo: true,
      },
      {
        enableWorker: false,
        enableStashBuffer: false,
        stashInitialSize: 128,
        lazyLoad: false,
      }
    );

    player.attachMediaElement(video);
    player.load();
    if (autoPlay && autoPlayedSrcRef.current !== activeFlvSrc) {
      player.play().catch(() => undefined);
      autoPlayedSrcRef.current = activeFlvSrc;
    }

    const onFlvError = () => {
      if (flvCandidateIndex + 1 < flvCandidates.length) {
        setFlvCandidateIndex((current) => current + 1);
        return;
      }
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
  }, [transport, activeFlvSrc, autoPlay, showLive, flvCandidateIndex, flvCandidates.length]);

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
        if (pendingQualityHeight != null) {
          applyHlsLevelForHeight(pendingQualityHeight);
          setPendingQualityHeight(null);
        }
        return;
      }
      const options: QualityOption[] = levels.map((level, index) => {
        const height = level.height ?? 0;
        const hint = hintLabelForHeight(height, renditionHintsRef.current);
        return {
          index,
          label: hint ?? formatLevelLabel(height, level.bitrate ?? 0),
          height,
        };
      });
      setQualityOptions(options);
      if (pendingQualityHeight != null) {
        applyHlsLevelForHeight(pendingQualityHeight);
        setPendingQualityHeight(null);
      } else {
        setSelectedQuality(hls.currentLevel >= 0 ? hls.currentLevel : -1);
      }
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
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      applyQualityOptions(hls);
      if (autoPlay && autoPlayedSrcRef.current !== src) {
        video.play().catch(() => undefined);
        autoPlayedSrcRef.current = src;
      }
    });
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
  }, [src, flvSrc, autoPlay, playbackMode, showLive, transport, pendingQualityHeight, applyHlsLevelForHeight]);

  React.useEffect(() => {
    autoPlayedSrcRef.current = null;
  }, [src, activeFlvSrc]);

  React.useEffect(() => {
    const hls = hlsRef.current;
    if (!hls || transport !== 'hls' || hls.levels.length <= 1) return;
    const options: QualityOption[] = hls.levels.map((level, index) => {
      const height = level.height ?? 0;
      const hint = hintLabelForHeight(height, renditionHintsRef.current);
      return {
        index,
        label: hint ?? formatLevelLabel(height, level.bitrate ?? 0),
        height,
      };
    });
    setQualityOptions(options);
  }, [renditionHintsKey, transport]);

  const currentQualityLabel = React.useMemo(() => {
    if (selectedQuality < 0) return 'Auto';
    const active = menuOptions.find((option) => option.index === selectedQuality);
    return active?.label ?? 'Auto';
  }, [menuOptions, selectedQuality]);

  const onQualityPick = (value: string) => {
    const level = Number(value);
    setSelectedQuality(level);
    setQualityOpen(false);

    if (level === -1) {
      const hls = hlsRef.current;
      if (hls) hls.currentLevel = -1;
      return;
    }

    const picked = menuOptions.find((option) => option.index === level);
    if (!picked) return;

    if (transport === 'hls' && hlsRef.current) {
      if (picked.height != null) {
        applyHlsLevelForHeight(picked.height);
      } else {
        hlsRef.current.currentLevel = level;
      }
      return;
    }

    if (src && picked.height != null) {
      setPendingQualityHeight(picked.height);
      setTransport('hls');
    }
  };

  const playerClassName = [
    'hf-player',
    isEmbed ? 'hf-player--embed' : 'hf-player--default',
    'hydrofoil-player',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const qualityItemClass = (active: boolean) =>
    ['hf-player__quality-item', active ? 'is-active' : ''].filter(Boolean).join(' ');

  return (
    <div
      className={playerClassName}
      style={{ position: 'relative', width: '100%', ...(isEmbed ? {} : { background: '#0a1628', borderRadius: '0.5rem', border: '1px solid rgba(45, 212, 191, 0.15)' }) }}
    >
      {(title || showLive || showQualityMenu) && (
        <div className="hf-player__chrome">
          <span className="hf-player__title">{title ?? 'HydroFoil'}</span>
          <div className="hf-player__actions">
            {showQualityMenu && (
              <div ref={qualityRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  className={['hf-player__settings-btn', qualityOpen ? 'is-open' : ''].filter(Boolean).join(' ')}
                  aria-label="Video quality"
                  title={`Quality: ${currentQualityLabel}`}
                  onClick={() => setQualityOpen((open) => !open)}
                >
                  <SettingsIcon />
                </button>
                {qualityOpen && (
                  <div className="hf-player__quality-menu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      className={qualityItemClass(selectedQuality === -1)}
                      onClick={() => onQualityPick('-1')}
                    >
                      Auto
                    </button>
                    {menuOptions.map((option) => (
                      <button
                        key={`${option.label}-${option.index}`}
                        type="button"
                        role="menuitem"
                        className={qualityItemClass(selectedQuality === option.index)}
                        onClick={() => onQualityPick(String(option.index))}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <span
              className={[
                'hf-player__badge',
                showLive ? 'hf-player__badge--live' : 'hf-player__badge--vod',
              ].join(' ')}
            >
              {showLive ? 'Live' : 'VOD'}
            </span>
          </div>
        </div>
      )}
      <video
        ref={videoRef}
        className="hf-player__video"
        controls
        controlsList="nodownload"
        playsInline
        muted={muted}
      />
      {error && <p className="hf-player__error">{error}</p>}
    </div>
  );
};
