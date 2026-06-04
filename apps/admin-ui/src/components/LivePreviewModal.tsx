import React from 'react';
import { X } from 'lucide-react';
import { Button, Card } from '@hydrofoil/ui-kit';

import { api } from '../api/client';
import { HlsPlayer } from './HlsPlayer';
import { SessionStatusBadge } from './SessionStatusBadge';
import { absoluteHlsUrl, buildLiveIframeEmbedCode, playbackUrlsForIngest } from '../lib/playback';
import { copyText } from '../lib/clipboard';
import { rtmpIngestUrl } from '../lib/stream';

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
  const [protectedPlayback, setProtectedPlayback] = React.useState<{
    token: string;
    hlsUrl: string;
    embedUrl: string;
  } | null>(null);
  const urls = React.useMemo(
    () => playbackUrlsForIngest(streamKey, gatewayApp),
    [streamKey, gatewayApp]
  );
  React.useEffect(() => {
    api
      .issueLivePlaybackToken({
        app: gatewayApp,
        stream: streamKey,
      })
      .then((result) =>
        setProtectedPlayback({
          token: result.token,
          hlsUrl: result.hlsUrl,
          embedUrl: result.embedUrl,
        })
      )
      .catch(() => setProtectedPlayback(null));
  }, [gatewayApp, streamKey]);

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
                {status !== 'publishing' && (
                  <span className="text-xs text-slate-500">Preview may be offline</span>
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
          <HlsPlayer src={absoluteHlsUrl(streamKey, gatewayApp)} />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                copy(
                  'Embed code',
                  buildLiveIframeEmbedCode(streamKey, gatewayApp, protectedPlayback?.token)
                )
              }
            >
              Copy embed code
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => copy('RTMP URL', urls.rtmp)}>
              Copy RTMP
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => copy('Ingest URL', rtmpIngestUrl(streamKey, gatewayApp))}
            >
              Copy publish URL
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                copy(
                  'Player link',
                  `${window.location.origin}${
                    protectedPlayback?.embedUrl ??
                    `/embed?app=${encodeURIComponent(gatewayApp)}&stream=${encodeURIComponent(
                      streamKey
                    )}&live=1`
                  }`
                )
              }
            >
              Copy player link
            </Button>
          </div>

          <p className="text-xs text-slate-500 break-all">
            {`${window.location.origin}${
              protectedPlayback?.embedUrl ??
              `/embed?app=${encodeURIComponent(gatewayApp)}&stream=${encodeURIComponent(
                streamKey
              )}&live=1`
            }`}
          </p>
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
