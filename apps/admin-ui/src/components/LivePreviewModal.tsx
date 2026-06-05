import React from 'react';
import { X } from 'lucide-react';
import { Button, Card } from '@hydrofoil/ui-kit';

import { LiveStreamPlayPanel } from './LiveStreamPlayPanel';
import { SessionStatusBadge } from './SessionStatusBadge';

interface LivePreviewModalProps {
  streamKey: string;
  gatewayApp?: string;
  status?: string;
  onClose: () => void;
}

export const LivePreviewModal: React.FC<LivePreviewModalProps> = ({
  streamKey,
  gatewayApp = 'live',
  status,
  onClose,
}) => {
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
      aria-label="Play stream"
      onClick={onClose}
    >
      <Card
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col shadow-hydro border-brand-500/20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-700/50">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Play stream</h2>
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
            aria-label="Close"
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-slate-100"
          >
            <X size={22} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          <LiveStreamPlayPanel streamKey={streamKey} gatewayApp={gatewayApp} status={status} />
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
