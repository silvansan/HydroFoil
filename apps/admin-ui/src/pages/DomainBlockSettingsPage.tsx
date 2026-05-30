import React from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@hydrofoil/ui-kit';

import { api } from '../api/client';
import { Alert } from '../components/Alert';
import { ResourceSettingsLayout } from '../components/ResourceSettingsLayout';

const DomainBlockSettingsPage: React.FC = () => {
  const { blockId } = useParams<{ blockId: string }>();
  const [block, setBlock] = React.useState<Record<string, unknown> | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!blockId) return;
    api
      .getDomainBlock(blockId)
      .then(setBlock)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [blockId]);

  const domains = Array.isArray(block?.allowedDomains)
    ? (block.allowedDomains as string[]).join(', ')
    : '—';

  return (
    <ResourceSettingsLayout
      backTo="/domain-blocks"
      backLabel="All domain blocks"
      title={String(block?.name ?? 'Domain block')}
      description={<span className="font-mono text-sm">{String(block?.slug ?? '')}</span>}
    >
      {error && <Alert>{error}</Alert>}
      {block && (
        <Card className="p-6 max-w-xl">
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="hf-muted">Allowed domains</dt>
              <dd className="text-slate-200 break-all">{domains}</dd>
            </div>
            <div>
              <dt className="hf-muted">Playback access</dt>
              <dd className="text-slate-200">{String(block.playbackAccessPolicy ?? '—')}</dd>
            </div>
          </dl>
          <p className="text-xs hf-muted mt-4">Full editor UI is on the roadmap.</p>
        </Card>
      )}
    </ResourceSettingsLayout>
  );
};

export default DomainBlockSettingsPage;
