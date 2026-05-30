import React from 'react';

export const Alert: React.FC<{
  variant?: 'error' | 'info';
  children: React.ReactNode;
}> = ({
  variant = 'error',
  children,
}) => (
  <div
    className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
      variant === 'error'
        ? 'border-red-500/40 bg-red-950/40 text-red-200'
        : 'border-brand-500/30 bg-brand-950/30 text-brand-200'
    }`}
  >
    {children}
  </div>
);
