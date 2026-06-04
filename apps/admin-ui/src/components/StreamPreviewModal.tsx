import React from 'react';

import { X } from 'lucide-react';

import { Button, Card } from '@hydrofoil/ui-kit';

import { api } from '../api/client';


import { FlvPlayer } from './FlvPlayer';

import { HydroFoilPlayer } from '@hydrofoil/player';

import { SessionStatusBadge } from './SessionStatusBadge';

import {

  absoluteFlvUrl,
  absoluteHlsUrl,

  buildHlsEmbedCode,
  buildLiveIframeEmbedCode,
  playbackUrlsForIngest,

} from '../lib/playback';

import { ClickableStreamUrl } from './CopyableUrl';

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



type UrlChoice = 'hls' | 'flv';



export const StreamPreviewModal: React.FC<StreamPreviewModalProps> = ({ target, onClose }) => {

  const { streamKey, gatewayApp, label, status } = target;

  const isLive = status === 'publishing';

  const [urlChoice, setUrlChoice] = React.useState<UrlChoice>(isLive ? 'hls' : 'hls');

  const [toast, setToast] = React.useState<string | null>(null);
  const [protectedPlayback, setProtectedPlayback] = React.useState<{
    token: string;
    hlsUrl: string;
    flvUrl: string;
    embedUrl: string;
  } | null>(null);



  const urls = React.useMemo(

    () => playbackUrlsForIngest(streamKey, gatewayApp),

    [streamKey, gatewayApp]

  );



  const hlsAbsolute = React.useMemo(

    () => absoluteHlsUrl(streamKey, gatewayApp),

    [streamKey, gatewayApp]

  );



  const flvAbsolute = React.useMemo(

    () => absoluteFlvUrl(streamKey, gatewayApp),

    [streamKey, gatewayApp]

  );



  const selectedUrl =
    urlChoice === 'hls'
      ? `${window.location.origin}${
          protectedPlayback?.embedUrl ??
          `/embed?app=${encodeURIComponent(gatewayApp)}&stream=${encodeURIComponent(
            streamKey
          )}&live=1`
        }`
      : protectedPlayback?.flvUrl
        ? `${window.location.origin}${protectedPlayback.flvUrl}`
        : flvAbsolute;



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
          flvUrl: result.flvUrl,
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



  const copySelected = async () => {

    const ok = await copyText(selectedUrl);

    notify(ok ? 'URL copied' : 'Copy failed');

  };



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

          <div>

            <label className="text-sm font-medium text-slate-300">URL to preview / copy</label>

            <div className="mt-1 flex flex-wrap gap-2">

              <select

                className="hf-select flex-1 min-w-[12rem]"

                value={urlChoice}

                onChange={(e) => setUrlChoice(e.target.value as UrlChoice)}

              >

                <option value="flv">HTTP-FLV — monitor (low latency)</option>

                <option value="hls">Player page — protected embed</option>

              </select>

              <Button type="button" variant="secondary" size="sm" onClick={copySelected}>

                Copy

              </Button>

            </div>

            <ClickableStreamUrl

              url={selectedUrl}

              className="mt-2 text-xs block max-w-full"

              onCopied={notify}

              copiedMessage="URL copied"

            />

          </div>



          {urlChoice === 'hls' ? (
            <HydroFoilPlayer
              src={hlsAbsolute}
              title={label ?? `${gatewayApp}/${streamKey}`}
              isLive={isLive}
              playbackMode="live-hls"
            />
          ) : (

            <FlvPlayer src={protectedPlayback?.flvUrl ?? urls.flv} />

          )}



          <div className="flex flex-wrap gap-2">

            <Button
              type="button"
              variant="secondary"
              size="sm"
                onClick={() =>
                copyText(
                  buildLiveIframeEmbedCode(
                    streamKey,
                    gatewayApp,
                    protectedPlayback?.token
                  )
                ).then((ok) =>
                  notify(ok ? 'Iframe embed copied' : 'Copy failed')
                )
              }
            >
              Copy iframe embed
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
                onClick={() =>
                copyText(
                  buildHlsEmbedCode(
                    protectedPlayback?.embedUrl
                      ? `${window.location.origin}${protectedPlayback.embedUrl}`
                      : `${window.location.origin}/embed?app=${encodeURIComponent(gatewayApp)}&stream=${encodeURIComponent(streamKey)}&live=1`
                  )
                ).then((ok) =>
                  notify(ok ? 'Script embed copied' : 'Copy failed')
                )
              }
            >
              Copy script embed
            </Button>

            {urlChoice === 'hls' && (

              <Button

                type="button"

                variant="secondary"

                size="sm"

                onClick={() =>
                  window.open(
                    protectedPlayback?.embedUrl
                      ? `${window.location.origin}${protectedPlayback.embedUrl}`
                      : `${window.location.origin}/embed?app=${encodeURIComponent(gatewayApp)}&stream=${encodeURIComponent(streamKey)}&live=1`,
                    '_blank',
                    'noopener,noreferrer'
                  )
                }

              >

                Open player page

              </Button>

            )}

            {urlChoice === 'flv' && (

              <Button

                type="button"

                variant="secondary"

                size="sm"

                onClick={() =>
                  window.open(
                    protectedPlayback?.flvUrl
                      ? `${window.location.origin}${protectedPlayback.flvUrl}`
                      : flvAbsolute,
                    '_blank',
                    'noopener,noreferrer'
                  )
                }

              >

                Open FLV in tab

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


