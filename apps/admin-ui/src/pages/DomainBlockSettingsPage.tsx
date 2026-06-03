import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card } from '@hydrofoil/ui-kit';

import { api } from '../api/client';
import type { DomainBlock, Output, VodRoute } from '../api/types';
import { Alert } from '../components/Alert';
import { DeleteButton } from '../components/DeleteButton';
import { FormError } from '../components/FormError';
import {
  PrivacyPolicyFormFields,
  type PrivacyPolicyFormValues,
} from '../components/PrivacyPolicyFormFields';
import { PrivacyPolicySummaryCard } from '../components/PrivacyPolicySummaryCard';
import { PrivacyPolicyTargetPicker } from '../components/PrivacyPolicyTargetPicker';
import { ResourceSettingsLayout } from '../components/ResourceSettingsLayout';
import { errorMessage } from '../lib/api-error';
import { parseAllowedDomains, policyFormErrors } from '../lib/privacy-policy';
import { syncPolicyAttachments } from '../lib/privacy-policy-attachments';

const DomainBlockSettingsPage: React.FC = () => {
  const { blockId } = useParams<{ blockId: string }>();
  const navigate = useNavigate();
  const [block, setBlock] = React.useState<DomainBlock | null>(null);
  const [allPolicies, setAllPolicies] = React.useState<DomainBlock[]>([]);
  const [outputs, setOutputs] = React.useState<Output[]>([]);
  const [vodRoutes, setVodRoutes] = React.useState<VodRoute[]>([]);
  const [selectedOutputIds, setSelectedOutputIds] = React.useState<string[]>([]);
  const [selectedVodRouteIds, setSelectedVodRouteIds] = React.useState<string[]>([]);
  const [form, setForm] = React.useState<PrivacyPolicyFormValues>({
    name: '',
    allowedDomains: '',
    playbackAccessPolicy: 'public',
    targetType: 'stream',
    attachTarget: '',
  });
  const [error, setError] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [showValidation, setShowValidation] = React.useState(false);

  const policyNameById = React.useMemo(
    () => new Map(allPolicies.map((p) => [p.id, p.name])),
    [allPolicies]
  );

  const load = React.useCallback(async () => {
    if (!blockId) return;
    setError(null);
    try {
      const [result, outputRes, vodRouteRes, policyRes] = await Promise.all([
        api.getDomainBlock(blockId),
        api.listOutputs(),
        api.listVodRoutes(),
        api.listDomainBlocks(),
      ]);
      setBlock(result);
      setAllPolicies(policyRes.items);
      setOutputs(outputRes.items);
      setVodRoutes(vodRouteRes.items);
      setSelectedOutputIds(
        outputRes.items.filter((output) => output.domainBlockId === result.id).map((o) => o.id)
      );
      setSelectedVodRouteIds(
        vodRouteRes.items.filter((route) => route.domainBlockId === result.id).map((r) => r.id)
      );
      setForm({
        name: result.name,
        allowedDomains: result.allowedDomains.join('\n'),
        playbackAccessPolicy: result.playbackAccessPolicy,
        targetType: 'stream',
        attachTarget: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, [blockId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const toggleOutput = (outputId: string) => {
    setSelectedOutputIds((current) =>
      current.includes(outputId) ? current.filter((id) => id !== outputId) : [...current, outputId]
    );
  };

  const toggleVodRoute = (vodRouteId: string) => {
    setSelectedVodRouteIds((current) =>
      current.includes(vodRouteId) ? current.filter((id) => id !== vodRouteId) : [...current, vodRouteId]
    );
  };

  const handleSave = async () => {
    if (!blockId) return;
    setShowValidation(true);
    const validationErrors = policyFormErrors(form);
    if (Object.keys(validationErrors).length > 0) {
      setSaveError('Fix the highlighted fields before saving.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setNotice(null);
    try {
      const updated = await api.updateDomainBlock(blockId, {
        name: form.name.trim(),
        allowedDomains: parseAllowedDomains(form.allowedDomains),
        playbackAccessPolicy: form.playbackAccessPolicy,
        tokenRequired: form.playbackAccessPolicy === 'token-required',
      });

      await syncPolicyAttachments(
        blockId,
        outputs,
        vodRoutes,
        selectedOutputIds,
        selectedVodRouteIds
      );

      setBlock(updated);
      setNotice('Privacy policy saved');
      await load();
    } catch (err) {
      setSaveError(errorMessage(err, 'Failed to save privacy policy'));
    } finally {
      setIsSaving(false);
    }
  };

  const validationErrors = showValidation ? policyFormErrors(form) : undefined;

  const canSave =
    form.name.trim().length > 0 && Object.keys(policyFormErrors(form)).length === 0;

  return (
    <ResourceSettingsLayout
      backTo="/domain-blocks"
      backLabel="All privacy policies"
      title={block?.name ?? 'Privacy policy'}
      description={
        block ? (
          <span className="text-sm text-slate-400">
            Internal ID: <span className="font-mono">{block.slug}</span>
          </span>
        ) : undefined
      }
      action={
        blockId ? (
          <DeleteButton
            label="Delete policy"
            confirmTitle={`Delete "${block?.name ?? 'this policy'}"?`}
            confirmMessage="This removes the policy and detaches it from any outputs or VOD routes using it."
            onDelete={async () => {
              await api.deleteDomainBlock(blockId);
              navigate('/domain-blocks');
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
      {block && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(22rem,1fr)]">
          <div className="space-y-6">
            <Card className="p-6 max-w-2xl">
              <PrivacyPolicyFormFields
                idPrefix="edit-policy"
                variant="edit"
                lockedSlug={block.slug}
                values={form}
                onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
                streamOptions={[]}
                vodOptions={[]}
                showTargetPicker={false}
                fieldErrors={validationErrors}
                showValidation={showValidation}
              />
              <FormError message={saveError} />
              <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-700/50">
                <Button variant="secondary" onClick={() => load()} disabled={isSaving}>
                  Reset
                </Button>
                <Button variant="primary" onClick={handleSave} disabled={!canSave || isSaving}>
                  {isSaving ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <PrivacyPolicyTargetPicker
                policyId={block.id}
                policyName={block.name}
                resolveOtherPolicyName={(id) => policyNameById.get(id)}
                outputs={outputs}
                vodRoutes={vodRoutes}
                selectedOutputIds={selectedOutputIds}
                selectedVodRouteIds={selectedVodRouteIds}
                onToggleOutput={toggleOutput}
                onToggleVodRoute={toggleVodRoute}
                onSelectAllOutputs={() => setSelectedOutputIds(outputs.map((o) => o.id))}
                onClearOutputs={() => setSelectedOutputIds([])}
                onSelectAllVod={() => setSelectedVodRouteIds(vodRoutes.map((r) => r.id))}
                onClearVod={() => setSelectedVodRouteIds([])}
              />
            </Card>
          </div>

          <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <PrivacyPolicySummaryCard
              block={block}
              outputCount={selectedOutputIds.length}
              vodCount={selectedVodRouteIds.length}
            />
            <p className="text-xs hf-muted">
              Changes to attachments only update targets you check or uncheck — other policies are
              left unchanged.
            </p>
          </div>
        </div>
      )}
    </ResourceSettingsLayout>
  );
};

export default DomainBlockSettingsPage;
