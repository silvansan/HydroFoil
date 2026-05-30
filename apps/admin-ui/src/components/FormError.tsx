import React from 'react';

/** Inline form validation / submit errors */
export const FormError: React.FC<{ message: string | null }> = ({ message }) => {
  if (!message) return null;
  return (
    <div
      className="rounded-lg border border-red-500/40 bg-red-950/50 px-3 py-2.5 text-sm text-red-100"
      role="alert"
    >
      {message}
    </div>
  );
};
