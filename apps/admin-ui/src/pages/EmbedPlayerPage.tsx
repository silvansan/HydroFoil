import React from 'react';
import { useSearchParams } from 'react-router-dom';

import { HydroFoilPlayer } from '@hydrofoil/player';
import { useEmbedPlaybackManifest } from '../hooks/useEmbedPlaybackManifest';

/** Standalone embed page for iframe — no admin chrome. */
const EmbedPlayerPage: React.FC = () => {
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
  });

  const token = tokenParam ?? manifest.manifest?.token;
  const flvSrc = manifest.manifest?.playerFlvUrl ?? '';
  const flvFallbackSrcs = React.useMemo(() => {
    const playApp = manifest.manifest?.playApp ?? safeApp;
    const playStream = manifest.manifest?.playStream ?? safeStream;
    if (!playApp || !playStream || typeof window === 'undefined') return [];
    const origin = window.location.origin;
    return [`${origin}/srs-media/${playApp}/${playStream}.flv`];
  }, [manifest.manifest?.playApp, manifest.manifest?.playStream, safeApp, safeStream]);
  const canUseFlv =
    isLive &&
    Boolean(manifest.manifest?.active && manifest.manifest?.flvPlayable && flvSrc);
  const canUseHls = Boolean(manifest.manifest?.playable && manifest.manifest?.playerHlsUrl);
  const preferFlv = canUseFlv && !canUseHls;

  const hlsSrc = React.useMemo(() => {
    if (!manifest.manifest?.playerHlsUrl) return '';
    if (token) return manifest.manifest.playerHlsUrl;
    if (canUseHls) return manifest.manifest.playerHlsUrl;
    if (!isLive) return manifest.manifest.playerHlsUrl;
    return '';
  }, [manifest.manifest?.playerHlsUrl, manifest.manifest?.active, token, canUseHls, isLive]);

  const src = srcParam ?? hlsSrc;
  const readyToPlay = Boolean(srcParam) || canUseHls || canUseFlv;
  const playbackMode = preferFlv ? 'live-flv' : isLive ? 'live-hls' : 'vod-hls';

  if (manifest.loading && !readyToPlay) {
    return (
      <div style={centeredStyle}>
        <p style={{ color: '#94a3b8' }}>Loading stream…</p>
      </div>
    );
  }

  if (manifest.error && !readyToPlay) {
    return (
      <div style={centeredStyle}>
        <p style={{ color: '#fecaca' }}>{manifest.error}</p>
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
      <div style={centeredStyle}>
        <p style={{ color: '#fecaca', maxWidth: '28rem', textAlign: 'center' }}>
          This stream requires a signed embed link. In HydroFoil, open the stream key → Web
          playback, then copy the embed link or iframe code (it includes a short-lived token).
        </p>
      </div>
    );
  }

  if (!safeStream && !srcParam) {
    return (
      <div style={centeredStyle}>
        <p style={{ color: '#94a3b8' }}>
          Missing stream — use <code>?app=live&amp;stream=your-key</code> or{' '}
          <code>?src=…m3u8</code>
        </p>
      </div>
    );
  }

  if (isLive && manifest.manifest && !manifest.manifest.active && !manifest.loading) {
    return (
      <div style={centeredStyle}>
        <p style={{ color: '#94a3b8', maxWidth: '28rem', textAlign: 'center' }}>
          Stream is offline. Start publishing from your encoder, then this page will refresh
          automatically.
        </p>
      </div>
    );
  }

  if (isLive && manifest.manifest?.active && !canUseHls && !canUseFlv && !manifest.loading) {
    return (
      <div style={centeredStyle}>
        <p style={{ color: '#94a3b8', maxWidth: '28rem', textAlign: 'center' }}>
          Publisher is connected, but playback is not ready yet. Wait a few seconds and refresh,
          or check SRS ingest vhost settings on the server.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a1628',
        padding: '0.5rem',
        boxSizing: 'border-box',
      }}
    >
      <HydroFoilPlayer
        src={src}
        flvSrc={flvSrc || undefined}
        flvFallbackSrcs={flvFallbackSrcs}
        title={title}
        isLive={isLive && Boolean(manifest.manifest?.active)}
        playbackMode={playbackMode}
        autoPlay
        muted={false}
      />
    </div>
  );
};

const centeredStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#0a1628',
  fontFamily: 'system-ui, sans-serif',
  padding: '1rem',
};

export default EmbedPlayerPage;
