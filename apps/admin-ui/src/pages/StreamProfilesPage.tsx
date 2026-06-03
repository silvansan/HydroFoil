import React from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, Card, Button, Modal } from '@hydrofoil/ui-kit';
import { Copy, Plus, Search } from 'lucide-react';

import { api } from '../api/client';
import type { StreamProfile } from '../api/types';
import { Alert } from '../components/Alert';
import { ClickableRow, RowActionsCell } from '../components/ClickableRow';
import { DeleteButton } from '../components/DeleteButton';
import { FormError } from '../components/FormError';
import { StreamProfileFormFields } from '../components/StreamProfileFormFields';
import { StreamProfileModeBadge } from '../components/StreamProfileModeBadge';
import { useResourceList } from '../hooks/useResourceList';
import {
  cloneStreamProfileForm,
  defaultStreamProfileForm,
  describeStreamProfile,
  streamProfileFormErrors,
  streamProfileToApiPayload,
  type StreamProfileFormValues,
} from '../lib/stream-profile';

const StreamProfilesPage: React.FC = () => {
  const { items, isLoading, error, reload } = useResourceList<StreamProfile>(() =>
    api.listStreamProfiles()
  );
  const [search, setSearch] = React.useState('');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [duplicateSource, setDuplicateSource] = React.useState<StreamProfile | null>(null);
  const [form, setForm] = React.useState<StreamProfileFormValues>(defaultStreamProfileForm);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showValidation, setShowValidation] = React.useState(false);

  const filteredItems = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((profile) => {
      const info = describeStreamProfile(profile);
      const haystack = [
        profile.name,
        profile.mode,
        profile.audioHandling,
        info.ladderSummary ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, search]);

  const openCreate = () => {
    setDuplicateSource(null);
    setForm(defaultStreamProfileForm());
    setSubmitError(null);
    setShowValidation(false);
    setIsModalOpen(true);
  };

  const openDuplicate = (profile: StreamProfile, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDuplicateSource(profile);
    setForm(cloneStreamProfileForm(profile));
    setSubmitError(null);
    setShowValidation(false);
    setIsModalOpen(true);
  };

  const handleCreate = async () => {
    setShowValidation(true);
    if (Object.keys(streamProfileFormErrors(form)).length > 0) {
      setSubmitError('Fix the highlighted fields before creating.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await api.createStreamProfile(streamProfileToApiPayload(form));
      setIsModalOpen(false);
      setForm(defaultStreamProfileForm());
      await reload();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  const validationErrors = showValidation ? streamProfileFormErrors(form) : undefined;
  const canCreate =
    Object.keys(streamProfileFormErrors(form)).length === 0 && form.name.trim().length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stream Profiles"
        description="Define passthrough or ABR transcode ladders — assign one or more profiles per stream key."
        action={
          <Button variant="primary" onClick={openCreate}>
            <Plus size={16} className="mr-1.5 inline" aria-hidden />
            New profile
          </Button>
        }
      />

      {error && <Alert>{error}</Alert>}

      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Profiles</h2>
            <p className="mt-1 text-sm hf-muted">
              {items.length} profile{items.length === 1 ? '' : 's'} — open a row to edit the ladder.
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
                placeholder="Search profiles…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search stream profiles"
              />
            </div>
          )}
        </div>
        {isLoading ? (
          <div className="px-6 py-12 text-center hf-muted">Loading profiles…</div>
        ) : items.length === 0 ? (
          <div className="px-6 py-14 text-center max-w-md mx-auto">
            <p className="text-slate-200">No stream profiles yet</p>
            <p className="mt-2 text-sm hf-muted">
              Create a passthrough or ABR profile, then attach it on each stream key under Inputs.
            </p>
            <Button variant="primary" className="mt-6" onClick={openCreate}>
              Create first profile
            </Button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="px-6 py-12 text-center hf-muted">No profiles match &ldquo;{search}&rdquo;</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/40">
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Profile</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Mode</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Ladder</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Audio</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((profile) => {
                  const info = describeStreamProfile(profile);
                  return (
                    <ClickableRow key={profile.id} to={`/stream-profiles/${profile.id}`}>
                      <td className="px-4 py-3 text-sm font-medium text-slate-100">{profile.name}</td>
                      <td className="px-4 py-3 text-sm">
                        <StreamProfileModeBadge
                          mode={profile.mode}
                          renditionCount={info.renditionCount}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400 max-w-xs">
                        {info.ladderSummary ? (
                          <>
                            <span className="font-mono text-xs">{info.ladderSummary}</span>
                            {info.totalKbps > 0 && (
                              <span className="block text-xs hf-muted mt-0.5">
                                ~{info.totalKbps} kbps
                              </span>
                            )}
                          </>
                        ) : (
                          'Source encode only'
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">{info.audioLabel}</td>
                      <RowActionsCell className="px-4 py-3">
                        <button
                          type="button"
                          className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-brand-300"
                          title="Duplicate profile"
                          aria-label={`Duplicate ${profile.name}`}
                          onClick={(e) => openDuplicate(profile, e)}
                        >
                          <Copy size={16} />
                        </button>
                        <DeleteButton
                          label="Delete profile"
                          confirmTitle="Delete stream profile?"
                          confirmMessage={`Remove "${profile.name}"? Assigned stream keys keep their ID until cleared.`}
                          onDelete={async () => {
                            await api.deleteStreamProfile(profile.id);
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

      <p className="text-sm hf-muted">
        Assign profiles on each stream key via{' '}
        <Link to="/inputs" className="hf-link hover:underline">
          Inputs
        </Link>
        . Changes trigger gateway reconcile automatically.
      </p>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={duplicateSource ? `Duplicate “${duplicateSource.name}”` : 'New stream profile'}
      >
        <div className="max-w-lg max-h-[min(75vh,680px)] overflow-y-auto pr-1">
          <StreamProfileFormFields
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
              {isSubmitting ? 'Creating…' : 'Create profile'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default StreamProfilesPage;
