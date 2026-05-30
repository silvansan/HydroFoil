import React from 'react';
import { X, Link2, Code2 } from 'lucide-react';
import { Button, Card } from '@hydrofoil/ui-kit';
import { HydroFoilPlayer } from '@hydrofoil/player';

import { api } from '../api/client';
import type { RecordingPlaybackAudioAsset } from '../api/types';
import { FlvPlayer } from './FlvPlayer';
import { IconActionButton } from './IconActionButton';
import { copyText } from '../lib/clipboard';
import { absoluteApiUrl, buildFlvEmbedCode, buildHlsEmbedCode } from '../lib/playback';

export interface RecordingPreviewTarget {
  id: string;
  label: string;
}

interface RecordingPreviewModalProps {
  target: RecordingPreviewTarget;
  onClose: () => void;
}

type SelectedSource = 'video' | string;

export const RecordingPreviewModal: React.FC<RecordingPreviewModalProps> = ({
  target,
  onClose,
}) => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [shareUrl, setShareUrl] = React.useState<string | null>(null);
  const [audioAssets, setAudioAssets] = React.useState<RecordingPlaybackAudioAsset[]>([]);
  const [format, setFormat] = React.useState<'hls' | 'flv'>('flv');
  const [selectedSource, setSelectedSource] = React.useState<SelectedSource>('video');
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .getRecordingPlaybackUrl(target.id)
      .then((payload) => {
        if (cancelled) return;

        const fmt = payload.format === 'hls' ? 'hls' : 'flv';
        setFormat(fmt);
        setPreviewUrl(absoluteApiUrl(payload.previewUrl));
        setShareUrl(payload.shareUrl);
        setAudioAssets(
          (payload.audioAssets ?? []).map((asset) => ({
            ...asset,
            previewUrl: absoluteApiUrl(asset.previewUrl),
          }))
        );
        setSelectedSource('video');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load playback URL');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [target.id]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2000);
  };

  const copy = async (text: string, success: string) => {
    const ok = await copyText(text);
    notify(ok ? success : 'Copy failed');
  };

  const activeAudioAsset =
    selectedSource === 'video'
      ? null
      : audioAssets.find((asset) => asset.id === selectedSource) ?? null;
  const selectedMediaUrl = activeAudioAsset?.previewUrl ?? previewUrl;
  const embedCode =
    format === 'hls' && previewUrl
      ? buildHlsEmbedCode(previewUrl)
      : shareUrl
        ? buildFlvEmbedCode(shareUrl)
        : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <Card
        className="relative w-full max-w-3xl border border-slate-600/80 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-700/60 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Recording preview</h2>
            <p className="mt-1 break-all font-mono text-xs text-slate-400">{target.label}</p>
            {!loading && !error && (
              <p className="mt-1 text-xs hf-muted">
                {activeAudioAsset
                  ? `Generated audio (${String(activeAudioAsset.codec).toUpperCase()})`
                  : format === 'hls'
                    ? 'HLS VOD (transcoded)'
                    : 'HTTP-FLV source'}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {shareUrl && (
              <>
                <IconActionButton
                  label="Copy signed FLV link"
                  icon={Link2}
                  onClick={() => copy(shareUrl, 'Signed playback link copied')}
                />
                {embedCode && (
                  <IconActionButton
                    label="Copy embed code"
                    icon={Code2}
                    onClick={() => copy(embedCode, 'Embed code copied')}
                  />
                )}
              </>
            )}
            {selectedMediaUrl && (
              <IconActionButton
                label="Copy active media link"
                icon={Link2}
                onClick={() => copy(selectedMediaUrl, 'Media link copied')}
              />
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-5">
          {loading && <p className="text-sm hf-muted">Loading playback URL…</p>}
          {error && (
            <p className="rounded-lg bg-red-950/50 px-4 py-3 text-sm text-red-200">{error}</p>
          )}

          {!loading && !error && (previewUrl || audioAssets.length > 0) && (
            <div className="mb-4 flex flex-wrap gap-2">
              {previewUrl && (
                <button
                  type="button"
                  onClick={() => setSelectedSource('video')}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    selectedSource === 'video'
                      ? 'border-brand-400 bg-brand-500/15 text-brand-200'
                      : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  Video
                </button>
              )}
              {audioAssets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => setSelectedSource(asset.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    selectedSource === asset.id
                      ? 'border-brand-400 bg-brand-500/15 text-brand-200'
                      : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  Audio {String(asset.codec).toUpperCase()}
                </button>
              ))}
            </div>
          )}

          {!loading && !error && activeAudioAsset && (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-700/60 bg-slate-950/50 p-4">
                <audio
                  controls
                  autoPlay
                  preload="metadata"
                  src={activeAudioAsset.previewUrl}
                  className="w-full"
                />
              </div>
              <p className="text-xs hf-muted">
                Generated audio track: {String(activeAudioAsset.codec).toUpperCase()}
              </p>
            </div>
          )}

          {!loading && !error && selectedSource === 'video' && previewUrl && format === 'hls' && (
            <HydroFoilPlayer
              src={previewUrl}
              title={target.label}
              isLive={false}
              playbackMode="vod-hls"
              autoPlay
              muted={false}
            />
          )}

          {!loading && !error && selectedSource === 'video' && previewUrl && format === 'flv' && (
            <FlvPlayer src={previewUrl} isLive={false} autoPlay />
          )}

          {shareUrl && selectedSource === 'video' && (
            <p className="mt-3 break-all text-xs hf-muted">
              Signed FLV URL (7 days):{' '}
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="text-brand-400 hover:underline"
              >
                open in new tab
              </a>
            </p>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-700/60 px-5 py-3">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        {toast && (
          <div className="absolute bottom-16 left-1/2 z-10 -translate-x-1/2 rounded-full bg-brand-600 px-4 py-2 text-sm text-white shadow-lg">
            {toast}
          </div>
        )}
      </Card>
    </div>
  );
};
