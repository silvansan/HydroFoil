import React from 'react';
import { useSearchParams } from 'react-router-dom';

import { HydroFoilPlayer } from '@hydrofoil/player';
import { absoluteHlsUrl } from '../lib/playback';

/** Standalone embed page for iframe — no admin chrome. */
const EmbedPlayerPage: React.FC = () => {
  const [params] = useSearchParams();

  const app = params.get('app') ?? 'live';
  const stream = params.get('stream') ?? '';
  const srcParam = params.get('src');
  const title = params.get('title') ?? (stream ? `${app}/${stream}` : 'HydroFoil');
  const isLive = params.get('live') !== '0';
  const safeApp = app.replace(/^\/+|\/+$/g, '') || 'live';
  const safeStream = stream.replace(/^\/+|\/+$/g, '');

  const src =
    srcParam ??
    (safeStream && isLive
      ? absoluteHlsUrl(safeStream, safeApp)
      : safeStream
        ? absoluteHlsUrl(safeStream, safeApp)
        : '');

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
        isLive={isLive}
        playbackMode={isLive ? 'live-hls' : 'vod-hls'}
        autoPlay
        muted={false}
      />
    </div>
  );
};

export default EmbedPlayerPage;
