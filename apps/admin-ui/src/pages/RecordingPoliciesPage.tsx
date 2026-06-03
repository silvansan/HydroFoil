import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader, Card, Button, Modal } from '@hydrofoil/ui-kit';
import { Plus, Search } from 'lucide-react';

import { api } from '../api/client';
import type { RecordingPolicy, StorageLocation } from '../api/types';
import { Alert } from '../components/Alert';
import { ClickableRow, RowActionsCell } from '../components/ClickableRow';
import { DeleteButton } from '../components/DeleteButton';
import { FormError } from '../components/FormError';
import { RecordingPolicyFormFields } from '../components/RecordingPolicyFormFields';
import { RecordingStorageLinkCard } from '../components/RecordingStorageLinkCard';
import { useResourceList } from '../hooks/useResourceList';
import { canManageRecordingPolicyDefinitions, useAuth } from '../auth/AuthContext';
import {
  buildObjectKeyPreview,
  defaultRecordingPolicyForm,
  describeFinalizeMode,
  recordingPolicyFormErrors,
  type RecordingPolicyFormValues,
} from '../lib/recording-storage';

const RecordingPoliciesPage: React.FC = () => {
  const { user, access } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const canCreatePolicies = canManageRecordingPolicyDefinitions(user?.role, access);
  const { items, isLoading, error, reload } = useResourceList<RecordingPolicy>(() =>
    api.listRecordingPolicies('manage')
  );
  const [locations, setLocations] = React.useState<StorageLocation[]>([]);
  const [search, setSearch] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [form, setForm] = React.useState<RecordingPolicyFormValues>(defaultRecordingPolicyForm());
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showValidation, setShowValidation] = React.useState(false);

  const loadLocations = React.useCallback(() => {
    api.listStorageLocations().then((res) => {
      setLocations(res.items);
    });
  }, []);

  React.useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  React.useEffect(() => {
    const storageId = searchParams.get('storage');
    if (storageId && locations.some((l) => l.id === storageId)) {
      setForm(defaultRecordingPolicyForm(storageId));
      setIsModalOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, locations, setSearchParams]);

  const locationById = React.useMemo(
    () => new Map(locations.map((l) => [l.id, l])),
    [locations]
  );

  const filteredItems = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((policy) => {
      const loc = locationById.get(policy.storageLocationId);
      const haystack = [
        policy.name,
        policy.pathPrefix,
        policy.filenameTemplate,
        policy.storageLocationName ?? '',
        loc?.bucketName ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, search, locationById]);

  const openCreate = () => {
    setForm(defaultRecordingPolicyForm(locations[0]?.id ?? ''));
    setSubmitError(null);
    setShowValidation(false);
    setIsModalOpen(true);
  };

  const handleCreate = async () => {
    setShowValidation(true);
    if (Object.keys(recordingPolicyFormErrors(form)).length > 0) {
      setSubmitError('Fix the highlighted fields before creating.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await api.createRecordingPolicy({
        name: form.name.trim(),
        storageLocationId: form.storageLocationId,
        pathPrefix: form.pathPrefix.trim(),
        filenameTemplate: form.filenameTemplate.trim(),
        retentionDays: form.retentionDays.trim() ? Number(form.retentionDays) : undefined,
        remuxToMp4: form.remuxToMp4,
        keepSourceFlvHours: form.remuxToMp4 && form.keepSourceFlvFor24h ? 24 : null,
        enabled: true,
      });
      setIsModalOpen(false);
      setForm(defaultRecordingPolicyForm(locations[0]?.id ?? ''));
      await reload();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create policy');
    } finally {
      setIsSubmitting(false);
    }
  };

  const validationErrors = showValidation ? recordingPolicyFormErrors(form) : undefined;
  const canCreate =
    locations.length > 0 &&
    Object.keys(recordingPolicyFormErrors(form)).length === 0 &&
    form.name.trim().length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recording Policies"
        description="Define where live DVR writes files and how they are finalized — then assign policies to stream keys."
        action={
          canCreatePolicies ? (
            <Button variant="primary" onClick={openCreate} disabled={locations.length === 0}>
              <Plus size={16} className="mr-1.5 inline" aria-hidden />
              New policy
            </Button>
          ) : undefined
        }
      />

      {error && <Alert>{error}</Alert>}

      <RecordingStorageLinkCard
        variant="policies"
        storageCount={locations.length}
        policyCount={items.length}
      />

      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Policies</h2>
            <p className="mt-1 text-sm hf-muted">
              {items.length} polic{items.length === 1 ? 'y' : 'ies'} — open to edit storage path and
              attachments.
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
                placeholder="Search policies…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search recording policies"
              />
            </div>
          )}
        </div>
        {isLoading ? (
          <div className="px-6 py-12 text-center hf-muted">Loading policies…</div>
        ) : locations.length === 0 ? (
          <div className="px-6 py-14 text-center max-w-md mx-auto">
            <p className="text-slate-200">Storage required</p>
            <p className="mt-2 text-sm hf-muted">
              Recording policies need a bucket to write into. Add a storage location first.
            </p>
            <Link to="/storage">
              <Button variant="primary" className="mt-6">
                Go to Storage
              </Button>
            </Link>
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-14 text-center max-w-md mx-auto">
            <p className="text-slate-200">No recording policies yet</p>
            <p className="mt-2 text-sm hf-muted">
              Create a policy to set the DVR folder, filename pattern, and MP4 finalize options.
              Assign it on each stream key under Inputs.
            </p>
            {canCreatePolicies && (
              <Button variant="primary" className="mt-6" onClick={openCreate}>
                Create first policy
              </Button>
            )}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="px-6 py-12 text-center hf-muted">No policies match &ldquo;{search}&rdquo;</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/40">
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Policy</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Storage</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Object path</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Finalize</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((policy) => {
                  const loc = locationById.get(policy.storageLocationId);
                  const finalize = describeFinalizeMode(policy);
                  const preview = buildObjectKeyPreview(
                    loc,
                    policy.pathPrefix,
                    policy.filenameTemplate
                  );
                  return (
                    <ClickableRow key={policy.id} to={`/recording-policies/${policy.id}`}>
                      <td className="px-4 py-3 text-sm font-medium text-slate-100">{policy.name}</td>
                      <td className="px-4 py-3 text-sm">
                        <Link
                          to={`/storage/${policy.storageLocationId}`}
                          className="text-brand-400 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {policy.storageLocationName ?? loc?.name ?? '—'}
                        </Link>
                        {policy.bucketName && (
                          <span className="block font-mono text-xs hf-muted">{policy.bucketName}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-400 max-w-xs truncate" title={preview}>
                        {preview}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">{finalize.label}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={
                            policy.enabled
                              ? 'text-emerald-300/90'
                              : 'text-slate-500'
                          }
                        >
                          {policy.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <RowActionsCell className="px-4 py-3">
                        <DeleteButton
                          label="Delete"
                          confirmTitle="Delete recording policy?"
                          confirmMessage={`Remove "${policy.name}"? Existing recording files stay in storage.`}
                          onDelete={async () => {
                            await api.deleteRecordingPolicy(policy.id);
                            await reload();
                          }}
                        />
                      </RowActionsCell>
                    </ClickableRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New recording policy">
        <div className="max-w-lg max-h-[min(75vh,680px)] overflow-y-auto pr-1">
          <RecordingPolicyFormFields
            values={form}
            onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
            locations={locations}
            fieldErrors={validationErrors}
          />
          <FormError message={submitError} />
          <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-700/50 sticky bottom-0 bg-slate-900/95 pb-1">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreate} disabled={!canCreate || isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create policy'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default RecordingPoliciesPage;
