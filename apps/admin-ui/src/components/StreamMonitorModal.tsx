import React from 'react';
import { X, Zap } from 'lucide-react';

import { Button, Card } from '@hydrofoil/ui-kit';

import { FlvPlayer } from './FlvPlayer';
import { SessionStatusBadge } from './SessionStatusBadge';
import { WhepPlayer } from './WhepPlayer';
import { playbackUrlsForIngest } from '../lib/playback';
import type { StreamPreviewTarget } from './StreamPreviewModal';

type MonitorMode = 'whep' | 'flv';

interface StreamMonitorModalProps {
  target: StreamPreviewTarget;
  onClose: () => void;
}

/** Control-room monitor — WebRTC/WHEP (~0.5–2s) with HTTP-FLV fallback (~2–5s). */
export const StreamMonitorModal: React.FC<StreamMonitorModalProps> = ({ target, onClose }) => {
  const { streamKey, gatewayApp, label, status } = target;
  const urls = React.useMemo(
    () => playbackUrlsForIngest(streamKey, gatewayApp),
    [streamKey, gatewayApp]
  );
  const [mode, setMode] = React.useState<MonitorMode>('whep');
  const [whepFailed, setWhepFailed] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const activeMode = whepFailed ? 'flv' : mode;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Stream monitor"
      onClick={onClose}
    >
      <Card
        className="relative w-full max-w-3xl border border-amber-500/30 shadow-hydro"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-700/50 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-400" aria-hidden />
              <h2 className="text-lg font-semibold text-slate-100">
                {label ? `Monitor — ${label}` : 'Live monitor'}
              </h2>
            </div>
            <p className="mt-0.5 font-mono text-sm text-slate-400">
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
            aria-label="Close monitor"
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-slate-100"
          >
            <X size={22} />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-amber-200/80">
              {activeMode === 'whep'
                ? 'WebRTC/WHEP — lowest latency (~0.5–2s). Requires SRS rtc + UDP :8000.'
                : 'HTTP-FLV fallback (~2–5s). Use Preview for HLS embed.'}
            </p>
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant={activeMode === 'whep' ? 'primary' : 'secondary'}
                onClick={() => {
                  setWhepFailed(false);
                  setMode('whep');
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

          {whepFailed && activeMode === 'flv' && (
            <p className="text-xs text-slate-500">
              WHEP unavailable — using FLV. Restart SRS after enabling rtc or check UDP port 8000.
            </p>
          )}

          {activeMode === 'whep' ? (
            <WhepPlayer
              key={urls.whep}
              endpoint={urls.whep}
              autoPlay
              onError={() => {
                setWhepFailed(true);
                setMode('flv');
              }}
            />
          ) : (
            <FlvPlayer src={urls.flv} isLive autoPlay />
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
