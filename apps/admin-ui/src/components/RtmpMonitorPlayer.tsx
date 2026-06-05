import React from 'react';

import { monitorFlvCandidates } from '../lib/monitor-flv';
import { FlvPlayer } from './FlvPlayer';

export interface RtmpMonitorPlayerProps {
  streamKey: string;
  gatewayApp: string;
  flvSrc?: string | null;
  vhost?: string | null;
  rtmpPlayUrl?: string;
  className?: string;
}

/**
 * In-browser monitor for an RTMP ingest path (HTTP-FLV remux of the same live stream as VLC).
 */
export const RtmpMonitorPlayer: React.FC<RtmpMonitorPlayerProps> = ({
  streamKey,
  gatewayApp,
  flvSrc,
  vhost,
  rtmpPlayUrl,
  className = '',
}) => {
  const candidates = React.useMemo(
    () => monitorFlvCandidates(streamKey, gatewayApp, { primary: flvSrc, vhost }),
    [streamKey, gatewayApp, flvSrc, vhost]
  );
  const [candidateIndex, setCandidateIndex] = React.useState(0);
  const activeSrc = candidates[candidateIndex] ?? candidates[0] ?? '';

  React.useEffect(() => {
    setCandidateIndex(0);
  }, [streamKey, gatewayApp, flvSrc, vhost]);

  const tryNextCandidate = React.useCallback(() => {
    setCandidateIndex((current) => {
      if (current + 1 < candidates.length) return current + 1;
      return current;
    });
  }, [candidates.length]);

  if (!activeSrc) {
    return (
      <p className="text-sm text-slate-400">No playback URL available. Start publishing to this ingest.</p>
    );
  }

  return (
    <div className="space-y-2">
      <FlvPlayer
        key={activeSrc}
        src={activeSrc}
        isLive
        autoPlay
        className={className}
        showCaption={false}
        onError={tryNextCandidate}
      />
      <p className="text-xs text-slate-500">
        Same RTMP stream as VLC (~2–5s in browser via HTTP-FLV).
        {rtmpPlayUrl ? ' External play URL is below.' : ''}
        {candidateIndex > 0 ? ` (fallback ${candidateIndex + 1}/${candidates.length})` : ''}
      </p>
    </div>
  );
};
