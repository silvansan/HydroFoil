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
  default:
    'text-[var(--hf-brand-500)] hover:bg-[color-mix(in_srgb,var(--hf-brand-500)_14%,transparent)] hover:text-[var(--hf-brand-500)]',
  danger: 'text-red-400/90 hover:bg-red-950/50 hover:text-red-300',
  record:
    'text-[var(--hf-brand-500)] hover:bg-[color-mix(in_srgb,var(--hf-brand-500)_14%,transparent)] hover:text-red-400',
};

export const IconActionButton: React.FC<IconActionButtonProps> = ({
  label,
  icon: Icon,
  onClick,
  disabled = false,
  variant = 'default',
  iconFill = 'none',
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
    <Icon size={17} strokeWidth={2} fill={iconFill} />
  </button>
);
