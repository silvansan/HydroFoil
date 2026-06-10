import React from 'react';
import { useSearchParams } from 'react-router-dom';

import { HydroFoilPlayer } from '@hydrofoil/player';
import { EmbedStatusMessage } from '../components/EmbedStatusMessage';
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
  const signedLinkRequired = manifest.manifest?.playbackAccessPolicy === 'token-required';
  const token = tokenParam;
  const flvSrc =
    signedLinkRequired && !token ? '' : (manifest.manifest?.playerFlvUrl ?? '');
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
    if (signedLinkRequired && !token) return '';
    if (canUseHls || preferHlsForAbr) return manifest.manifest.playerHlsUrl;
    if (!isLive) return manifest.manifest.playerHlsUrl;
    return '';
  }, [
    manifest.manifest?.playerHlsUrl,
    signedLinkRequired,
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

  if (manifest.loading && !readyToPlay && !signedLinkRequired) {
    return <EmbedStatusMessage title="Connecting…" />;
  }

  if (manifest.error && !readyToPlay) {
    return <EmbedStatusMessage title="Stream Unavailable" subtitle={manifest.error} />;
  }

  if (signedLinkRequired && !token) {
    return (
      <EmbedStatusMessage
        title="Restricted Stream"
        subtitle="This embed requires a secure signed link."
      />
    );
  }

  if (!safeStream && !srcParam) {
    return (
      <EmbedStatusMessage
        title="Missing Stream"
        subtitle="Use ?app=live&stream=your-key in the embed URL."
      />
    );
  }

  if (isLive && manifest.manifest && !manifest.manifest.active) {
    return <EmbedStatusMessage title="Stream Offline" />;
  }

  if (isLive && manifest.manifest?.active && !canUseHls && !canUseFlv && !manifest.loading) {
    return (
      <EmbedStatusMessage
        title="Starting Up…"
        subtitle="Publisher is connected. Playback will begin shortly."
      />
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

export default EmbedPlayerPage;
