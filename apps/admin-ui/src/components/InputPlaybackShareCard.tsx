import React from 'react';
import { Button } from '@hydrofoil/ui-kit';

import type { InputPlaybackShare } from '../api/types';
import { copyText } from '../lib/clipboard';
import { describePlaybackAccess } from '../lib/privacy-policy';

type InputPlaybackShareCardProps = {
  share: InputPlaybackShare | null;
  loading?: boolean;
  error?: string | null;
  onCopied?: (message: string) => void;
};

export const InputPlaybackShareCard: React.FC<InputPlaybackShareCardProps> = ({
  share,
  loading,
  error,
  onCopied,
}) => {
  const notify = async (text: string, message: string) => {
    const ok = await copyText(text);
    onCopied?.(ok ? message : 'Copy failed');
  };

  if (loading && !share) {
    return <p className="text-sm hf-muted">Loading playback links…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  if (!share) {
    return <p className="text-sm hf-muted">Playback links unavailable.</p>;
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-lg border border-slate-700/70 bg-slate-950/30 px-3 py-2">
        <p className="text-xs hf-muted">Access</p>
        <p className="text-slate-200">
          {describePlaybackAccess(share.playbackAccessPolicy)}
          {share.domainBlockName ? (
            <span className="text-slate-500"> · {share.domainBlockName}</span>
          ) : null}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs hf-muted">
          Iframe = easy CMS paste. Script = strictest domain control on your site.
        </p>
        <div className="rounded-lg border border-slate-700/70 bg-slate-950/30 p-3 space-y-2">
          <p className="text-xs font-medium text-slate-300">Iframe embed</p>
          <pre className="max-h-28 overflow-auto rounded border border-slate-800/80 bg-slate-950/50 p-2 font-mono text-[11px] text-slate-300 whitespace-pre-wrap break-all">
            {share.iframeEmbedCode}
          </pre>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => notify(share.iframeEmbedCode, 'Iframe embed copied')}
          >
            Copy iframe code
          </Button>
        </div>
        <div className="rounded-lg border border-slate-700/70 bg-slate-950/30 p-3 space-y-2">
          <p className="text-xs font-medium text-slate-300">Script embed (hls.js)</p>
          <pre className="max-h-28 overflow-auto rounded border border-slate-800/80 bg-slate-950/50 p-2 font-mono text-[11px] text-slate-300 whitespace-pre-wrap break-all">
            {share.scriptEmbedCode}
          </pre>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => notify(share.scriptEmbedCode, 'Script embed copied')}
          >
            Copy script embed
          </Button>
        </div>
      </div>

      <div>
        <p className="hf-muted mb-1">HLS playback URL</p>
        <button
          type="button"
          className="hf-copyable-url w-full text-left font-mono text-xs break-all"
          onClick={() => notify(share.hlsUrl, 'HLS link copied')}
        >
          {share.hlsUrl}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => window.open(share.embedUrl, '_blank', 'noopener,noreferrer')}
        >
          Open embed preview
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => notify(share.hlsUrl, 'HLS link copied')}
        >
          Copy HLS link
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => notify(share.embedUrl, 'Embed page link copied')}
        >
          Copy embed link
        </Button>
      </div>

      {share.expiresAt && (
        <p className="text-xs hf-muted">
          Signed link expires at {new Date(share.expiresAt).toLocaleString()}.
        </p>
      )}
      {share.playbackAccessPolicy !== 'public' && (
        <p className="text-xs hf-muted">
          Links update when you change the privacy preset on this stream key. Use iframe or script
          embed for partner sites.
        </p>
      )}
    </div>
  );
};
