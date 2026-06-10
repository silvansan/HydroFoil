import React from 'react';

import { HydroFoilPlayer } from '@hydrofoil/player';
import { Button } from '@hydrofoil/ui-kit';

import { useLivePlaybackResolve } from '../hooks/useLivePlaybackResolve';
import { playbackUrlsForIngest } from '../lib/playback';
import { RtmpMonitorPlayer } from './RtmpMonitorPlayer';
import { WhepPlayer } from './WhepPlayer';

type PlayMode = 'webrtc' | 'flv' | 'hls';

export interface LiveStreamPlayPanelProps {
  streamKey: string;
  gatewayApp: string;
  status?: string;
}

/** In-browser live play: WebRTC/WHEP, HTTP-FLV, or HLS with ABR quality selection. */
export const LiveStreamPlayPanel: React.FC<LiveStreamPlayPanelProps> = ({
  streamKey,
  gatewayApp,
  status,
}) => {
  const isPublishing = status === 'publishing';
  const playback = useLivePlaybackResolve(gatewayApp, streamKey, {
    enabled: true,
    refreshMs: isPublishing ? 10000 : 0,
  });
  const urls = React.useMemo(
    () => playbackUrlsForIngest(streamKey, gatewayApp),
    [streamKey, gatewayApp]
  );
  const abrRenditions = playback.resolved?.abrRenditions ?? [];
  const hasAbr = abrRenditions.length > 0;
  const hlsPlayable = playback.hlsPlayable;
  const [mode, setMode] = React.useState<PlayMode>('webrtc');
  const [webrtcFailed, setWebrtcFailed] = React.useState(false);

  React.useEffect(() => {
    if (hasAbr && hlsPlayable && playback.playerHlsUrl) {
      setMode('hls');
      setWebrtcFailed(false);
    }
  }, [hasAbr, hlsPlayable, playback.playerHlsUrl, streamKey, gatewayApp]);

  const activeMode = webrtcFailed && mode === 'webrtc' ? 'flv' : mode;
  const showPlayer = isPublishing || playback.playable || playback.active;

  const handleWebrtcError = React.useCallback(() => {
    setWebrtcFailed(true);
    setMode('flv');
  }, []);

  if (!showPlayer) {
    return (
      <p className="rounded-lg border border-dashed border-slate-600 bg-slate-950/50 p-6 text-center text-sm text-slate-400">
        Start publishing to this ingest URL to play the stream here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-400">
          {activeMode === 'webrtc'
            ? 'WebRTC/WHEP — lowest latency (~0.5–2s).'
            : activeMode === 'flv'
              ? 'HTTP-FLV fallback (~2–5s).'
              : hasAbr
                ? 'HLS with ABR — choose Auto or a profile rendition.'
                : 'HLS playback (~5–15s).'}
        </p>
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            size="sm"
            variant={activeMode === 'webrtc' ? 'primary' : 'secondary'}
            onClick={() => {
              setWebrtcFailed(false);
              setMode('webrtc');
            }}
          >
            WebRTC
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeMode === 'flv' ? 'primary' : 'secondary'}
            onClick={() => setMode('flv')}
          >
            HTTP-FLV
          </Button>
          {(hasAbr || hlsPlayable) && playback.playerHlsUrl ? (
            <Button
              type="button"
              size="sm"
              variant={activeMode === 'hls' ? 'primary' : 'secondary'}
              onClick={() => setMode('hls')}
            >
              HLS{hasAbr ? ' (ABR)' : ''}
            </Button>
          ) : null}
        </div>
      </div>

      {webrtcFailed && activeMode === 'flv' && (
        <p className="text-xs text-amber-400/90">WebRTC unavailable — using HTTP-FLV.</p>
      )}

      {activeMode === 'webrtc' ? (
        <WhepPlayer endpoint={urls.whep} autoPlay onError={handleWebrtcError} />
      ) : activeMode === 'hls' && playback.playerHlsUrl ? (
        <HydroFoilPlayer
          src={playback.playerHlsUrl}
          flvSrc={playback.monitorFlvUrl ?? undefined}
          renditionHints={abrRenditions.map((row) => ({
            label: row.label,
            height: row.height,
          }))}
          title={`${gatewayApp}/${streamKey}`}
          isLive
          playbackMode="live-hls"
          autoPlay
          muted
        />
      ) : (
        <RtmpMonitorPlayer
          streamKey={streamKey}
          gatewayApp={gatewayApp}
          flvSrc={playback.monitorFlvUrl}
          vhost={playback.resolved?.vhost}
        />
      )}

      {hasAbr && !hlsPlayable && activeMode !== 'hls' && (
        <p className="text-xs hf-muted">
          ABR profiles are assigned — switch to HLS when segments are ready to pick a rendition.
        </p>
      )}
    </div>
  );
};
