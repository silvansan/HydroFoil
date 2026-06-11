import React from 'react';
import { Button } from '@hydrofoil/ui-kit';
import { ChevronDown, RefreshCw } from 'lucide-react';

import type { InputPlaybackShare } from '../api/types';
import type { PlaybackShareOptions } from '../hooks/useInputPlaybackShare';
import { copyText } from '../lib/clipboard';
import {
  dateTimeLocalFromIso,
  defaultExpiryDateTimeLocal,
  expiryDateTimeLocalAfterHours,
  expiryIsoFromDateTimeLocal,
  formatFriendlyExpiry,
  validateExpiryDateTimeLocal,
} from '../lib/playback-expiry';
import { describePlaybackAccess } from '../lib/privacy-policy';

type InputPlaybackShareCardProps = {
  share: InputPlaybackShare | null;
  loading?: boolean;
  error?: string | null;
  onCopied?: (message: string) => void;
  onRegenerate?: (options: PlaybackShareOptions) => void | Promise<unknown>;
};

const EXPIRY_PRESETS = [
  { label: '+1h', hours: 1 },
  { label: '+8h', hours: 8 },
  { label: '+24h', hours: 24 },
  { label: '+7d', hours: 24 * 7 },
] as const;

export const InputPlaybackShareCard: React.FC<InputPlaybackShareCardProps> = ({
  share,
  loading,
  error,
  onCopied,
  onRegenerate,
}) => {
  const [expiryLocal, setExpiryLocal] = React.useState(defaultExpiryDateTimeLocal());
  const [expiryError, setExpiryError] = React.useState<string | null>(null);
  const [generating, setGenerating] = React.useState(false);
  const [scriptEmbedOpen, setScriptEmbedOpen] = React.useState(false);

  React.useEffect(() => {
    if (share?.expiresAt) {
      setExpiryLocal(dateTimeLocalFromIso(share.expiresAt));
    }
  }, [share?.expiresAt]);

  const notify = async (text: string, message: string) => {
    const ok = await copyText(text);
    onCopied?.(ok ? message : 'Copy failed');
  };

  const handleGenerate = async () => {
    const validation = validateExpiryDateTimeLocal(expiryLocal);
    if (validation) {
      setExpiryError(validation);
      return;
    }
    const expiresAt = expiryIsoFromDateTimeLocal(expiryLocal);
    if (!expiresAt || !onRegenerate) return;
    setExpiryError(null);
    setGenerating(true);
    try {
      await Promise.resolve(onRegenerate({ expiresAt }));
      onCopied?.('Signed link regenerated; previous links no longer work');
    } finally {
      setGenerating(false);
    }
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

  const signed = Boolean(share.token && share.expiresAt);
  const friendlyExpiry = share.expiresAt ? formatFriendlyExpiry(share.expiresAt) : null;

  return (
    <div className="space-y-4 text-sm">
      <div className="hf-embed-panel px-3 py-2">
        <p className="text-xs hf-muted">Access</p>
        <p className="text-slate-200">
          {describePlaybackAccess(share.playbackAccessPolicy)}
          {share.domainBlockName ? (
            <span className="text-slate-500"> · {share.domainBlockName}</span>
          ) : null}
        </p>
      </div>

      {signed && onRegenerate && (
        <div className="hf-embed-panel space-y-3 p-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Signed link expiry</h3>
            <p className="text-xs hf-muted">
              Choose when script and HLS links should stop working, then generate a fresh signed
              bundle for partners.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {EXPIRY_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="rounded-lg border border-[color-mix(in_srgb,var(--hf-border)_80%,transparent)] px-2.5 py-1 text-xs text-slate-300 transition-colors hover:border-[var(--hf-brand-500)] hover:text-[var(--hf-brand-500)]"
                onClick={() => {
                  setExpiryLocal(expiryDateTimeLocalAfterHours(preset.hours));
                  setExpiryError(null);
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400" htmlFor="playback-expiry">
              Expires on
            </label>
            <input
              id="playback-expiry"
              type="datetime-local"
              className="hf-input mt-1 max-w-xs"
              value={expiryLocal}
              onChange={(e) => {
                setExpiryLocal(e.target.value);
                setExpiryError(null);
              }}
            />
            {expiryError ? <p className="mt-1 text-xs text-red-400">{expiryError}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={handleGenerate}
              disabled={generating || loading}
            >
              <span className="inline-flex items-center gap-2">
                <RefreshCw size={14} className={generating || loading ? 'animate-spin' : ''} />
                {generating || loading ? 'Generating…' : 'Generate new signed link'}
              </span>
            </Button>
            {friendlyExpiry ? (
              <p className="text-xs text-[var(--hf-brand-500)]">
                Expires <span className="font-medium">{friendlyExpiry}</span>
              </p>
            ) : null}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="hf-embed-panel space-y-2 p-3">
          <p className="text-xs font-medium text-slate-300">Iframe embed (recommended)</p>
          <p className="text-xs hf-muted">
            Paste into WordPress, CodePen, or any site. Width fills its container (up to 960px) and
            height adjusts to the player. FLV fallback and HLS quality options when ABR is active.
          </p>
          <pre className="hf-code-snippet max-h-40 overflow-auto whitespace-pre-wrap break-all">
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
        <div className="hf-embed-panel overflow-hidden">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800/40"
            onClick={() => setScriptEmbedOpen((open) => !open)}
            aria-expanded={scriptEmbedOpen}
          >
            <span>Advanced: script embed (HLS-only)</span>
            <ChevronDown
              size={16}
              className={`shrink-0 text-slate-500 transition-transform ${scriptEmbedOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {scriptEmbedOpen ? (
            <div className="space-y-2 border-t border-slate-800/60 p-3">
              <p className="text-xs hf-muted">
                For sites that block iframes. HLS only — slower than the iframe player and no FLV
                fallback.
              </p>
              <pre className="hf-code-snippet max-h-28 overflow-auto whitespace-pre-wrap break-all">
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
          ) : null}
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

      {signed && friendlyExpiry && (
        <p className="text-xs hf-muted">
          Current signed links expire <span className="text-slate-300">{friendlyExpiry}</span>. Iframe
          embeds on HydroFoil&apos;s /embed page refresh automatically; script and raw HLS links use
          the expiry you set above.
        </p>
      )}
      {share.playbackAccessPolicy !== 'public' && (
        <p className="text-xs hf-muted">
          Links update when you change the privacy preset or generate a new signed link.
        </p>
      )}
    </div>
  );
};
