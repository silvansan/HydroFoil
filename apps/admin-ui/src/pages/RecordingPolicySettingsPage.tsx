import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card } from '@hydrofoil/ui-kit';

import { api } from '../api/client';
import type { RecordingPolicy, StorageLocation } from '../api/types';
import { Alert } from '../components/Alert';
import { DeleteButton } from '../components/DeleteButton';
import { FormError } from '../components/FormError';
import { RecordingPolicyFormFields } from '../components/RecordingPolicyFormFields';
import { ResourceSettingsLayout } from '../components/ResourceSettingsLayout';
import { errorMessage } from '../lib/api-error';
import {
  buildObjectKeyPreview,
  describeFinalizeMode,
  recordingPolicyFormErrors,
  recordingPolicyFromApi,
  type RecordingPolicyFormValues,
} from '../lib/recording-storage';

const RecordingPolicySettingsPage: React.FC = () => {
  const { policyId } = useParams<{ policyId: string }>();
  const navigate = useNavigate();
  const [policy, setPolicy] = React.useState<RecordingPolicy | null>(null);
  const [locations, setLocations] = React.useState<StorageLocation[]>([]);
  const [form, setForm] = React.useState<RecordingPolicyFormValues | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [showValidation, setShowValidation] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!policyId) return;
    setError(null);
    try {
      const [result, locationRes] = await Promise.all([
        api.getRecordingPolicy(policyId),
        api.listStorageLocations(),
      ]);
      setPolicy(result);
      setLocations(locationRes.items);
      setForm(recordingPolicyFromApi(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, [policyId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!policyId || !form) return;
    setShowValidation(true);
    const validationErrors = recordingPolicyFormErrors(form);
    if (Object.keys(validationErrors).length > 0) {
      setSaveError('Fix the highlighted fields before saving.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setNotice(null);
    try {
      const updated = await api.updateRecordingPolicy(policyId, {
        name: form.name.trim(),
        enabled: form.enabled,
        storageLocationId: form.storageLocationId,
        pathPrefix: form.pathPrefix.trim(),
        filenameTemplate: form.filenameTemplate.trim(),
        retentionDays: form.retentionDays.trim() ? Number(form.retentionDays) : null,
        remuxToMp4: form.remuxToMp4,
        keepSourceFlvHours: form.remuxToMp4 && form.keepSourceFlvFor24h ? 24 : null,
      });
      setPolicy(updated);
      setForm(recordingPolicyFromApi(updated));
      setNotice('Recording policy saved');
    } catch (err) {
      setSaveError(errorMessage(err, 'Failed to save recording policy'));
    } finally {
      setIsSaving(false);
    }
  };

  const selectedLocation = locations.find((l) => l.id === form?.storageLocationId);
  const finalize = policy ? describeFinalizeMode(policy) : null;
  const preview =
    form && selectedLocation
      ? buildObjectKeyPreview(selectedLocation, form.pathPrefix, form.filenameTemplate)
      : null;

  const validationErrors =
    showValidation && form ? recordingPolicyFormErrors(form) : undefined;
  const canSave =
    form !== null && Object.keys(recordingPolicyFormErrors(form)).length === 0;

  return (
    <ResourceSettingsLayout
      backTo="/recording-policies"
      backLabel="All recording policies"
      title={policy?.name ?? 'Recording policy'}
      description="DVR folder, filename pattern, finalize options, and storage location"
    >
      {error && <Alert>{error}</Alert>}
      {saveError && <Alert>{saveError}</Alert>}
      {notice && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {notice}
        </div>
      )}
      {policy && form && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <Card className="p-6 max-w-2xl">
            <RecordingPolicyFormFields
              values={form}
              onChange={(patch) => setForm((current) => (current ? { ...current, ...patch } : current))}
              locations={locations}
              fieldErrors={validationErrors}
              showEnabledToggle
            />
            <FormError message={saveError} />
            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-700/50">
              <Button variant="secondary" onClick={() => load()} disabled={isSaving}>
                Reset
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={!canSave || isSaving}>
                {isSaving ? 'Saving…' : 'Save policy'}
              </Button>
            </div>
          </Card>

          <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <Card className="p-4 space-y-3">
              <h2 className="text-sm font-semibold text-slate-100">Summary</h2>
              {finalize && (
                <p className="text-sm text-slate-300">
                  Finalize: <span className="text-slate-100">{finalize.label}</span>
                </p>
              )}
              {preview && (
                <div>
                  <p className="text-xs hf-muted">Example object key</p>
                  <p className="mt-1 font-mono text-xs text-slate-300 break-all">{preview}</p>
                </div>
              )}
              {policy.retentionDays && (
                <p className="text-xs hf-muted">Retention: {policy.retentionDays} days</p>
              )}
              <Link
                to={`/storage/${form.storageLocationId}`}
                className="text-xs text-brand-400 hover:underline inline-block"
              >
                Open storage browser →
              </Link>
            </Card>
            <p className="text-xs hf-muted">
              Assign this policy to stream keys from{' '}
              <Link to="/inputs" className="text-brand-400 hover:underline">
                Inputs
              </Link>
              . Multiple policies can target different folders in the same bucket.
            </p>
            <DeleteButton
              label="Delete policy"
              confirmTitle="Delete recording policy?"
              confirmMessage={`Remove "${policy.name}"? Files already in storage are not deleted.`}
              onDelete={async () => {
                await api.deleteRecordingPolicy(policyId!);
                navigate('/recording-policies');
              }}
            />
          </div>
        </div>
      )}
    </ResourceSettingsLayout>
  );
};

export default RecordingPolicySettingsPage;
