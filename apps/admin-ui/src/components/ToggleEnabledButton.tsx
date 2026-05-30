import React from 'react';
import { Power, PowerOff } from 'lucide-react';

interface ToggleEnabledButtonProps {
  enabled: boolean;
  name: string;
  onToggle: () => Promise<void>;
  className?: string;
}

export const ToggleEnabledButton: React.FC<ToggleEnabledButtonProps> = ({
  enabled,
  name,
  onToggle,
  className = '',
}) => {
  const [busy, setBusy] = React.useState(false);
  const label = enabled ? `Disable ${name}` : `Enable ${name}`;
  const Icon = enabled ? PowerOff : Power;

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await onToggle();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={busy}
      onClick={handleClick}
      className={`rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-brand-300 disabled:opacity-40 ${className}`}
    >
      <Icon size={16} />
    </button>
  );
};
