import React from 'react';

/** Matches route-card “Active” styling — stream is publishing to SRS now. */
export const StreamLiveBadge: React.FC = () => (
  <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-brand-600/20 text-brand-300 border border-brand-500/30 shrink-0">
    <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" aria-hidden />
    Live
  </span>
);
