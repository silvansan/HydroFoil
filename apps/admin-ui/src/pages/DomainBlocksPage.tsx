import React from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, Card, Button, Modal } from '@hydrofoil/ui-kit';
import { Plus, Search } from 'lucide-react';

import { api } from '../api/client';
import type { DomainBlock, Output, VodRoute } from '../api/types';
import { Alert } from '../components/Alert';
import { ClickableRow } from '../components/ClickableRow';
import { FormError } from '../components/FormError';
import {
  PrivacyPolicyFormFields,
  type PrivacyPolicyFormValues,
} from '../components/PrivacyPolicyFormFields';
import { PrivacyPolicyAccessBadge } from '../components/PrivacyPolicyAccessBadge';
import { useResourceList } from '../hooks/useResourceList';
import { canManageApplications, useAuth } from '../auth/AuthContext';
import {
  formatDomainsPreview,
  parseAllowedDomains,
  policyFormErrors,
  privacyAccessCounts,
  type PrivacyAccessFilter,
} from '../lib/privacy-policy';

const INITIAL_FORM: PrivacyPolicyFormValues = {
  name: '',
  allowedDomains: '',
  playbackAccessPolicy: 'public',
  targetType: 'stream',
  attachTarget: '',
};

const ACCESS_FILTERS: Array<{ id: PrivacyAccessFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'public', label: 'Public' },
  { id: 'token-required', label: 'Signed' },
  { id: 'restricted', label: 'Allowlist' },
];

function attachmentSummary(outputCount: number, vodCount: number): string {
  const parts: string[] = [];
  if (outputCount > 0) parts.push(`${outputCount} live`);
  if (vodCount > 0) parts.push(`${vodCount} VOD`);
  if (parts.length === 0) return 'Not attached';
  return parts.join(' · ');
}

