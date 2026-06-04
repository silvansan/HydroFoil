import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, X } from 'lucide-react';

import { Button, Card } from '@hydrofoil/ui-kit';
import { HydroFoilPlayer } from '@hydrofoil/player';

import { api } from '../api/client';
import { useLivePlaybackResolve } from '../hooks/useLivePlaybackResolve';
import {
  absoluteApiUrl,
  buildLiveIframeEmbedCode,
  playbackUrlsForIngest,
  rtmpMonitorUrl,
} from '../lib/playback';
import { rtmpIngestUrl } from '../lib/stream';
import { ClickableStreamUrl } from './CopyableUrl';
import { SessionStatusBadge } from './SessionStatusBadge';
import { copyText } from '../lib/clipboard';

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

type UrlChoice = 'rtmp' | 'hls';

export const StreamPreviewModal: React.FC<StreamPreviewModalProps> = ({ target, onClose }) => {
  const { streamKey, gatewayApp, label, status } = target;
  const isPublishing = status === 'publishing';
  const [urlChoice, setUrlChoice] = React.useState<UrlChoice>('rtmp');
  const [toast, setToast] = React.useState<string | null>(null);
  const [protectedPlayback, setProtectedPlayback] = React.useState<{
    token: string;
    embedUrl: string;
  } | null>(null);

  const playback = useLivePlaybackResolve(gatewayApp, streamKey, {
    enabled: true,
    refreshMs: isPublishing ? 10000 : 0,
  });

  const rtmpPlay =
    playback.resolved?.rtmpPlayUrl ?? rtmpMonitorUrl(streamKey, gatewayApp);
  const rtmpPublish = playback.resolved?.rtmpPublishUrl ?? rtmpIngestUrl(streamKey, gatewayApp);
  const webHlsAvailable = playback.resolved?.webPlaybackAvailable ?? false;
  const embedHlsUrl = playback.resolved?.webHlsRouteTarget
    ? playback.resolved.webHlsRouteTarget.startsWith('http')
      ? playback.resolved.webHlsRouteTarget
      : absoluteApiUrl(playback.resolved.playerHlsUrl)
    : absoluteApiUrl(`/srs-media/${gatewayApp}/${streamKey}.m3u8`);

  const urls = React.useMemo(
    () => playbackUrlsForIngest(streamKey, gatewayApp),
    [streamKey, gatewayApp]
  );

  React.useEffect(() => {
    if (!webHlsAvailable) return;
    api
      .issueLivePlaybackToken({ app: gatewayApp, stream: streamKey })
      .then((result) =>
        setProtectedPlayback({ token: result.token, embedUrl: result.embedUrl })
      )
      .catch(() => setProtectedPlayback(null));
  }, [gatewayApp, streamKey, webHlsAvailable]);

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

  const selectedUrl =
    urlChoice === 'rtmp'
      ? rtmpPlay
      : `${window.location.origin}${
          protectedPlayback?.embedUrl ??
          `/embed?app=${encodeURIComponent(gatewayApp)}&stream=${encodeURIComponent(streamKey)}&live=1`
        }`;

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
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <SessionStatusBadge status={status} />
                {isPublishing && !playback.playable && !playback.loading && (
                  <span className="text-xs text-amber-400">Waiting for RTMP publish on SRS</span>
                )}
                {isPublishing && playback.playable && (
                  <span className="text-xs text-emerald-400">Live on SRS — use RTMP play URL in VLC</span>
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
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4 space-y-3">
            <p className="text-sm text-slate-300">
              <strong className="text-slate-100">Operator monitor</strong> uses RTMP (same as ingest).
              Open the play URL in VLC, vMix, or OBS — browsers cannot play RTMP directly.
            </p>
            <div>
              <label className="text-xs font-medium text-slate-400">Publish (ingest)</label>
              <ClickableStreamUrl url={rtmpPublish} className="mt-1 text-xs block" onCopied={notify} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400">Play (monitor)</label>
              <ClickableStreamUrl url={rtmpPlay} className="mt-1 text-xs block" onCopied={notify} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-300">URL to copy</label>
            <div className="mt-1 flex flex-wrap gap-2">
              <select
                className="hf-select flex-1 min-w-[12rem]"
                value={urlChoice}
                onChange={(e) => setUrlChoice(e.target.value as UrlChoice)}
              >
                <option value="rtmp">RTMP — monitor (VLC / vMix)</option>
                {webHlsAvailable && <option value="hls">HLS — web embed (output/restream)</option>}
              </select>
              <Button type="button" variant="secondary" size="sm" onClick={() => copyText(selectedUrl).then((ok) => notify(ok ? 'URL copied' : 'Copy failed'))}>
                Copy
              </Button>
            </div>
            <ClickableStreamUrl url={selectedUrl} className="mt-2 text-xs block max-w-full" onCopied={notify} />
          </div>

          {urlChoice === 'hls' && webHlsAvailable ? (
            <HydroFoilPlayer
              src={embedHlsUrl}
              title={label ?? `${gatewayApp}/${streamKey}`}
              isLive={playback.playable}
              playbackMode="live-hls"
            />
          ) : (
            <div className="rounded-lg border border-dashed border-slate-600 bg-slate-950/50 p-8 text-center text-sm text-slate-400">
              {isPublishing && playback.playable ? (
                <>
                  <p className="mb-3">Stream is live. Open the RTMP play URL in an external player.</p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => copyText(rtmpPlay).then((ok) => notify(ok ? 'Play URL copied' : 'Copy failed'))}
                  >
                    Copy RTMP play URL
                  </Button>
                </>
              ) : (
                <p>Start publishing to get the RTMP play URL, or add an HLS output under Outputs / Restreams for web preview.</p>
              )}
            </div>
          )}

          {!webHlsAvailable && (
            <p className="text-xs text-slate-500">
              Web HLS embed is available after you add an output or restream with delivery{' '}
              <strong className="text-slate-400">HLS</strong> (or a transcode profile).{' '}
              <Link to="/outputs" className="text-brand-400 hover:underline" onClick={onClose}>
                Outputs
              </Link>
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => copyText(rtmpPublish).then((ok) => notify(ok ? 'Publish URL copied' : 'Copy failed'))}>
              Copy publish URL
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => copyText(rtmpPlay).then((ok) => notify(ok ? 'Play URL copied' : 'Copy failed'))}>
              Copy play URL
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => copyText(urls.rtmp).then((ok) => notify(ok ? 'RTMP copied' : 'Copy failed'))}>
              Copy RTMP base
            </Button>
            {webHlsAvailable && protectedPlayback && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  window.open(
                    `${window.location.origin}${protectedPlayback.embedUrl}`,
                    '_blank',
                    'noopener,noreferrer'
                  )
                }
              >
                <ExternalLink size={14} className="mr-1 inline" />
                Open HLS embed
              </Button>
            )}
          </div>
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
