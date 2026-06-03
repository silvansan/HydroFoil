import React from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, Card, Button, Modal } from '@hydrofoil/ui-kit';
import { HardDrive, Plus, Search } from 'lucide-react';

import { api } from '../api/client';
import type { RecordingPolicy, StorageLocation } from '../api/types';
import { Alert } from '../components/Alert';
import { ClickableRow } from '../components/ClickableRow';
import { FormError } from '../components/FormError';
import { StorageLocationFormFields } from '../components/StorageLocationFormFields';
import { StorageTypeBadge } from '../components/StorageTypeBadge';
import { RecordingStorageLinkCard } from '../components/RecordingStorageLinkCard';
import { useResourceList } from '../hooks/useResourceList';
import { canManageApplications, useAuth } from '../auth/AuthContext';
import {
  defaultStorageLocationForm,
  storageLocationFormErrors,
  type StorageLocationFormValues,
} from '../lib/recording-storage';

const StoragePage: React.FC = () => {
  const { user } = useAuth();
  const { items, isLoading, error, reload } = useResourceList<StorageLocation>(() =>
    api.listStorageLocations()
  );
  const [policies, setPolicies] = React.useState<RecordingPolicy[]>([]);
  const [search, setSearch] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [form, setForm] = React.useState<StorageLocationFormValues>(defaultStorageLocationForm());
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showValidation, setShowValidation] = React.useState(false);

  React.useEffect(() => {
    api.listRecordingPolicies('manage').then((res) => setPolicies(res.items));
  }, [items.length]);

  const policiesByLocation = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const policy of policies) {
      map.set(policy.storageLocationId, (map.get(policy.storageLocationId) ?? 0) + 1);
    }
    return map;
  }, [policies]);

  const filteredItems = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((row) => {
      const haystack = [
        row.name,
        row.type,
        row.bucketName,
        row.prefixPath,
        row.endpoint ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, search]);

  const openCreate = () => {
    setForm(defaultStorageLocationForm());
    setSubmitError(null);
    setShowValidation(false);
    setIsModalOpen(true);
  };

  const handleCreate = async () => {
    setShowValidation(true);
    const validationErrors = storageLocationFormErrors(form);
    if (Object.keys(validationErrors).length > 0) {
      setSubmitError('Fix the highlighted fields before creating.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await api.createStorageLocation({
        name: form.name.trim(),
        type: form.type,
        bucketName: form.bucketName.trim(),
        prefixPath: form.prefixPath.trim(),
        endpoint: form.endpoint.trim() || undefined,
        region: form.region.trim() || undefined,
        publicEndpoint: form.publicEndpoint.trim() || undefined,
        accessKey: form.accessKey.trim() || undefined,
        secretKey: form.secretKey || undefined,
        useSsl: form.useSsl,
        pathStyle: form.pathStyle,
        isDefault: items.length === 0,
      });
      setIsModalOpen(false);
      setForm(defaultStorageLocationForm());
      await reload();
      const policyRes = await api.listRecordingPolicies('manage');
      setPolicies(policyRes.items);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create storage location');
    } finally {
      setIsSubmitting(false);
    }
  };

  const validationErrors = showValidation ? storageLocationFormErrors(form) : undefined;
  const canCreate =
    Object.keys(storageLocationFormErrors(form)).length === 0 && form.name.trim().length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Storage"
        description="Buckets for DVR recordings, VOD assets, and file browsing — connect recording policies to a location and folder."
        action={
          canManageApplications(user?.role) ? (
            <Button variant="primary" onClick={openCreate}>
              <Plus size={16} className="mr-1.5 inline" aria-hidden />
              New location
            </Button>
          ) : undefined
        }
      />

      {error && <Alert>{error}</Alert>}

      <RecordingStorageLinkCard
        variant="storage"
        storageCount={items.length}
        policyCount={policies.length}
      />

      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Storage locations</h2>
            <p className="mt-1 text-sm hf-muted">
              {items.length} location{items.length === 1 ? '' : 's'} — open one to browse files like
              web-FTP.
            </p>
          </div>
          {items.length > 0 && (
            <div className="relative w-full sm:max-w-xs">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                aria-hidden
              />
              <input
                type="search"
                className="hf-input pl-9"
                placeholder="Search locations…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search storage locations"
              />
            </div>
          )}
        </div>
        {isLoading ? (
          <div className="px-6 py-12 text-center hf-muted">Loading storage locations…</div>
        ) : items.length === 0 ? (
          <div className="px-6 py-14 text-center max-w-lg mx-auto">
            <HardDrive className="h-10 w-10 text-slate-500 mx-auto mb-3" aria-hidden />
            <p className="text-slate-200">No storage configured</p>
            <p className="mt-2 text-sm hf-muted leading-relaxed">
              Add MinIO for local/docker setups or S3 for cloud buckets. Recording policies pick a
              folder inside these locations for DVR output.
            </p>
            {canManageApplications(user?.role) && (
              <Button variant="primary" className="mt-6" onClick={openCreate}>
                Add storage location
              </Button>
            )}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="px-6 py-12 text-center hf-muted">No locations match &ldquo;{search}&rdquo;</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/40">
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Location</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Bucket / prefix</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Recording policies</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Endpoint</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((row) => {
                  const policyCount = policiesByLocation.get(row.id) ?? 0;
                  return (
                    <ClickableRow key={row.id} to={`/storage/${row.id}`}>
                      <td className="px-4 py-3">
                        <span className="block text-sm font-medium text-slate-100">{row.name}</span>
                        <span className="block text-xs text-slate-500 mt-0.5">
                          {row.hasCredentials ? 'Custom credentials' : 'Environment defaults'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StorageTypeBadge type={row.type} isDefault={row.isDefault} />
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-400">
                        {row.bucketName}
                        <span className="block text-xs hf-muted">/{row.prefixPath}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {policyCount > 0 ? (
                          <Link
                            to="/recording-policies"
                            className="text-brand-400 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {policyCount} polic{policyCount === 1 ? 'y' : 'ies'}
                          </Link>
                        ) : (
                          <Link
                            to={`/recording-policies?storage=${row.id}`}
                            className="text-slate-500 hover:text-brand-400 text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            + Add policy
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-400 max-w-[12rem] truncate">
                        {row.endpoint ?? 'env default'}
                      </td>
                    </ClickableRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="New storage location"
      >
        <div className="max-w-lg max-h-[min(75vh,680px)] overflow-y-auto pr-1">
          <StorageLocationFormFields
            values={form}
            onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
            fieldErrors={validationErrors}
          />
          <FormError message={submitError} />
          <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-700/50 sticky bottom-0 bg-slate-900/95 pb-1">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreate} disabled={!canCreate || isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create location'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default StoragePage;
