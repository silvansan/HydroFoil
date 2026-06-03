import React from 'react';
import { Globe, Link2, Shield } from 'lucide-react';

import type { DomainBlock } from '../api/types';
import { PLAYBACK_ACCESS_OPTIONS, accessBadgeTone } from '../lib/privacy-policy';

type PrivacyPolicyAccessBadgeProps = {
  policy: DomainBlock['playbackAccessPolicy'];
  domainCount?: number;
  compact?: boolean;
};

const ICONS = {
  public: Globe,
  'token-required': Link2,
  restricted: Shield,
} as const;

const TONE_CLASSES = {
  neutral: 'border-slate-600/50 bg-slate-800/50 text-slate-300',
  brand: 'border-brand-500/35 bg-brand-600/15 text-brand-200',
  amber: 'border-amber-500/35 bg-amber-500/10 text-amber-200',
} as const;

export const PrivacyPolicyAccessBadge: React.FC<PrivacyPolicyAccessBadgeProps> = ({
  policy,
  domainCount,
  compact = false,
}) => {
  const option = PLAYBACK_ACCESS_OPTIONS.find((o) => o.value === policy);
  const Icon = ICONS[policy];
  const tone = accessBadgeTone(policy);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      <Icon size={compact ? 12 : 14} aria-hidden />
      <span>{option?.shortLabel ?? policy}</span>
      {policy === 'restricted' && domainCount !== undefined && (
        <span className="opacity-80">· {domainCount}</span>
      )}
    </span>
  );
};

export default PrivacyPolicyAccessBadge;
