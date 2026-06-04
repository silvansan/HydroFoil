import React from 'react';
import { useSearchParams } from 'react-router-dom';

import { HydroFoilPlayer } from '@hydrofoil/player';
import { absoluteApiUrl, absoluteHlsUrl, protectedLivePlaybackPath } from '../lib/playback';
import { useLivePlaybackResolve } from '../hooks/useLivePlaybackResolve';

/** Standalone embed page for iframe — no admin chrome. */
const EmbedPlayerPage: React.FC = () => {
  const [params] = useSearchParams();

  const app = params.get('app') ?? 'live';
  const stream = params.get('stream') ?? '';
  const srcParam = params.get('src');
  const token = params.get('token');
  const title = params.get('title') ?? (stream ? `${app}/${stream}` : 'HydroFoil');
  const isLive = params.get('live') !== '0';
  const safeApp = app.replace(/^\/+|\/+$/g, '') || 'live';
  const safeStream = stream.replace(/^\/+|\/+$/g, '');

  const playback = useLivePlaybackResolve(safeApp, safeStream, {
    enabled: Boolean(safeStream && isLive && !srcParam && !token),
    refreshMs: 10000,
  });

  const src = React.useMemo(() => {
    if (srcParam) return srcParam;
    if (!safeStream) return '';
    if (token && isLive) {
      return absoluteApiUrl(protectedLivePlaybackPath(safeApp, safeStream, 'm3u8', token));
    }
    if (isLive && playback.playerHlsUrl) {
      return playback.playerHlsUrl;
    }
    return absoluteHlsUrl(safeStream, safeApp);
  }, [srcParam, safeStream, token, isLive, safeApp, playback.playerHlsUrl]);

  if (!src) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a1628',
          color: '#94a3b8',
          fontFamily: 'system-ui, sans-serif',
          padding: '1rem',
        }}
      >
        Missing stream — use <code>?app=live&amp;stream=your-key</code> or <code>?src=…m3u8</code>
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
        title={title}
        isLive={isLive && (token ? true : playback.playable)}
        playbackMode={isLive ? 'live-hls' : 'vod-hls'}
        autoPlay
        muted={false}
      />
    </div>
  );
};

export default EmbedPlayerPage;
