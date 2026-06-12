import React from 'react';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';

import { resolveMediaUrl } from './media-url';
import type { HydroFoilPlayerProps } from './types';
import './player.css';

function isPictureInPictureAllowed(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    return 'pictureInPictureEnabled' in document && Boolean(document.pictureInPictureEnabled);
  } catch {
    return false;
  }
}

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

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function formatTimeRange(current: number, total: number): string {
  return `${formatClock(current)} / ${formatClock(total)}`;
}

function IconPlay() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7L8 5Z" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 5h4v14H6V5Zm8 0h4v14h-4V5Z" />
    </svg>
  );
}

function IconSkipBack() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 7v3l4-3-4-3v3Z" fill="currentColor" />
      <path d="M12 5.5a6.5 6.5 0 1 0 6.5 6.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <text x="12" y="15.5" textAnchor="middle" fill="currentColor" fontSize="6.5" fontWeight="700">10</text>
    </svg>
  );
}

function IconSkipForward() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 7v3l4-3-4-3v3Z" fill="currentColor" transform="scale(-1,1) translate(-24,0)" />
      <path d="M12 5.5a6.5 6.5 0 1 1 6.5 6.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <text x="12" y="15.5" textAnchor="middle" fill="currentColor" fontSize="6.5" fontWeight="700">10</text>
    </svg>
  );
}

function IconVolume({ muted, level }: { muted: boolean; level: number }) {
  if (muted || level === 0) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
        <path d="m16 9 4 6m0-6-4 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
      {level > 0.5 ? (
        <>
          <path d="M15 9a4 4 0 0 1 0 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <path d="M17.5 6.5a7.5 7.5 0 0 1 0 11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </>
      ) : (
        <path d="M15 9a4 4 0 0 1 0 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      )}
    </svg>
  );
}

function IconCaptions() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M7 12h2.5a1.5 1.5 0 0 0 0-3H7v6m7-3h2.5a1.5 1.5 0 0 0 0-3H14v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function IconPiP() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <rect x="12" y="12" width="7" height="5" rx="1" fill="currentColor" />
    </svg>
  );
}

