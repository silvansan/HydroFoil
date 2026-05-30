import React from 'react';
import { PageHeader, Card, Button, Modal, TextInput } from '@hydrofoil/ui-kit';

import { api } from '../api/client';
import { Alert } from '../components/Alert';
import { ClickableRow } from '../components/ClickableRow';
import { useResourceList } from '../hooks/useResourceList';

type StorageRow = {
  id: string;
  name: string;
  type: string;
  bucketName: string;
  prefixPath: string;
  isDefault: boolean;
  endpoint?: string;
  region?: string;
  useSsl?: boolean;
  publicEndpoint?: string;
  pathStyle?: boolean;
  hasCredentials?: boolean;
};

type StorageForm = {
  name: string;
  type: 'minio' | 's3';
  bucketName: string;
  prefixPath: string;
  endpoint: string;
  region: string;
  useSsl: boolean;
  publicEndpoint: string;
  pathStyle: boolean;
  accessKey: string;
  secretKey: string;
};

const initialForm: StorageForm = {
  name: '',
  type: 'minio',
  bucketName: 'hydrofoil',
  prefixPath: 'media',
  endpoint: '',
  region: '',
  useSsl: true,
  publicEndpoint: '',
  pathStyle: true,
  accessKey: '',
  secretKey: '',
};

const StoragePage: React.FC = () => {
  const { items, isLoading, error, reload } = useResourceList<StorageRow>(() =>
    api.listStorageLocations()
  );
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [form, setForm] = React.useState<StorageForm>(initialForm);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const handleCreate = async () => {
    setSubmitError(null);
    try {
      const body = {
        ...form,
        endpoint: form.endpoint.trim() || undefined,
        region: form.region.trim() || undefined,
        publicEndpoint: form.publicEndpoint.trim() || undefined,
        accessKey: form.accessKey.trim() || undefined,
        secretKey: form.secretKey || undefined,
        isDefault: items.length === 0,
      };
      await api.createStorageLocation(body);
      setForm(initialForm);
      setIsModalOpen(false);
      await reload();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create storage location');
    }
  };

  return (
    <div>
      <PageHeader
        title="Storage"
        description="Local MinIO and remote S3-compatible buckets — click a row to browse"
        action={
          <Button variant="primary" onClick={() => setIsModalOpen(true)}>
            + New Location
          </Button>
        }
      />

      {error && <Alert>{error}</Alert>}

      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold text-slate-100">Storage locations</h2>
        </div>
        {isLoading ? (
          <div className="px-6 py-12 text-center hf-muted">Loading storage locations…</div>
        ) : items.length === 0 ? (
          <div className="px-6 py-12 text-center hf-muted">No storage locations configured.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/40">
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Endpoint</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Bucket</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Prefix</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Credentials</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <ClickableRow key={row.id} to={`/storage/${row.id}`}>
                    <td className="px-4 py-3 text-sm text-slate-200">{row.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{row.type}</td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-400">{row.endpoint ?? 'env default'}</td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-400">{row.bucketName}</td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-400">{row.prefixPath}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {row.hasCredentials ? 'Configured' : 'Uses env default'}
                    </td>
                  </ClickableRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Storage Location">
        <div className="space-y-4">
          <TextInput label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-300">Type</span>
            <select
              className="rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-2 text-slate-100"
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  type: e.target.value as StorageForm['type'],
                  useSsl: e.target.value === 's3',
                }))
              }
            >
              <option value="minio">Local / MinIO-compatible</option>
              <option value="s3">Remote S3-compatible</option>
            </select>
          </label>
          <TextInput label="Bucket" value={form.bucketName} onChange={(e) => setForm((f) => ({ ...f, bucketName: e.target.value }))} />
          <TextInput label="Prefix Path" value={form.prefixPath} onChange={(e) => setForm((f) => ({ ...f, prefixPath: e.target.value }))} />

          <div className="rounded-lg border border-slate-700/70 bg-slate-950/40 p-3 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Provider connection</h3>
              <p className="text-xs hf-muted mt-1">
                For AWS use an S3 regional endpoint. For Hetzner or other S3-compatible providers,
                use the provider endpoint and keep path-style enabled if required.
              </p>
            </div>
            <TextInput
              label="Endpoint"
              placeholder={form.type === 's3' ? 's3.eu-central-1.amazonaws.com or provider endpoint' : 'optional, env default'}
              value={form.endpoint}
              onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))}
            />
            <TextInput label="Region" placeholder="optional, e.g. eu-central-1" value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} />
            <TextInput label="Public Endpoint" placeholder="optional browser/signed URL host" value={form.publicEndpoint} onChange={(e) => setForm((f) => ({ ...f, publicEndpoint: e.target.value }))} />
            <div className="flex flex-wrap gap-4 text-sm text-slate-300">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.useSsl} onChange={(e) => setForm((f) => ({ ...f, useSsl: e.target.checked }))} />
                Use SSL
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.pathStyle} onChange={(e) => setForm((f) => ({ ...f, pathStyle: e.target.checked }))} />
                Path-style requests
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-3">
            <p className="text-xs text-amber-200">
              Credentials are write-only in the UI. Existing keys are never shown after saving.
            </p>
            <TextInput label="Access Key" value={form.accessKey} onChange={(e) => setForm((f) => ({ ...f, accessKey: e.target.value }))} />
            <TextInput label="Secret Key" type="password" value={form.secretKey} onChange={(e) => setForm((f) => ({ ...f, secretKey: e.target.value }))} />
          </div>
          {submitError && <p className="text-sm text-red-400">{submitError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default StoragePage;
