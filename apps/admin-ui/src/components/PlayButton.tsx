import React from 'react';
import { Play } from 'lucide-react';

interface PlayButtonProps {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  className?: string;
}

export const PlayButton: React.FC<PlayButtonProps> = ({
  label,
  onClick,
  disabled = false,
  className = '',
}) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className={`rounded-lg p-2 text-brand-400 hover:bg-brand-500/20 hover:text-brand-300 disabled:opacity-40 ${className}`}
  >
    <Play size={17} fill="currentColor" />
  </button>
);
