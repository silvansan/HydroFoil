import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Button } from '@hydrofoil/ui-kit';

import { api } from '../api/client';
import { Alert } from '../components/Alert';
import { DeleteButton } from '../components/DeleteButton';
import { ResourceSettingsLayout } from '../components/ResourceSettingsLayout';

const RecordingPolicySettingsPage: React.FC = () => {
  const { policyId } = useParams<{ policyId: string }>();
  const navigate = useNavigate();
  const [policy, setPolicy] = React.useState<Record<string, unknown> | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const reload = React.useCallback(() => {
    if (!policyId) return;
    api
      .getRecordingPolicy(policyId)
      .then(setPolicy)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [policyId]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  const toggleEnabled = async () => {
    if (!policyId || !policy) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateRecordingPolicy(policyId, {
        enabled: !policy.enabled,
      });
      setPolicy(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResourceSettingsLayout
      backTo="/recording-policies"
      backLabel="All recording policies"
      title={String(policy?.name ?? 'Recording policy')}
      description="DVR storage path and retention rules"
      action={
        policy ? (
          <Button variant="secondary" onClick={toggleEnabled} disabled={saving}>
            {policy.enabled ? 'Disable' : 'Enable'}
          </Button>
        ) : undefined
      }
    >
      {error && <Alert>{error}</Alert>}
      {policy && (
        <Card className="p-6 max-w-xl space-y-4">
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="hf-muted">Storage</dt>
              <dd className="text-slate-200">
                {String(policy.storageLocationName ?? '—')}
                {policy.bucketName ? (
                  <span className="block font-mono text-xs hf-muted">{String(policy.bucketName)}</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="hf-muted">Path prefix</dt>
              <dd className="font-mono text-slate-200">{String(policy.pathPrefix ?? '—')}</dd>
            </div>
            <div>
              <dt className="hf-muted">Filename template</dt>
              <dd className="font-mono text-slate-200 break-all">
                {String(policy.filenameTemplate ?? '—')}
              </dd>
            </div>
            <div>
              <dt className="hf-muted">Retention</dt>
              <dd className="text-slate-200">
                {policy.retentionDays ? `${String(policy.retentionDays)} days` : 'None'}
              </dd>
            </div>
            <div>
              <dt className="hf-muted">Finalize format</dt>
              <dd className="text-slate-200">
                {policy.remuxToMp4 ? 'Remux to MP4 after live stops' : 'Keep FLV as primary asset'}
                {policy.keepSourceFlvHours ? (
                  <span className="block text-xs hf-muted">
                    Keep source FLV for {String(policy.keepSourceFlvHours)} hours
                  </span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="hf-muted">Status</dt>
              <dd className="text-slate-200">{policy.enabled ? 'Enabled' : 'Disabled'}</dd>
            </div>
          </dl>
          <DeleteButton
            label="Delete policy"
            confirmTitle="Delete recording policy?"
            confirmMessage={`Remove "${String(policy.name)}"? Existing recordings are not deleted.`}
            onDelete={async () => {
              await api.deleteRecordingPolicy(policyId!);
              navigate('/recording-policies');
            }}
          />
        </Card>
      )}
    </ResourceSettingsLayout>
  );
};

export default RecordingPolicySettingsPage;
