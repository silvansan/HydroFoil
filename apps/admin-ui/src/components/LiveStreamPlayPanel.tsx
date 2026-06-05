import React from 'react';

import { Button } from '@hydrofoil/ui-kit';

import { useLivePlaybackResolve } from '../hooks/useLivePlaybackResolve';
import { playbackUrlsForIngest, rtmpMonitorUrl } from '../lib/playback';
import { CopyableUrl } from './CopyableUrl';
import { RtmpMonitorPlayer } from './RtmpMonitorPlayer';
import { WhepPlayer } from './WhepPlayer';

type PlayMode = 'webrtc' | 'flv';

export interface LiveStreamPlayPanelProps {
  streamKey: string;
  gatewayApp: string;
  status?: string;
  showRtmpUrl?: boolean;
}

/** In-browser live play: WebRTC/WHEP first, HTTP-FLV fallback. */
export const LiveStreamPlayPanel: React.FC<LiveStreamPlayPanelProps> = ({
  streamKey,
  gatewayApp,
  status,
  showRtmpUrl = true,
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
  const [mode, setMode] = React.useState<PlayMode>('webrtc');
  const [webrtcFailed, setWebrtcFailed] = React.useState(false);

  const activeMode = webrtcFailed ? 'flv' : mode;
  const rtmpPlay = playback.resolved?.rtmpPlayUrl ?? rtmpMonitorUrl(streamKey, gatewayApp);
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
            : 'HTTP-FLV fallback (~2–5s). Same stream as RTMP/VLC.'}
        </p>
        <div className="flex gap-1">
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
        </div>
      </div>

      {webrtcFailed && activeMode === 'flv' && (
        <p className="text-xs text-amber-400/90">WebRTC unavailable — using HTTP-FLV.</p>
      )}

      {activeMode === 'webrtc' ? (
        <WhepPlayer endpoint={urls.whep} autoPlay onError={handleWebrtcError} />
      ) : (
        <RtmpMonitorPlayer
          streamKey={streamKey}
          gatewayApp={gatewayApp}
          flvSrc={playback.monitorFlvUrl}
          vhost={playback.resolved?.vhost}
          rtmpPlayUrl={rtmpPlay}
        />
      )}

      {showRtmpUrl && (
        <div>
          <label className="text-xs font-medium text-slate-400">RTMP play (VLC / vMix)</label>
          <CopyableUrl url={rtmpPlay} className="mt-1 text-xs break-all" />
        </div>
      )}
    </div>
  );
};
