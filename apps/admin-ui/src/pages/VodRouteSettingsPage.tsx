import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, TextInput } from '@hydrofoil/ui-kit';

import { api } from '../api/client';
import type { DomainBlock, StorageLocation, VodRoute, VodRoutePlaybackInfo } from '../api/types';
import { Alert } from '../components/Alert';
import { DeleteButton } from '../components/DeleteButton';
import { FormError } from '../components/FormError';
import { ResourceSettingsLayout } from '../components/ResourceSettingsLayout';
import { StorageSourcePicker } from '../components/StorageSourcePicker';
import { errorMessage } from '../lib/api-error';

type VodRouteForm = {
  name: string;
  enabled: boolean;
  requestDomain: string;
  publicPath: string;
  deliveryType: VodRoute['deliveryType'];
  sourceType: VodRoute['sourceType'];
  storageLocationId: string;
  sourcePath: string;
  domainBlockId: string;
  allowDirectAccess: boolean;
  generateIframePlaylist: boolean;
};

function normalizeMountPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '/vod';
  return `/${trimmed}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/vod';
}

function joinRouteExample(basePath: string, filename: string): string {
  const mount = normalizeMountPath(basePath);
  return `${mount}/${filename.replace(/^\/+/, '')}`;
}

const VodRouteSettingsPage: React.FC = () => {
  const { vodRouteId } = useParams<{ vodRouteId: string }>();
  const navigate = useNavigate();
  const [route, setRoute] = React.useState<VodRoute | null>(null);
  const [form, setForm] = React.useState<VodRouteForm | null>(null);
  const [storageLocations, setStorageLocations] = React.useState<StorageLocation[]>([]);
  const [domainBlocks, setDomainBlocks] = React.useState<DomainBlock[]>([]);
  const [playbackInfo, setPlaybackInfo] = React.useState<VodRoutePlaybackInfo | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!vodRouteId) return;
    setError(null);
    try {
      const [routeRes, storageRes, domainRes, playbackRes] = await Promise.all([
        api.getVodRoute(vodRouteId),
        api.listStorageLocations(),
        api.listDomainBlocks(),
        api.getVodRoutePlaybackInfo(vodRouteId),
      ]);
      setRoute(routeRes);
      setStorageLocations(storageRes.items);
      setDomainBlocks(domainRes.items);
      setPlaybackInfo(playbackRes);
      setForm({
        name: routeRes.name,
        enabled: routeRes.enabled,
        requestDomain: routeRes.requestDomain ?? '',
        publicPath: routeRes.publicPath,
        deliveryType: routeRes.deliveryType,
        sourceType: routeRes.sourceType,
        storageLocationId: routeRes.storageLocationId ?? '',
        sourcePath: routeRes.sourcePath,
        domainBlockId: routeRes.domainBlockId ?? '',
        allowDirectAccess: routeRes.allowDirectAccess,
        generateIframePlaylist: routeRes.generateIframePlaylist,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load VOD route');
    }
  }, [vodRouteId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const copyToClipboard = async (value: string, success: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(success);
    } catch {
      setSaveError('Failed to copy to clipboard');
    }
  };

  const handleSave = async () => {
    if (!vodRouteId || !form) return;
    setIsSaving(true);
    setSaveError(null);
    setNotice(null);
    try {
      const updated = await api.updateVodRoute(vodRouteId, {
        name: form.name.trim(),
        enabled: form.enabled,
        requestDomain: form.requestDomain.trim() || undefined,
        publicPath: form.publicPath.trim(),
        deliveryType: form.deliveryType,
        sourceType: form.sourceType,
        storageLocationId:
          form.sourceType === 'storage-location' ? form.storageLocationId || undefined : undefined,
        sourcePath: form.sourcePath.trim(),
        domainBlockId: form.domainBlockId || undefined,
        allowDirectAccess: form.allowDirectAccess,
        generateIframePlaylist: form.generateIframePlaylist,
      });
      setRoute(updated);
      setNotice('VOD route saved');
      const playback = await api.getVodRoutePlaybackInfo(vodRouteId);
      setPlaybackInfo(playback);
    } catch (err) {
      setSaveError(errorMessage(err, 'Failed to save VOD route'));
    } finally {
      setIsSaving(false);
    }
  };

  const canSave = React.useMemo(() => {
    if (!form) {
      return false;
    }
    return (
      form.name.trim().length > 0 &&
      form.publicPath.trim().length > 0 &&
      form.sourcePath.trim().length > 0 &&
      (form.sourceType !== 'storage-location' || form.storageLocationId.length > 0)
    );
  }, [form]);

  const exampleFilename =
    form?.deliveryType === 'progressive' ? '2026-05-31R.mp4' : 'index.m3u8';
  const exampleRequestPath = form
    ? joinRouteExample(form.publicPath, exampleFilename)
    : '/vod/2026-05-31R.mp4';

  return (
    <ResourceSettingsLayout
      backTo="/vod-routes"
      backLabel="All VOD routes"
      title={route?.name ?? 'VOD route'}
      description={
        route ? (
          <span className="font-mono text-sm">
            {(route.requestDomain ? `${route.requestDomain} ` : '') + route.publicPath}
          </span>
        ) : undefined
      }
      action={
        vodRouteId ? (
          <DeleteButton
            label="Delete VOD route"
            confirmTitle={`Delete "${route?.name ?? 'this VOD route'}"?`}
            confirmMessage="This removes the published VOD route but leaves the underlying media source untouched."
            onDelete={async () => {
              await api.deleteVodRoute(vodRouteId);
              navigate('/vod-routes');
            }}
            size="md"
          />
        ) : undefined
      }
    >
      {error && <Alert>{error}</Alert>}
      {saveError && <Alert>{saveError}</Alert>}
      {notice && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {notice}
        </div>
      )}
      {form && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
          <Card className="p-6 space-y-4">
            <TextInput
              label="Name"
              value={form.name}
              onChange={(e) => setForm((current) => (current ? { ...current, name: e.target.value } : current))}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                label="Incoming domain (optional)"
                value={form.requestDomain}
                onChange={(e) => setForm((current) => (current ? { ...current, requestDomain: e.target.value } : current))}
              />
              <TextInput
                label="Public path"
                value={form.publicPath}
                onChange={(e) => setForm((current) => (current ? { ...current, publicPath: e.target.value } : current))}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-300">Delivery type</label>
                <select
                  className="hf-select mt-1"
                  value={form.deliveryType}
                  onChange={(e) =>
                    setForm((current) =>
                      current
                        ? { ...current, deliveryType: e.target.value as VodRoute['deliveryType'] }
                        : current
                    )
                  }
                >
                  <option value="progressive">Progressive media</option>
                  <option value="hls">HLS VOD</option>
                </select>
                <p className="mt-1 text-xs hf-muted">
                  Progressive is the usual archive mode for direct `mp4`, `mp3`, and similar files.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300">Media source</label>
                <select
                  className="hf-select mt-1"
                  value={form.sourceType}
                  onChange={(e) =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            sourceType: e.target.value as VodRoute['sourceType'],
                            storageLocationId: '',
                            sourcePath: '',
                          }
                        : current
                    )
                  }
                >
                  <option value="storage-location">Storage location</option>
                  <option value="remote-http">Remote HTTP origin</option>
                </select>
              </div>
            </div>
            {form.sourceType === 'storage-location' ? (
              <>
                <div>
                  <label className="text-sm font-medium text-slate-300">Storage location</label>
                  <select
                    className="hf-select mt-1"
                    value={form.storageLocationId}
                    onChange={(e) =>
                      setForm((current) => (current ? { ...current, storageLocationId: e.target.value } : current))
                    }
                  >
                    <option value="">Select storage location</option>
                    {storageLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name} ({location.type})
                      </option>
                    ))}
                  </select>
                </div>
                <StorageSourcePicker
                  storageLocationId={form.storageLocationId}
                  value={form.sourcePath}
                  deliveryType={form.deliveryType}
                  onChange={(sourcePath) =>
                    setForm((current) => (current ? { ...current, sourcePath } : current))
                  }
                />
              </>
            ) : (
              <TextInput
                label={form.deliveryType === 'hls' ? 'Remote manifest URL' : 'Remote file URL or prefix URL'}
                value={form.sourcePath}
                onChange={(e) => setForm((current) => (current ? { ...current, sourcePath: e.target.value } : current))}
              />
            )}
            {form.deliveryType === 'progressive' && (
              <Card className="border border-slate-700/70 bg-slate-950/30 p-4">
                <h3 className="text-sm font-semibold text-slate-100">Prefix Route Example</h3>
                <p className="mt-1 text-xs hf-muted">
                  Your webpage can generate archive playback URLs by appending the filename to this route.
                </p>
                <dl className="mt-3 grid gap-3 text-xs">
                  <div>
                    <dt className="hf-muted">Public request</dt>
                    <dd className="font-mono text-slate-200">{exampleRequestPath}</dd>
                  </div>
                  <div>
                    <dt className="hf-muted">Source lookup</dt>
                    <dd className="font-mono text-slate-200">
                      {form.sourceType === 'storage-location'
                        ? `${form.sourcePath.trim() || 'archive/'}${form.sourcePath.trim().endsWith('/') || !form.sourcePath.trim() ? '' : '/'}${exampleFilename}`
                        : `${form.sourcePath.trim() || 'https://archive.example.com/'}${form.sourcePath.trim().endsWith('/') || !form.sourcePath.trim() ? '' : '/'}${exampleFilename}`}
                    </dd>
                  </div>
                </dl>
              </Card>
            )}
            <div>
              <label className="text-sm font-medium text-slate-300">Privacy policy</label>
              <select
                className="hf-select mt-1"
                value={form.domainBlockId}
                onChange={(e) =>
                  setForm((current) => (current ? { ...current, domainBlockId: e.target.value } : current))
                }
              >
                <option value="">No privacy policy</option>
                {domainBlocks.map((block) => (
                  <option key={block.id} value={block.id}>
                    {block.name}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.allowDirectAccess}
                onChange={(e) =>
                  setForm((current) => (current ? { ...current, allowDirectAccess: e.target.checked } : current))
                }
                className="rounded border-slate-600 text-brand-500"
              />
              Allow direct browser opening of the media URL
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.generateIframePlaylist}
                onChange={(e) =>
                  setForm((current) => (current ? { ...current, generateIframePlaylist: e.target.checked } : current))
                }
                className="rounded border-slate-600 text-brand-500"
              />
              Generate iframe-friendly playlist behavior
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) =>
                  setForm((current) => (current ? { ...current, enabled: e.target.checked } : current))
                }
                className="rounded border-slate-600 text-brand-500"
              />
              Route enabled
            </label>
            <FormError message={saveError} />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => load()} disabled={isSaving}>
                Reset
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={!canSave || isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Playback</h2>
              <p className="mt-1 text-sm hf-muted">
                Preview and sharing links generated from this VOD route. Prefix-style progressive routes are meant to be combined with archive filenames on your webpage.
              </p>
            </div>
            {playbackInfo ? (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="hf-muted mb-1">Preview URL</p>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-slate-700/70 bg-slate-950/30 px-3 py-2 text-left font-mono text-xs text-slate-200"
                    onClick={() => window.open(playbackInfo.embedUrl, '_blank', 'noopener,noreferrer')}
                  >
                    {playbackInfo.previewUrl}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => window.open(playbackInfo.embedUrl, '_blank', 'noopener,noreferrer')}
                  >
                    Open preview
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => copyToClipboard(playbackInfo.shareUrl, 'Share link copied')}
                  >
                    Copy share link
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => copyToClipboard(playbackInfo.embedUrl, 'Embed link copied')}
                  >
                    Copy embed link
                  </Button>
                </div>
                {playbackInfo.expiresAt && (
                  <p className="text-xs hf-muted">
                    Protected link expires at {new Date(playbackInfo.expiresAt).toLocaleString()}.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm hf-muted">Loading playback information...</p>
            )}
          </Card>
        </div>
      )}
    </ResourceSettingsLayout>
  );
};

export default VodRouteSettingsPage;
