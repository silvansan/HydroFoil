import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface IconActionButtonProps {
  label: string;
  icon: LucideIcon;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  variant?: 'default' | 'danger' | 'record';
  iconFill?: string;
}

const variantClass: Record<NonNullable<IconActionButtonProps['variant']>, string> = {
  default: 'text-brand-400 hover:bg-brand-500/20 hover:text-brand-300',
  danger: 'text-red-400/90 hover:bg-red-950/50 hover:text-red-300',
  record: 'text-brand-400 hover:bg-brand-500/20 hover:text-red-400',
};

export const IconActionButton: React.FC<IconActionButtonProps> = ({
  label,
  icon: Icon,
  onClick,
  disabled = false,
  variant = 'default',
  iconFill,
}) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    disabled={disabled}
    onClick={(e) => {
      e.stopPropagation();
      e.preventDefault();
      onClick(e);
    }}
    className={`rounded-lg p-2 transition-colors disabled:opacity-40 ${variantClass[variant]}`}
  >
    <Icon size={17} fill={iconFill} />
  </button>
);
