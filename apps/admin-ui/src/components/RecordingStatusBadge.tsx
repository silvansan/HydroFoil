import React from 'react';

import { describeRecordingStatus } from '../lib/recording-management';

type RecordingStatusBadgeProps = {
  status: string;
  showHint?: boolean;
};

export const RecordingStatusBadge: React.FC<RecordingStatusBadgeProps> = ({
  status,
  showHint = false,
}) => {
  const info = describeRecordingStatus(status);
  const toneClass =
    info.tone === 'success'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : info.tone === 'warning'
        ? 'bg-amber-500/15 text-amber-200 border-amber-500/30'
        : info.tone === 'danger'
          ? 'bg-red-500/15 text-red-300 border-red-500/30'
          : info.tone === 'active'
            ? 'bg-red-500/10 text-red-300 border-red-500/25'
            : 'bg-slate-700/40 text-slate-300 border-slate-600/50';

  return (
    <span className="inline-flex flex-col gap-0.5">
      <span
        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${toneClass}`}
      >
        {info.label}
      </span>
      {showHint && info.hint ? <span className="text-xs hf-muted">{info.hint}</span> : null}
    </span>
  );
};
