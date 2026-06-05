import React from 'react';
import { Button } from '@hydrofoil/ui-kit';

import type { InputPlaybackShare } from '../api/types';
import { copyText } from '../lib/clipboard';
import { describePlaybackAccess } from '../lib/privacy-policy';
import { buildLiveIframeEmbedCode } from '../lib/playback';

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

  const iframeEmbed = buildLiveIframeEmbedCode(share.stream, share.app, share.token);

  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-lg border border-slate-700/70 bg-slate-950/30 px-3 py-2">
        <p className="text-xs hf-muted">Access</p>
        <p className="text-slate-200">
          {describePlaybackAccess(share.playbackAccessPolicy)}
          {share.domainBlockName ? (
            <span className="text-slate-500"> · {share.domainBlockName}</span>
          ) : null}
        </p>
      </div>
      <div>
        <p className="hf-muted mb-1">HLS playback URL</p>
        <button
          type="button"
          className="w-full rounded-lg border border-slate-700/70 bg-slate-950/30 px-3 py-2 text-left font-mono text-xs text-slate-200 break-all"
          onClick={() => window.open(share.embedUrl, '_blank', 'noopener,noreferrer')}
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
          onClick={() => notify(share.shareUrl, 'HLS link copied')}
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
        <Button
          variant="secondary"
          size="sm"
          onClick={() => notify(iframeEmbed, 'Iframe embed code copied')}
        >
          Copy iframe code
        </Button>
      </div>
      {share.expiresAt && (
        <p className="text-xs hf-muted">
          Signed link expires at {new Date(share.expiresAt).toLocaleString()}.
        </p>
      )}
      {share.playbackAccessPolicy !== 'public' && (
        <p className="text-xs hf-muted">
          Links update when you change the privacy policy on this stream key. Use iframe or HLS URL
          from here for website embeds.
        </p>
      )}
    </div>
  );
};
