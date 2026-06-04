import React from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { Button, Card } from '@hydrofoil/ui-kit';

import { useLivePlaybackResolve } from '../hooks/useLivePlaybackResolve';
import { buildLiveIframeEmbedCode, rtmpMonitorUrl } from '../lib/playback';
import { copyText } from '../lib/clipboard';
import { rtmpIngestUrl } from '../lib/stream';
import { ClickableStreamUrl } from './CopyableUrl';
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
  const [toast, setToast] = React.useState<string | null>(null);
  const isPublishing = status === 'publishing';
  const playback = useLivePlaybackResolve(gatewayApp, streamKey, {
    enabled: true,
    refreshMs: isPublishing ? 10000 : 0,
  });

  const rtmpPlay = playback.resolved?.rtmpPlayUrl ?? rtmpMonitorUrl(streamKey, gatewayApp);
  const rtmpPublish = playback.resolved?.rtmpPublishUrl ?? rtmpIngestUrl(streamKey, gatewayApp);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2000);
  };

  const copy = async (label: string, text: string) => {
    const ok = await copyText(text);
    notify(ok ? `${label} copied` : 'Copy failed');
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Live preview"
      onClick={onClose}
    >
      <Card
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col shadow-hydro border-brand-500/20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-700/50">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Live preview</h2>
            <p className="text-sm text-slate-400 mt-0.5 font-mono">
              /{gatewayApp}/{streamKey}
            </p>
            {status && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <SessionStatusBadge status={status} />
                {isPublishing && playback.playable && (
                  <span className="text-xs text-emerald-400">Live — open RTMP play URL in VLC</span>
                )}
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
          <p className="text-sm text-slate-400">
            Monitor uses <strong className="text-slate-200">RTMP</strong> (not in-browser HLS). For website
            embeds, add an HLS output or restream.
          </p>
          <div>
            <label className="text-xs font-medium text-slate-400">Publish</label>
            <ClickableStreamUrl url={rtmpPublish} className="mt-1 text-xs block" onCopied={notify} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400">Play (VLC / vMix)</label>
            <ClickableStreamUrl url={rtmpPlay} className="mt-1 text-xs block" onCopied={notify} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => copy('Publish URL', rtmpPublish)}>
              Copy publish URL
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => copy('Play URL', rtmpPlay)}>
              Copy play URL
            </Button>
            {playback.resolved?.webPlaybackAvailable && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => copy('Embed code', buildLiveIframeEmbedCode(streamKey, gatewayApp))}
              >
                Copy HLS embed code
              </Button>
            )}
          </div>

          {!playback.resolved?.webPlaybackAvailable && (
            <p className="text-xs text-slate-500">
              <Link to="/outputs" className="text-brand-400 hover:underline" onClick={onClose}>
                Add an HLS output
              </Link>{' '}
              for web playback.
            </p>
          )}
        </div>

        {toast && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-4 py-1.5 text-sm text-white shadow-lg">
            {toast}
          </div>
        )}
      </Card>
    </div>
  );
};
