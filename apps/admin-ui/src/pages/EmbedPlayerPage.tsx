import React from 'react';
import { useSearchParams } from 'react-router-dom';

import { HydroFoilPlayer } from '@hydrofoil/player';
import { useEmbedPlaybackManifest } from '../hooks/useEmbedPlaybackManifest';
import { useEmbedResizeReporter } from '../hooks/useEmbedResizeReporter';

const EMPTY_ABR_RENDITIONS: Array<{ label: string; height: number }> = [];

/** Standalone embed page for iframe — no admin chrome. */
const EmbedPlayerPage: React.FC = () => {
  useEmbedResizeReporter();
  const [params] = useSearchParams();

  const app = params.get('app') ?? 'live';
  const stream = params.get('stream') ?? '';
  const srcParam = params.get('src');
  const tokenParam = params.get('token');
  const title = params.get('title') ?? (stream ? `${app}/${stream}` : 'HydroFoil');
  const isLive = params.get('live') !== '0';
  const safeApp = app.replace(/^\/+|\/+$/g, '') || 'live';
  const safeStream = stream.replace(/^\/+|\/+$/g, '');

  const manifest = useEmbedPlaybackManifest(safeApp, safeStream, {
    enabled: Boolean(safeStream && isLive && !srcParam),
    refreshMs: 10000,
    token: tokenParam,
  });

  const isProtectedPlayback = manifest.manifest?.playbackAccessPolicy !== 'public';
  const token = tokenParam;
  const flvSrc = manifest.manifest?.playerFlvUrl ?? '';
  const flvFallbackSrcs = React.useMemo(() => {
    if (isProtectedPlayback) return [];
    const playApp = manifest.manifest?.playApp ?? safeApp;
    const playStream = manifest.manifest?.playStream ?? safeStream;
    if (!playApp || !playStream || typeof window === 'undefined') return [];
    const origin = window.location.origin;
    return [`${origin}/srs-media/${playApp}/${playStream}.flv`];
  }, [
    isProtectedPlayback,
    manifest.manifest?.playApp,
    manifest.manifest?.playStream,
    safeApp,
    safeStream,
  ]);
  const abrRenditions = manifest.manifest?.abrRenditions ?? EMPTY_ABR_RENDITIONS;
  const renditionHintsKey = React.useMemo(
    () => JSON.stringify(abrRenditions.map((row) => [row.label, row.height])),
    [abrRenditions]
  );
  const renditionHints = React.useMemo(
    () =>
      abrRenditions.map((row) => ({
        label: row.label,
        height: row.height,
      })),
    [renditionHintsKey]
  );
  const hasAbr = abrRenditions.length > 0;
  const canUseFlv =
    isLive &&
    Boolean(manifest.manifest?.active && manifest.manifest?.flvPlayable && flvSrc);
  const canUseHls = Boolean(manifest.manifest?.playable && manifest.manifest?.playerHlsUrl);
  const preferHlsForAbr = hasAbr && Boolean(manifest.manifest?.playerHlsUrl);
  const preferFlv = canUseFlv && !canUseHls && !preferHlsForAbr;

  const hlsSrc = React.useMemo(() => {
    if (!manifest.manifest?.playerHlsUrl) return '';
    if (manifest.manifest.requiresToken && !token) return '';
    if (canUseHls || preferHlsForAbr) return manifest.manifest.playerHlsUrl;
    if (!isLive) return manifest.manifest.playerHlsUrl;
    return '';
  }, [
    manifest.manifest?.playerHlsUrl,
    manifest.manifest?.requiresToken,
    manifest.manifest?.active,
    token,
    canUseHls,
    preferHlsForAbr,
    isLive,
  ]);

  const src = srcParam ?? hlsSrc;
  const readyToPlay = Boolean(srcParam) || canUseHls || canUseFlv || preferHlsForAbr;
  const playbackMode =
    preferHlsForAbr || canUseHls ? 'live-hls' : preferFlv ? 'live-flv' : isLive ? 'live-hls' : 'vod-hls';

  if (manifest.loading && !readyToPlay) {
    return (
      <div style={messageStyle}>
        <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>Loading stream…</p>
      </div>
    );
  }

  if (manifest.error && !readyToPlay) {
    return (
      <div style={messageStyle}>
        <p style={{ color: '#b91c1c', fontSize: '0.875rem', margin: 0 }}>{manifest.error}</p>
      </div>
    );
  }

  if (
    !readyToPlay &&
    manifest.manifest?.requiresToken &&
    !token &&
    manifest.manifest.playbackAccessPolicy !== 'public'
  ) {
    return (
      <div style={messageStyle}>
        <p style={{ color: '#b91c1c', fontSize: '0.875rem', margin: 0, textAlign: 'center' }}>
          This stream requires a signed embed link. In HydroFoil, open the stream key → Web
          playback, then copy the embed link or iframe code (it includes a short-lived token).
        </p>
      </div>
    );
  }

  if (!safeStream && !srcParam) {
    return (
      <div style={messageStyle}>
        <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>
          Missing stream — use <code>?app=live&amp;stream=your-key</code> or{' '}
          <code>?src=…m3u8</code>
        </p>
      </div>
    );
  }

  if (isLive && manifest.manifest && !manifest.manifest.active) {
    return (
      <div style={messageStyle}>
        <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0, textAlign: 'center' }}>
          Stream is offline.
        </p>
      </div>
    );
  }

  if (isLive && manifest.manifest?.active && !canUseHls && !canUseFlv && !manifest.loading) {
    return (
      <div style={messageStyle}>
        <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0, textAlign: 'center' }}>
          Publisher is connected, but playback is not ready yet. Wait a few seconds and refresh,
          or check SRS ingest vhost settings on the server.
        </p>
      </div>
    );
  }

  return (
    <HydroFoilPlayer
      src={src}
      flvSrc={flvSrc || undefined}
      flvFallbackSrcs={flvFallbackSrcs}
      renditionHints={renditionHints}
      title={title}
      isLive={isLive && Boolean(manifest.manifest?.active)}
      playbackMode={playbackMode}
      variant="embed"
      autoPlay
      muted={false}
    />
  );
};

const messageStyle: React.CSSProperties = {
  padding: '1rem',
  fontFamily: 'system-ui, sans-serif',
  background: 'transparent',
  lineHeight: 1.4,
};

export default EmbedPlayerPage;
