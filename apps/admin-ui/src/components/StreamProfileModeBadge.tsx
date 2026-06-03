import React from 'react';

type StreamProfileModeBadgeProps = {
  mode: 'passthrough' | 'transcode';
  renditionCount?: number;
};

export const StreamProfileModeBadge: React.FC<StreamProfileModeBadgeProps> = ({
  mode,
  renditionCount = 0,
}) => {
  const isPassthrough = mode === 'passthrough';
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
        isPassthrough
          ? 'bg-slate-700/50 text-slate-300 border border-slate-600/60'
          : 'bg-brand-600/15 text-brand-300 border border-brand-500/30'
      }`}
    >
      {isPassthrough ? 'Passthrough' : `ABR · ${renditionCount || '—'}`}
    </span>
  );
};
