import React from 'react';
import { Link } from 'react-router-dom';
import { FileVideo, Radio } from 'lucide-react';

type RecordingManagementLinkCardProps = {
  readyCount: number;
  inProgressCount: number;
  policyCount?: number;
};

export const RecordingManagementLinkCard: React.FC<RecordingManagementLinkCardProps> = ({
  readyCount,
  inProgressCount,
  policyCount,
}) => (
  <div className="grid gap-4 md:grid-cols-2">
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 flex gap-3">
      <FileVideo className="h-5 w-5 text-brand-400 shrink-0 mt-0.5" aria-hidden />
      <div className="text-sm">
        <p className="text-slate-200 font-medium">Recording policies</p>
        <p className="mt-1 hf-muted">
          DVR paths and finalize options are defined per policy, then assigned on stream keys.
          {policyCount != null
            ? ` ${policyCount} polic${policyCount === 1 ? 'y' : 'ies'} configured.`
            : ''}
        </p>
        <Link to="/recording-policies" className="mt-2 inline-block hf-link hover:underline text-xs">
          Manage recording policies →
        </Link>
      </div>
    </div>
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 flex gap-3">
      <Radio className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" aria-hidden />
      <div className="text-sm">
        <p className="text-slate-200 font-medium">Catalog snapshot</p>
        <p className="mt-1 hf-muted">
          {readyCount} ready asset{readyCount === 1 ? '' : 's'}
          {inProgressCount > 0 ? ` · ${inProgressCount} in progress` : ''}.
        </p>
        <Link to="/inputs" className="mt-2 inline-block hf-link hover:underline text-xs">
          Assign policies on stream keys →
        </Link>
      </div>
    </div>
  </div>
);
