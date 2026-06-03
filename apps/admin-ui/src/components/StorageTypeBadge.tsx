import React from 'react';
import { Cloud, HardDrive } from 'lucide-react';

import { storageTypeLabel, storageTypeTone } from '../lib/recording-storage';

const TONE_CLASSES = {
  brand: 'border-brand-500/35 bg-brand-600/15 text-brand-200',
  cyan: 'border-cyan-500/35 bg-cyan-500/10 text-cyan-200',
  neutral: 'border-slate-600/50 bg-slate-800/50 text-slate-300',
} as const;

type StorageTypeBadgeProps = {
  type: string;
  isDefault?: boolean;
};

export const StorageTypeBadge: React.FC<StorageTypeBadgeProps> = ({ type, isDefault }) => {
  const tone = storageTypeTone(type);
  const Icon = type === 's3' ? Cloud : HardDrive;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}
      >
        <Icon size={12} aria-hidden />
        {storageTypeLabel(type)}
      </span>
      {isDefault && (
        <span className="rounded-full border border-slate-600/60 px-2 py-0.5 text-xs text-slate-400">
          Default
        </span>
      )}
    </span>
  );
};

export default StorageTypeBadge;
