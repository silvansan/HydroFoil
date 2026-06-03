import React from 'react';

import type { DomainBlock } from '../api/types';
import { PLAYBACK_ACCESS_OPTIONS, formatDomainsPreview } from '../lib/privacy-policy';
import { PrivacyPolicyAccessBadge } from './PrivacyPolicyAccessBadge';

type PrivacyPolicySummaryCardProps = {
  block: DomainBlock;
  outputCount: number;
  vodCount: number;
};

export const PrivacyPolicySummaryCard: React.FC<PrivacyPolicySummaryCardProps> = ({
  block,
  outputCount,
  vodCount,
}) => {
  const access = PLAYBACK_ACCESS_OPTIONS.find((o) => o.value === block.playbackAccessPolicy);

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <PrivacyPolicyAccessBadge
          policy={block.playbackAccessPolicy}
          domainCount={block.allowedDomains.length}
        />
        <span className="text-xs hf-muted font-mono">{block.slug}</span>
      </div>
      {access && (
        <p className="text-sm text-slate-300 leading-relaxed">{access.description}</p>
      )}
      {block.playbackAccessPolicy === 'restricted' && (
        <p className="text-xs text-slate-400">
          <span className="text-slate-500">Allowed: </span>
          {formatDomainsPreview(block.allowedDomains, 5)}
        </p>
      )}
      <p className="text-xs hf-muted border-t border-slate-800/60 pt-3">
        Attached to {outputCount} live output{outputCount === 1 ? '' : 's'} and {vodCount} VOD route
        {vodCount === 1 ? '' : 's'}.
      </p>
    </div>
  );
};

export default PrivacyPolicySummaryCard;
