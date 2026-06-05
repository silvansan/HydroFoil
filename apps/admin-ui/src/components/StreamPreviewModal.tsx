import React from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';

import { Button, Card } from '@hydrofoil/ui-kit';
import { HydroFoilPlayer } from '@hydrofoil/player';

import { useLivePlaybackResolve } from '../hooks/useLivePlaybackResolve';
import { absoluteApiUrl } from '../lib/playback';
import { rtmpIngestUrl } from '../lib/stream';
import { CopyableUrl } from './CopyableUrl';
import { LiveStreamPlayPanel } from './LiveStreamPlayPanel';
import { SessionStatusBadge } from './SessionStatusBadge';

export interface StreamPreviewTarget {
  streamKey: string;
  gatewayApp: string;
  label?: string;
  status?: string;
}

interface StreamPreviewModalProps {
  target: StreamPreviewTarget;
  onClose: () => void;
}

export const StreamPreviewModal: React.FC<StreamPreviewModalProps> = ({ target, onClose }) => {
  const { streamKey, gatewayApp, label, status } = target;
  const isPublishing = status === 'publishing';
  const playback = useLivePlaybackResolve(gatewayApp, streamKey, {
    enabled: true,
    refreshMs: isPublishing ? 10000 : 0,
  });

  const rtmpPublish = playback.resolved?.rtmpPublishUrl ?? rtmpIngestUrl(streamKey, gatewayApp);
  const webHlsAvailable = playback.resolved?.webPlaybackAvailable ?? false;
  const embedHlsUrl = playback.resolved?.webHlsRouteTarget
    ? playback.resolved.webHlsRouteTarget.startsWith('http')
      ? playback.resolved.webHlsRouteTarget
      : absoluteApiUrl(playback.resolved.playerHlsUrl)
    : absoluteApiUrl(`/srs-media/${gatewayApp}/${streamKey}.m3u8`);

  const showLivePlayer = isPublishing || playback.playable || playback.active;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Stream preview"
      onClick={onClose}
    >
      <Card
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col shadow-hydro border-brand-500/20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-700/50">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              {label ? `Preview — ${label}` : 'Preview stream'}
            </h2>
            <p className="text-sm text-slate-400 mt-0.5 font-mono">
              /{gatewayApp}/{streamKey}
            </p>
            {status && (
              <div className="mt-2">
                <SessionStatusBadge status={status} />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-slate-100"
          >
            <X size={22} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {showLivePlayer ? (
            <LiveStreamPlayPanel streamKey={streamKey} gatewayApp={gatewayApp} status={status} />
          ) : (
            <p className="text-sm text-slate-400">Publish to this ingest URL to preview here.</p>
          )}

          <div>
            <label className="text-xs font-medium text-slate-400">RTMPS ingest</label>
            <CopyableUrl url={rtmpPublish} className="mt-1 text-xs break-all" />
          </div>

          {webHlsAvailable && (
            <div className="space-y-2 border-t border-slate-700/50 pt-4">
              <p className="text-xs text-slate-500">
                HLS web embed (outputs / restreams) —{' '}
                <Link to="/outputs" className="text-brand-400 hover:underline" onClick={onClose}>
                  Outputs
                </Link>
              </p>
              <HydroFoilPlayer
                src={embedHlsUrl}
                title={label ?? `${gatewayApp}/${streamKey}`}
                isLive={playback.playable}
                playbackMode="live-hls"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-700/50 px-5 py-3">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </Card>
    </div>
  );
};
