import React from 'react';
import { PageHeader, Card, Button, Modal, TextInput } from '@hydrofoil/ui-kit';

import { api } from '../api/client';
import type { DomainBlock, StorageLocation, VodRoute } from '../api/types';
import { Alert } from '../components/Alert';
import { ClickableRow } from '../components/ClickableRow';
import { FormError } from '../components/FormError';
import { useResourceList } from '../hooks/useResourceList';

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

const initialForm: VodRouteForm = {
  name: '',
  enabled: true,
  requestDomain: '',
  publicPath: '/vod',
  deliveryType: 'progressive',
  sourceType: 'storage-location',
  storageLocationId: '',
  sourcePath: '',
  domainBlockId: '',
  allowDirectAccess: false,
  generateIframePlaylist: false,
};

const VodRoutesPage: React.FC = () => {
  const { items, isLoading, error, reload } = useResourceList<VodRoute>(() => api.listVodRoutes());
  const [domainBlocks, setDomainBlocks] = React.useState<DomainBlock[]>([]);
  const [storageLocations, setStorageLocations] = React.useState<StorageLocation[]>([]);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<VodRouteForm>(initialForm);

  React.useEffect(() => {
    Promise.all([api.listDomainBlocks(), api.listStorageLocations()]).then(
      ([domainBlockRes, storageRes]) => {
        setDomainBlocks(domainBlockRes.items);
        setStorageLocations(storageRes.items);
      }
    );
  }, []);

  const domainBlockById = React.useMemo(
    () => new Map(domainBlocks.map((block) => [block.id, block])),
    [domainBlocks]
  );

  const handleCreate = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await api.createVodRoute({
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
      setIsModalOpen(false);
      setForm(initialForm);
      await reload();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create VOD route');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canCreate =
    form.name.trim().length > 0 &&
    form.publicPath.trim().length > 0 &&
    form.sourcePath.trim().length > 0 &&
    (form.sourceType !== 'storage-location' || form.storageLocationId.length > 0);

  const exampleFilename =
    form.deliveryType === 'progressive' ? '2026-05-31R.mp4' : 'index.m3u8';
  const exampleRequestPath = joinRouteExample(form.publicPath, exampleFilename);

  return (
    <div>
      <PageHeader
        title="VOD Routes"
        description="Publish browser-facing archive mounts for MP4, MP3, HLS, and other stored assets"
        action={
          <Button variant="primary" onClick={() => setIsModalOpen(true)}>
            + New VOD Route
          </Button>
        }
      />

      {error && <Alert>{error}</Alert>}

      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold text-slate-100">Published VOD routes</h2>
        </div>
        {isLoading ? (
          <div className="px-6 py-12 text-center hf-muted">Loading VOD routes...</div>
        ) : items.length === 0 ? (
          <div className="px-6 py-12 text-center hf-muted">
            No VOD routes yet. Create one to publish archive files from storage or a remote HTTP origin.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/40">
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Request path</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Source</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Delivery</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Privacy policy</th>
                </tr>
              </thead>
              <tbody>
                {items.map((route) => (
                  <ClickableRow key={route.id} to={`/vod-routes/${route.id}`}>
                    <td className="px-4 py-3 text-sm text-slate-200">{route.name}</td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-400">
                      {(route.requestDomain ? `${route.requestDomain} ` : '') + route.publicPath}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {route.sourceType === 'storage-location'
                        ? `Storage: ${route.sourcePath}`
                        : route.sourcePath}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">{route.deliveryType}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {route.domainBlockId
                        ? domainBlockById.get(route.domainBlockId)?.name ?? 'Assigned'
                        : 'None'}
                    </td>
                  </ClickableRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New VOD Route">
        <div className="space-y-4">
          <TextInput
            label="Name"
            value={form.name}
            onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput
              label="Incoming domain (optional)"
              placeholder="vod.example.com"
              value={form.requestDomain}
              onChange={(e) => setForm((current) => ({ ...current, requestDomain: e.target.value }))}
            />
            <TextInput
              label="Public path"
              placeholder="/vod/movies/demo"
              value={form.publicPath}
              onChange={(e) => setForm((current) => ({ ...current, publicPath: e.target.value }))}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-300">Delivery type</label>
              <select
                className="hf-select mt-1"
                value={form.deliveryType}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    deliveryType: e.target.value as VodRoute['deliveryType'],
                  }))
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
                  setForm((current) => ({
                    ...current,
                    sourceType: e.target.value as VodRoute['sourceType'],
                    storageLocationId: '',
                    sourcePath: '',
                  }))
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
                    setForm((current) => ({ ...current, storageLocationId: e.target.value }))
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
              <TextInput
                label={form.deliveryType === 'hls' ? 'Manifest path' : 'File path or prefix'}
                placeholder={
                  form.deliveryType === 'hls'
                    ? 'vod/demo/index.m3u8'
                    : 'archive/ or archive/2026-05-31R.mp4'
                }
                value={form.sourcePath}
                onChange={(e) => setForm((current) => ({ ...current, sourcePath: e.target.value }))}
              />
            </>
          ) : (
            <TextInput
              label={form.deliveryType === 'hls' ? 'Remote manifest URL' : 'Remote file URL or prefix URL'}
              placeholder={
                form.deliveryType === 'hls'
                  ? 'https://cdn.example.com/vod/demo/index.m3u8'
                  : 'https://cdn.example.com/archive/ or https://cdn.example.com/archive/movie.mp4'
              }
              value={form.sourcePath}
              onChange={(e) => setForm((current) => ({ ...current, sourcePath: e.target.value }))}
            />
          )}
          {form.deliveryType === 'progressive' && (
            <Card className="border border-slate-700/70 bg-slate-950/30 p-4">
              <h3 className="text-sm font-semibold text-slate-100">Prefix Route Example</h3>
              <p className="mt-1 text-xs hf-muted">
                Use a folder-like source path to publish many archive files through one route.
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
                      : `${form.sourcePath.trim() || 'https://archive.example.com/' }${form.sourcePath.trim().endsWith('/') || !form.sourcePath.trim() ? '' : '/'}${exampleFilename}`}
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
              onChange={(e) => setForm((current) => ({ ...current, domainBlockId: e.target.value }))}
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
                setForm((current) => ({ ...current, allowDirectAccess: e.target.checked }))
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
                setForm((current) => ({ ...current, generateIframePlaylist: e.target.checked }))
              }
              className="rounded border-slate-600 text-brand-500"
            />
            Generate iframe-friendly playlist behavior
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm((current) => ({ ...current, enabled: e.target.checked }))}
              className="rounded border-slate-600 text-brand-500"
            />
            Route enabled
          </label>
          <FormError message={submitError} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreate} disabled={!canCreate || isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create VOD route'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default VodRoutesPage;
