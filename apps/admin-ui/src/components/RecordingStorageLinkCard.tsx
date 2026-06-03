import React from 'react';
import { Link } from 'react-router-dom';
import { HardDrive, Video } from 'lucide-react';

type RecordingStorageLinkCardProps = {
  variant: 'storage' | 'policies';
  storageCount: number;
  policyCount: number;
};

export const RecordingStorageLinkCard: React.FC<RecordingStorageLinkCardProps> = ({
  variant,
  storageCount,
  policyCount,
}) => {
  if (variant === 'storage') {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 flex gap-3">
        <Video className="h-5 w-5 text-brand-400 shrink-0 mt-0.5" aria-hidden />
        <div className="text-sm">
          <p className="text-slate-200 font-medium">Recording policies use these buckets</p>
          <p className="mt-1 hf-muted">
            {policyCount === 0
              ? 'No DVR policies yet — define where live recordings are stored.'
              : `${policyCount} polic${policyCount === 1 ? 'y' : 'ies'} writing to your locations.`}
          </p>
          <Link to="/recording-policies" className="mt-2 inline-block text-brand-400 hover:underline text-xs">
            View recording policies →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 flex gap-3">
      <HardDrive className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" aria-hidden />
      <div className="text-sm">
        <p className="text-slate-200 font-medium">Policies need storage first</p>
        <p className="mt-1 hf-muted">
          {storageCount === 0
            ? 'Create a MinIO or S3 location before adding a recording policy.'
            : `${storageCount} location${storageCount === 1 ? '' : 's'} available — pick one per policy.`}
        </p>
        <Link to="/storage" className="mt-2 inline-block text-brand-400 hover:underline text-xs">
          Manage storage →
        </Link>
      </div>
    </div>
  );
};

export default RecordingStorageLinkCard;