const DomainBlocksPage: React.FC = () => {
  const { user } = useAuth();
  const { items, isLoading, error, reload } = useResourceList<DomainBlock>(() =>
    api.listDomainBlocks()
  );
  const [outputs, setOutputs] = React.useState<Output[]>([]);
  const [vodRoutes, setVodRoutes] = React.useState<VodRoute[]>([]);
  const [search, setSearch] = React.useState('');
  const [accessFilter, setAccessFilter] = React.useState<PrivacyAccessFilter>('all');
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<PrivacyPolicyFormValues>(INITIAL_FORM);
  const [showValidation, setShowValidation] = React.useState(false);

  React.useEffect(() => {
    Promise.all([api.listOutputs(), api.listVodRoutes()]).then(([outputRes, vodRouteRes]) => {
      setOutputs(outputRes.items);
      setVodRoutes(vodRouteRes.items);
    });
  }, []);

  const streamAssignmentOptions = React.useMemo(
    () =>
      outputs.map((output) => ({
        value: `output:${output.id}`,
        label: output.name,
        hint: `${output.gatewayAppName}/${output.gatewayStreamName}`,
      })),
    [outputs]
  );

  const vodAssignmentOptions = React.useMemo(
    () =>
      vodRoutes.map((route) => ({
        value: `vod:${route.id}`,
        label: route.name,
        hint: route.publicPath,
      })),
    [vodRoutes]
  );

  const usageByBlockId = React.useMemo(() => {
    const usage = new Map<string, { outputs: number; vod: number; labels: string[] }>();
    for (const output of outputs) {
      if (!output.domainBlockId) continue;
      const entry = usage.get(output.domainBlockId) ?? { outputs: 0, vod: 0, labels: [] };
      entry.outputs += 1;
      entry.labels.push(output.name);
      usage.set(output.domainBlockId, entry);
    }
    for (const route of vodRoutes) {
      if (!route.domainBlockId) continue;
      const entry = usage.get(route.domainBlockId) ?? { outputs: 0, vod: 0, labels: [] };
      entry.vod += 1;
      entry.labels.push(`VOD: ${route.name}`);
      usage.set(route.domainBlockId, entry);
    }
    return usage;
  }, [outputs, vodRoutes]);

  const accessCounts = React.useMemo(() => privacyAccessCounts(items), [items]);

  const filteredItems = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((block) => {
      if (accessFilter !== 'all' && block.playbackAccessPolicy !== accessFilter) {
        return false;
      }
      if (!q) return true;
      const usage = usageByBlockId.get(block.id);
      const haystack = [
        block.name,
        block.slug,
        block.playbackAccessPolicy,
        ...(block.allowedDomains ?? []),
        ...(usage?.labels ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, search, accessFilter, usageByBlockId]);

  const assignBlockToTarget = async (blockId: string, target: string) => {
    if (!target) return;
    if (target.startsWith('output:')) {
      await api.updateOutput(target.slice('output:'.length), { domainBlockId: blockId });
      return;
    }
    if (target.startsWith('vod:')) {
      await api.updateVodRoute(target.slice('vod:'.length), { domainBlockId: blockId });
    }
  };

  const openCreateModal = () => {
    setForm(INITIAL_FORM);
    setSubmitError(null);
    setShowValidation(false);
    setIsModalOpen(true);
  };

  const handleCreate = async () => {
    setShowValidation(true);
    const validationErrors = policyFormErrors(form);
    if (Object.keys(validationErrors).length > 0) {
      setSubmitError('Fix the highlighted fields before creating.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const block = await api.createDomainBlock({
        name: form.name.trim(),
        allowedDomains: parseAllowedDomains(form.allowedDomains),
        playbackAccessPolicy: form.playbackAccessPolicy,
        tokenRequired: form.playbackAccessPolicy === 'token-required',
      });
      await assignBlockToTarget(block.id, form.attachTarget);
      setIsModalOpen(false);
      setForm(INITIAL_FORM);
      const [outputRes, vodRouteRes] = await Promise.all([
        api.listOutputs(),
        api.listVodRoutes(),
        reload(),
      ]);
      setOutputs(outputRes.items);
      setVodRoutes(vodRouteRes.items);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create privacy policy');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canCreate =
    form.name.trim().length > 0 &&
    Object.keys(policyFormErrors(form)).length === 0;

  return (
    <div>
      <PageHeader
        title="Privacy Policies"
        description="Control who can embed or watch your streams and VOD — public access, signed links, or domain allowlists."
        action={
          canManageApplications(user?.role) ? (
            <Button variant="primary" onClick={openCreateModal}>
              <Plus size={16} className="mr-1.5 inline" aria-hidden />
              New policy
            </Button>
          ) : undefined
        }
      />

      {error && <Alert>{error}</Alert>}

      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">All policies</h2>
            <p className="mt-1 text-sm hf-muted">
              {items.length} polic{items.length === 1 ? 'y' : 'ies'} — open one to edit rules and
              attachments.
            </p>
          </div>
          {items.length > 0 && (
            <div className="flex flex-col gap-3 sm:items-end w-full sm:max-w-md">
              <div className="relative w-full">
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
                  aria-label="Search privacy policies"
                />
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                {ACCESS_FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setAccessFilter(filter.id)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      accessFilter === filter.id
                        ? 'border-brand-500/50 bg-brand-600/15 text-brand-300'
                        : 'border-slate-700/80 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {filter.label}
                    <span className="ml-1 opacity-70">({accessCounts[filter.id]})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {isLoading ? (
          <div className="px-6 py-12 text-center hf-muted">Loading privacy policies…</div>
        ) : items.length === 0 ? (
          <div className="px-6 py-14 text-center max-w-lg mx-auto">
            <p className="text-slate-200">No privacy policies yet</p>
            <p className="mt-2 text-sm hf-muted leading-relaxed">
              Policies define who can embed or play your content. Start with open access for public
              events, signed links for partners, or a domain allowlist for your own sites.
            </p>
            {canManageApplications(user?.role) && (
              <Button variant="primary" className="mt-6" onClick={openCreateModal}>
                Create your first policy
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
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Access</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Attached</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Domains</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((block) => {
                  const usage = usageByBlockId.get(block.id);
                  return (
                    <ClickableRow key={block.id} to={`/domain-blocks/${block.id}`}>
                      <td className="px-4 py-3">
                        <span className="block text-sm font-medium text-slate-100">{block.name}</span>
                        <span className="block text-xs text-slate-500 font-mono mt-0.5">{block.slug}</span>
                      </td>
                      <td className="px-4 py-3">
                        <PrivacyPolicyAccessBadge
                          policy={block.playbackAccessPolicy}
                          domainCount={block.allowedDomains.length}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {attachmentSummary(usage?.outputs ?? 0, usage?.vod ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400 max-w-xs truncate">
                        {block.playbackAccessPolicy === 'restricted'
                          ? formatDomainsPreview(block.allowedDomains)
                          : '—'}
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
        onClose={() => {
          setIsModalOpen(false);
          setSubmitError(null);
        }}
        title="New privacy policy"
      >
        <div className="max-w-lg max-h-[min(70vh,640px)] overflow-y-auto pr-1">
          <PrivacyPolicyFormFields
            idPrefix="new-policy"
            variant="create"
            existingSlugs={items.map((b) => b.slug)}
            values={form}
            onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
            streamOptions={streamAssignmentOptions.map((o) => ({
              value: o.value,
              label: o.hint ? `${o.label} — ${o.hint}` : o.label,
            }))}
            vodOptions={vodAssignmentOptions.map((o) => ({
              value: o.value,
              label: o.hint ? `${o.label} — ${o.hint}` : o.label,
            }))}
            showValidation={showValidation}
            fieldErrors={showValidation ? policyFormErrors(form) : undefined}
          />
          <FormError message={submitError} />
          <p className="mt-4 text-xs hf-muted">
            After creating, attach more targets from this policy&apos;s settings page, or from{' '}
            <Link to="/outputs" className="text-brand-400 hover:underline">
              Outputs
            </Link>{' '}
            and{' '}
            <Link to="/vod-routes" className="text-brand-400 hover:underline">
              VOD Routes
            </Link>
            .
          </p>
          <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-700/50 sticky bottom-0 bg-slate-900/95 pb-1">
            <Button
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
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

export default DomainBlocksPage;