function IconFullscreen() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconFullscreenExit() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 3H6a1 1 0 0 0-1 1v3M15 3h3a1 1 0 0 1 1 1v3M9 21H6a1 1 0 0 1-1-1v-3M15 21h3a1 1 0 0 0 1-1v-3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3v10m0 0 3.5-3.5M12 13 8.5 9.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
  downloadUrl,
  className = '',
  autoPlay = true,
  muted: mutedProp = true,
}) => {
  const isEmbed = variant === 'embed';
  const containerRef = React.useRef<HTMLDivElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const hlsRef = React.useRef<Hls | null>(null);
  const qualityRef = React.useRef<HTMLDivElement>(null);
  const settingsRef = React.useRef<HTMLDivElement>(null);
  const downloadRef = React.useRef<HTMLDivElement>(null);
  const progressRef = React.useRef<HTMLDivElement>(null);
  const hideControlsTimer = React.useRef<number | null>(null);

  const resolvedSrc = React.useMemo(() => resolveMediaUrl(src) ?? '', [src]);
  const flvCandidates = React.useMemo(
    () =>
      [
        ...new Set(
          [flvSrc, ...flvFallbackSrcs]
            .map((url) => resolveMediaUrl(url))
            .filter((url): url is string => Boolean(url))
        ),
      ],
    [flvSrc, flvFallbackSrcs]
  );
  const [flvCandidateIndex, setFlvCandidateIndex] = React.useState(0);
  const activeFlvSrc = flvCandidates[flvCandidateIndex] ?? '';
  const [error, setError] = React.useState<string | null>(null);
  const [qualityOptions, setQualityOptions] = React.useState<QualityOption[]>([]);
  const [manualQuality, setManualQuality] = React.useState(-1);
  const [activeLevel, setActiveLevel] = React.useState(-1);
  const [qualityOpen, setQualityOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [downloadOpen, setDownloadOpen] = React.useState(false);
  const [pendingQualityHeight, setPendingQualityHeight] = React.useState<number | null>(null);
  const [transport, setTransport] = React.useState<'hls' | 'flv'>(
    playbackMode === 'live-flv' ? 'flv' : 'hls'
  );

  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [volume, setVolume] = React.useState(1);
  const [isMuted, setIsMuted] = React.useState(mutedProp);
  const [controlsVisible, setControlsVisible] = React.useState(true);
  const [isScrubbing, setIsScrubbing] = React.useState(false);
  const [scrubPreviewPct, setScrubPreviewPct] = React.useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [pipSupported, setPipSupported] = React.useState(false);
  const [hasTextTracks, setHasTextTracks] = React.useState(false);
  const [captionsOn, setCaptionsOn] = React.useState(false);

  const showLive = isLive ?? (playbackMode === 'live-hls' || playbackMode === 'live-flv');
  const showDownload = Boolean(downloadUrl) && !showLive;
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
      setManualQuality(match);
      return true;
    }
    hls.currentLevel = -1;
    setManualQuality(-1);
    return false;
  }, []);

  const revealControls = React.useCallback((autoHide = true) => {
    setControlsVisible(true);
    if (hideControlsTimer.current) {
      window.clearTimeout(hideControlsTimer.current);
      hideControlsTimer.current = null;
    }
    if (autoHide) {
      hideControlsTimer.current = window.setTimeout(() => {
        const video = videoRef.current;
        if (video && !video.paused) {
          setControlsVisible(false);
          setQualityOpen(false);
          setSettingsOpen(false);
          setDownloadOpen(false);
        }
      }, 3000);
    }
  }, []);

  React.useEffect(() => {
    setPipSupported(isPictureInPictureAllowed());
  }, []);

  React.useEffect(() => {
    setFlvCandidateIndex(0);
  }, [flvCandidates]);

  React.useEffect(() => {
    setTransport(playbackMode === 'live-flv' ? 'flv' : 'hls');
    setError(null);
  }, [src, activeFlvSrc, playbackMode]);

  React.useEffect(() => {
    if (!qualityOpen && !settingsOpen && !downloadOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (qualityOpen && !qualityRef.current?.contains(target)) setQualityOpen(false);
      if (settingsOpen && !settingsRef.current?.contains(target)) setSettingsOpen(false);
      if (downloadOpen && !downloadRef.current?.contains(target)) setDownloadOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [qualityOpen, settingsOpen, downloadOpen]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncTracks = () => {
      setHasTextTracks(video.textTracks.length > 0);
    };

    const onTimeUpdate = () => {
      if (!isScrubbing) setCurrentTime(video.currentTime);
    };
    const onDurationChange = () => setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    const onPlay = () => {
      setIsPlaying(true);
      revealControls(true);
    };
    const onPause = () => {
      setIsPlaying(false);
      setControlsVisible(true);
    };
    const onVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };
    const onLoadedMetadata = () => {
      onDurationChange();
      syncTracks();
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('volumechange', onVolumeChange);
    video.textTracks.addEventListener('addtrack', syncTracks);

    onVolumeChange();

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('volumechange', onVolumeChange);
      video.textTracks.removeEventListener('addtrack', syncTracks);
    };
  }, [isScrubbing, revealControls]);

  React.useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

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
    if (!video || transport !== 'hls' || !resolvedSrc) return;

    setError(null);
    setQualityOptions([]);
    setManualQuality(-1);
    setActiveLevel(-1);
    hlsRef.current?.destroy();
    hlsRef.current = null;

    const onVideoError = () => {
      if (flvCandidates.length > 0 && showLive) {
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
        setManualQuality(hls.currentLevel >= 0 ? hls.currentLevel : -1);
        setActiveLevel(hls.currentLevel >= 0 ? hls.currentLevel : 0);
      }
    };

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = resolvedSrc;
      if (autoPlay) video.play().catch(() => undefined);
      return () => video.removeEventListener('error', onVideoError);
    }

    if (!Hls.isSupported()) {
      if (flvCandidates.length > 0 && showLive) {
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
    hls.loadSource(resolvedSrc);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      applyQualityOptions(hls);
      if (autoPlay && autoPlayedSrcRef.current !== resolvedSrc) {
        video.play().catch(() => undefined);
        autoPlayedSrcRef.current = resolvedSrc;
      }
    });
    hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
      setActiveLevel(data.level);
    });
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;
      if (flvCandidates.length > 0 && showLive) {
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
  }, [resolvedSrc, flvCandidates.length, autoPlay, playbackMode, showLive, transport, pendingQualityHeight, applyHlsLevelForHeight]);

  React.useEffect(() => {
    autoPlayedSrcRef.current = null;
  }, [resolvedSrc, activeFlvSrc]);

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
    if (manualQuality < 0) return 'Auto';
    const active = menuOptions.find((option) => option.index === manualQuality);
    return active?.label ?? 'Auto';
  }, [menuOptions, manualQuality]);

  const resolutionBadge = React.useMemo(() => {
    const levelIndex = manualQuality >= 0 ? manualQuality : activeLevel;
    if (levelIndex >= 0) {
      const active = menuOptions.find((option) => option.index === levelIndex);
      if (active?.label) return active.label;
      const hls = hlsRef.current;
      const level = hls?.levels[levelIndex];
      if (level) {
        const height = level.height ?? 0;
        return hintLabelForHeight(height, renditionHintsRef.current) ?? formatLevelLabel(height, level.bitrate ?? 0);
      }
    }
    if (menuOptions.length > 0) {
      const lowest = [...menuOptions].sort((a, b) => (a.height ?? 0) - (b.height ?? 0))[0];
      return lowest?.label ?? null;
    }
    return null;
  }, [menuOptions, manualQuality, activeLevel, qualityOptions.length]);

  const onQualityPick = (value: string) => {
    const level = Number(value);
    setManualQuality(level);
    setQualityOpen(false);
    setSettingsOpen(false);

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

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  };

  const skipBy = (seconds: number) => {
    const video = videoRef.current;
    if (!video || showLive) return;
    const max = Number.isFinite(video.duration) ? video.duration : 0;
    video.currentTime = Math.min(Math.max(0, video.currentTime + seconds), max);
    setCurrentTime(video.currentTime);
  };

  const seekToPct = (pct: number) => {
    const video = videoRef.current;
    if (!video || showLive || !Number.isFinite(video.duration)) return;
    video.currentTime = pct * video.duration;
    setCurrentTime(video.currentTime);
  };

  const progressFromEvent = (clientX: number) => {
    const bar = progressRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const onProgressPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (showLive) return;
    const pct = progressFromEvent(event.clientX);
    setScrubPreviewPct(pct);
    if (isScrubbing) seekToPct(pct);
  };

  const onProgressPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (showLive) return;
    setIsScrubbing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    seekToPct(progressFromEvent(event.clientX));
  };

  const onProgressPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isScrubbing) {
      seekToPct(progressFromEvent(event.clientX));
    }
    setIsScrubbing(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  };

  const onVolumeInput = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = value;
    video.muted = value === 0;
  };

  const toggleCaptions = () => {
    const video = videoRef.current;
    if (!video) return;
    const next = !captionsOn;
    for (let i = 0; i < video.textTracks.length; i += 1) {
      video.textTracks[i].mode = next ? 'showing' : 'hidden';
    }
    setCaptionsOn(next);
  };

  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video || !pipSupported) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      /* PiP may be blocked in cross-origin iframe */
    }
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await container.requestFullscreen();
      }
    } catch {
      /* fullscreen may be blocked */
    }
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const previewTime = scrubPreviewPct != null && duration > 0 ? scrubPreviewPct * duration : null;

  const playerClassName = [
    'hf-player',
    isEmbed ? 'hf-player--embed' : 'hf-player--default',
    'hydrofoil-player',
    controlsVisible ? 'hf-player--controls-visible' : 'hf-player--controls-hidden',
    isPlaying ? 'hf-player--playing' : 'hf-player--paused',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const qualityItemClass = (active: boolean) =>
    ['hf-player__quality-item', active ? 'is-active' : ''].filter(Boolean).join(' ');

  const qualityMenu = showQualityMenu ? (
    <div className="hf-player__quality-menu" role="menu">
      <p className="hf-player__menu-heading">Quality</p>
      <button
        type="button"
        role="menuitem"
        className={qualityItemClass(manualQuality === -1)}
        onClick={() => onQualityPick('-1')}
      >
        Auto
      </button>
      {menuOptions.map((option) => (
        <button
          key={`${option.label}-${option.index}`}
          type="button"
          role="menuitem"
          className={qualityItemClass(manualQuality === option.index)}
          onClick={() => onQualityPick(String(option.index))}
        >
          {option.label}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div
      ref={containerRef}
      className={playerClassName}
      onMouseMove={() => revealControls(true)}
      onMouseLeave={() => {
        if (isPlaying) setControlsVisible(false);
      }}
    >
      <video
        ref={videoRef}
        className="hf-player__video"
        playsInline
        muted={mutedProp}
        onClick={togglePlay}
      />

      <div className="hf-player__overlay hf-player__overlay--top" aria-hidden={false}>
        <div className="hf-player__overlay-left">
          {showDownload && (
            <div ref={downloadRef} className="hf-player__download-wrap">
              <button
                type="button"
                className={['hf-player__download-btn', downloadOpen ? 'is-open' : ''].filter(Boolean).join(' ')}
                aria-label="Download"
                aria-expanded={downloadOpen}
                onClick={() => {
                  setDownloadOpen((open) => !open);
                  setQualityOpen(false);
                  setSettingsOpen(false);
                }}
              >
                <IconDownload />
                <span>Download</span>
                <IconChevronDown />
              </button>
              {downloadOpen && (
                <div className="hf-player__download-menu" role="menu">
                  <a
                    role="menuitem"
                    className="hf-player__download-item"
                    href={downloadUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setDownloadOpen(false)}
                  >
                    Download video
                  </a>
                </div>
              )}
            </div>
          )}
          {!isEmbed && title && <span className="hf-player__title">{title}</span>}
        </div>

        <div className="hf-player__overlay-right">
          {showQualityMenu && (
            <div ref={qualityRef} className="hf-player__quality-badge-wrap">
              <button
                type="button"
                className={['hf-player__quality-badge', qualityOpen ? 'is-open' : ''].filter(Boolean).join(' ')}
                aria-label={`Quality: ${currentQualityLabel}`}
                aria-expanded={qualityOpen}
                onClick={() => {
                  setQualityOpen((open) => !open);
                  setSettingsOpen(false);
                  setDownloadOpen(false);
                }}
              >
                <span className="hf-player__quality-auto">{currentQualityLabel}</span>
                {resolutionBadge && (
                  <span className="hf-player__quality-res">{resolutionBadge}</span>
                )}
              </button>
              {qualityOpen && qualityMenu}
            </div>
          )}
          {showLive && <span className="hf-player__badge hf-player__badge--live">Live</span>}
          {!showLive && !showQualityMenu && (
            <span className="hf-player__badge hf-player__badge--vod">VOD</span>
          )}
        </div>
      </div>

      <div className="hf-player__controls">
        {!showLive && (
          <div
            ref={progressRef}
            className="hf-player__progress"
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={currentTime}
            onPointerMove={onProgressPointerMove}
            onPointerDown={onProgressPointerDown}
            onPointerUp={onProgressPointerUp}
            onPointerLeave={() => {
              if (!isScrubbing) setScrubPreviewPct(null);
            }}
          >
            <div className="hf-player__progress-track">
              <div className="hf-player__progress-buffer" style={{ width: `${progressPct}%` }} />
              <div className="hf-player__progress-played" style={{ width: `${progressPct}%` }}>
                <span className="hf-player__progress-thumb" />
              </div>
            </div>
            {previewTime != null && (
              <div
                className="hf-player__scrub-preview"
                style={{ left: `${(scrubPreviewPct ?? 0) * 100}%` }}
              >
                <span className="hf-player__scrub-time">{formatClock(previewTime)}</span>
              </div>
            )}
          </div>
        )}

        <div className="hf-player__toolbar">
          <div className="hf-player__toolbar-left">
            <button type="button" className="hf-player__btn" aria-label={isPlaying ? 'Pause' : 'Play'} onClick={togglePlay}>
              {isPlaying ? <IconPause /> : <IconPlay />}
            </button>
            {!showLive && (
              <>
                <button type="button" className="hf-player__btn" aria-label="Skip back 10 seconds" onClick={() => skipBy(-10)}>
                  <IconSkipBack />
                </button>
                <button type="button" className="hf-player__btn" aria-label="Skip forward 10 seconds" onClick={() => skipBy(10)}>
                  <IconSkipForward />
                </button>
              </>
            )}
            <div className="hf-player__volume">
              <button type="button" className="hf-player__btn" aria-label={isMuted ? 'Unmute' : 'Mute'} onClick={toggleMute}>
                <IconVolume muted={isMuted} level={volume} />
              </button>
              <input
                type="range"
                className="hf-player__volume-slider"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                aria-label="Volume"
                onChange={(event) => onVolumeInput(Number(event.target.value))}
              />
            </div>
            <span className="hf-player__time">
              {showLive ? 'LIVE' : formatTimeRange(currentTime, duration)}
            </span>
          </div>

          <div className="hf-player__toolbar-right">
            {hasTextTracks && (
              <button
                type="button"
                className={['hf-player__btn', captionsOn ? 'is-active' : ''].filter(Boolean).join(' ')}
                aria-label={captionsOn ? 'Disable captions' : 'Enable captions'}
                aria-pressed={captionsOn}
                onClick={toggleCaptions}
              >
                <IconCaptions />
              </button>
            )}
            {showQualityMenu && (
              <div ref={settingsRef} className="hf-player__settings-wrap">
                <button
                  type="button"
                  className={['hf-player__btn', settingsOpen ? 'is-active' : ''].filter(Boolean).join(' ')}
                  aria-label="Settings"
                  aria-expanded={settingsOpen}
                  onClick={() => {
                    setSettingsOpen((open) => !open);
                    setQualityOpen(false);
                    setDownloadOpen(false);
                  }}
                >
                  <IconSettings />
                </button>
                {settingsOpen && (
                  <div className="hf-player__settings-menu">
                    {qualityMenu}
                  </div>
                )}
              </div>
            )}
            {pipSupported && (
              <button type="button" className="hf-player__btn" aria-label="Picture in picture" onClick={() => void togglePiP()}>
                <IconPiP />
              </button>
            )}
            <button
              type="button"
              className="hf-player__btn"
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              onClick={() => void toggleFullscreen()}
            >
              {isFullscreen ? <IconFullscreenExit /> : <IconFullscreen />}
            </button>
          </div>
        </div>
      </div>

      {error && <p className="hf-player__error">{error}</p>}
    </div>
  );
};
