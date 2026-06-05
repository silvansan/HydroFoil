import React from 'react';
import { Play, X } from 'lucide-react';

import { Button, Card } from '@hydrofoil/ui-kit';

import { LiveStreamPlayPanel } from './LiveStreamPlayPanel';
import { SessionStatusBadge } from './SessionStatusBadge';
import type { StreamPreviewTarget } from './StreamPreviewModal';

interface StreamMonitorModalProps {
  target: StreamPreviewTarget;
  onClose: () => void;
}

/** Play / monitor popup — WebRTC first, FLV fallback, optional RTMP URL. */
export const StreamMonitorModal: React.FC<StreamMonitorModalProps> = ({ target, onClose }) => {
  const { streamKey, gatewayApp, label, status } = target;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Play stream"
      onClick={onClose}
    >
      <Card
        className="relative w-full max-w-3xl border border-brand-500/30 shadow-hydro"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-700/50 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Play className="h-5 w-5 text-brand-400" aria-hidden />
              <h2 className="text-lg font-semibold text-slate-100">
                {label ? `Play — ${label}` : 'Play stream'}
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
            aria-label="Close"
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-slate-100"
          >
            <X size={22} />
          </button>
        </div>

        <div className="p-5">
          <LiveStreamPlayPanel
            streamKey={streamKey}
            gatewayApp={gatewayApp}
            status={status}
            showRtmpUrl
          />
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
