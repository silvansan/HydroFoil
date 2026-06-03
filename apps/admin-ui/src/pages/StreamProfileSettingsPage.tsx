import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card } from '@hydrofoil/ui-kit';

import { api } from '../api/client';
import type { StreamProfile } from '../api/types';
import { Alert } from '../components/Alert';
import { DeleteButton } from '../components/DeleteButton';
import { FormError } from '../components/FormError';
import { ResourceSettingsLayout } from '../components/ResourceSettingsLayout';
import { StreamProfileFormFields } from '../components/StreamProfileFormFields';
import { StreamProfileModeBadge } from '../components/StreamProfileModeBadge';
import { errorMessage } from '../lib/api-error';
import {
  describeStreamProfile,
  streamProfileFormErrors,
  streamProfileFromApi,
  streamProfileToApiPayload,
  type StreamProfileFormValues,
} from '../lib/stream-profile';

const StreamProfileSettingsPage: React.FC = () => {
  const { profileId } = useParams<{ profileId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = React.useState<StreamProfile | null>(null);
  const [form, setForm] = React.useState<StreamProfileFormValues | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [showValidation, setShowValidation] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!profileId) return;
    setError(null);
    try {
      const result = await api.getStreamProfile(profileId);
      setProfile(result);
      setForm(streamProfileFromApi(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, [profileId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!profileId || !form) return;
    setShowValidation(true);
    const validationErrors = streamProfileFormErrors(form);
    if (Object.keys(validationErrors).length > 0) {
      setSaveError('Fix the highlighted fields before saving.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setNotice(null);
    try {
      const updated = await api.updateStreamProfile(profileId, streamProfileToApiPayload(form));
      setProfile(updated);
      setForm(streamProfileFromApi(updated));
      setNotice('Stream profile saved. Gateway reconcile will apply updated transcodes.');
    } catch (err) {
      setSaveError(errorMessage(err, 'Failed to save stream profile'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!profile && !error) {
    return <div className="hf-muted py-12 text-center">Loading stream profile…</div>;
  }

  const summary = profile ? describeStreamProfile(profile) : null;

  return (
    <ResourceSettingsLayout
      backTo="/stream-profiles"
      backLabel="Stream profiles"
      title={profile?.name ?? 'Stream profile'}
      description="ABR ladder and audio handling for gateway desired config"
      action={
        profile ? (
          <DeleteButton
            label="Delete"
            confirmTitle="Delete stream profile?"
            confirmMessage={`Remove "${profile.name}"? Stream keys keep the assignment until you clear it.`}
            onDelete={async () => {
              await api.deleteStreamProfile(profile.id);
              navigate('/stream-profiles', { replace: true });
            }}
          />
        ) : undefined
      }
    >
      {error && <Alert>{error}</Alert>}
      {notice && <Alert variant="info">{notice}</Alert>}

      {profile && summary && form && (
        <div className="space-y-6">
          <Card className="p-4 flex flex-wrap items-center gap-3">
            <StreamProfileModeBadge mode={profile.mode} renditionCount={summary.renditionCount} />
            <span className="text-sm hf-muted">Audio: {summary.audioLabel}</span>
            {summary.ladderSummary && (
              <span className="text-sm font-mono text-slate-400">{summary.ladderSummary}</span>
            )}
            {profile.mode === 'transcode' && summary.totalKbps > 0 && (
              <span className="text-xs hf-muted">~{summary.totalKbps} kbps combined</span>
            )}
          </Card>

          <Card className="p-6">
            <StreamProfileFormFields
              values={form}
              onChange={(patch) => setForm((current) => (current ? { ...current, ...patch } : current))}
              fieldErrors={showValidation ? streamProfileFormErrors(form) : undefined}
            />
            <div className="mt-4">
              <FormError message={saveError} />
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-6 mt-6 border-t border-slate-700/50">
              <Link to="/stream-profiles">
                <Button variant="secondary" type="button">
                  Cancel
                </Button>
              </Link>
              <Button variant="primary" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save profile'}
              </Button>
            </div>
          </Card>

          <p className="text-xs hf-muted">
            Assign this profile on a stream key under{' '}
            <Link to="/inputs" className="hf-link hover:underline">
              Inputs
            </Link>
            . Multiple profiles on one key merge renditions in gateway config.
          </p>
        </div>
      )}
    </ResourceSettingsLayout>
  );
};

export default StreamProfileSettingsPage;
