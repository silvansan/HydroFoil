import React from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@hydrofoil/ui-kit';

import { api } from '../api/client';
import type { StorageLocation } from '../api/types';
import { Alert } from '../components/Alert';
import { ResourceSettingsLayout } from '../components/ResourceSettingsLayout';

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const StorageLocationSettingsPage: React.FC = () => {
  const { locationId } = useParams<{ locationId: string }>();
  const [location, setLocation] = React.useState<StorageLocation | null>(null);
  const [objects, setObjects] = React.useState<
    Array<{ key: string; size: number; lastModified: string }>
  >([]);
  const [browsePrefix, setBrowsePrefix] = React.useState('');
  const [resolvedPrefix, setResolvedPrefix] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isLoadingObjects, setIsLoadingObjects] = React.useState(false);

  const loadObjects = React.useCallback(async () => {
    if (!locationId) return;
    setIsLoadingObjects(true);
    setError(null);
    try {
      const res = await api.listStorageObjects(locationId, browsePrefix.trim() || undefined);
      setObjects(res.items);
      setResolvedPrefix(res.prefix);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list objects');
    } finally {
      setIsLoadingObjects(false);
    }
  }, [locationId, browsePrefix]);

  React.useEffect(() => {
    if (!locationId) return;
    api
      .getStorageLocation(locationId)
      .then(setLocation)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [locationId]);

  React.useEffect(() => {
    if (locationId && location) {
      loadObjects().catch(() => undefined);
    }
  }, [locationId, location, loadObjects]);

  return (
    <ResourceSettingsLayout
      backTo="/storage"
      backLabel="All storage locations"
      title={String(location?.name ?? 'Storage location')}
      description="MinIO / S3 bucket configuration and object browse"
    >
      {error && <Alert>{error}</Alert>}
      {location && (
        <div className="space-y-6">
          <Card className="p-6 max-w-xl">
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="hf-muted">Type</dt>
                <dd className="text-slate-200">{String(location.type ?? '—')}</dd>
              </div>
              <div>
                <dt className="hf-muted">Bucket</dt>
                <dd className="font-mono text-slate-200">{String(location.bucketName ?? '—')}</dd>
              </div>
              <div>
                <dt className="hf-muted">Endpoint</dt>
                <dd className="font-mono text-slate-200">{String(location.endpoint ?? 'env default')}</dd>
              </div>
              <div>
                <dt className="hf-muted">Region</dt>
                <dd className="font-mono text-slate-200">{String(location.region ?? '—')}</dd>
              </div>
              <div>
                <dt className="hf-muted">Credentials</dt>
                <dd className="text-slate-200">{location.hasCredentials ? 'Configured' : 'Uses env default'}</dd>
              </div>
              <div>
                <dt className="hf-muted">Prefix</dt>
                <dd className="font-mono text-slate-200">{String(location.prefixPath ?? '—')}</dd>
              </div>
              <div>
                <dt className="hf-muted">Default</dt>
                <dd className="text-slate-200">{location.isDefault ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
          </Card>

          <Card className="overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700/50 flex flex-wrap items-end gap-3 justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Object browse</h2>
                <p className="text-xs hf-muted mt-1 font-mono">
                  s3://{String(location.bucketName)}/{resolvedPrefix || '…'}
                </p>
              </div>
              <div className="flex gap-2 items-end">
                <label className="text-sm">
                  <span className="hf-muted block text-xs mb-1">Sub-prefix</span>
                  <input
                    className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 font-mono"
                    placeholder="optional/path"
                    value={browsePrefix}
                    onChange={(e) => setBrowsePrefix(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-500"
                  onClick={() => loadObjects()}
                >
                  Refresh
                </button>
              </div>
            </div>
            {isLoadingObjects ? (
              <div className="px-6 py-10 text-center hf-muted text-sm">Loading objects…</div>
            ) : objects.length === 0 ? (
              <div className="px-6 py-10 text-center hf-muted text-sm">No objects under this prefix.</div>
            ) : (
              <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 bg-slate-900/95">
                    <tr className="border-b border-slate-700/50">
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Key</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Size</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Modified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {objects.map((obj) => (
                      <tr key={obj.key} className="border-b border-slate-800/50">
                        <td className="px-4 py-2 text-xs font-mono text-slate-300 break-all">{obj.key}</td>
                        <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">
                          {formatBytes(obj.size)}
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">
                          {new Date(obj.lastModified).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </ResourceSettingsLayout>
  );
};

export default StorageLocationSettingsPage;
