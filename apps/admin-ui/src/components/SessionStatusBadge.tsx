import React from 'react';

import { isSessionPublishing } from '../lib/session-status';

interface SessionStatusBadgeProps {
  status: string;
  className?: string;
}

/** Pill badge for live session rows — Active (publishing) or Idle (ended / stale). */
export const SessionStatusBadge: React.FC<SessionStatusBadgeProps> = ({
  status,
  className = '',
}) => {
  if (isSessionPublishing(status)) {
    return (
      <span
        className={`inline-flex items-center text-xs px-2.5 py-0.5 rounded-full bg-brand-600/20 text-brand-300 border border-brand-500/40 font-medium shrink-0 ${className}`}
      >
        <span
          className="mr-1.5 h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse"
          aria-hidden
        />
        Active
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center text-xs px-2.5 py-0.5 rounded-full bg-slate-700/40 text-slate-400 border border-slate-600/70 font-medium shrink-0 ${className}`}
    >
      Idle
    </span>
  );
};
