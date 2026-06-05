import React from 'react';
import { Check } from 'lucide-react';

type SelectablePolicyCardProps = {
  selected: boolean;
  onToggle: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
};

/** Clickable policy/template row — card style with teal selected state (no native checkbox). */
export const SelectablePolicyCard: React.FC<SelectablePolicyCardProps> = ({
  selected,
  onToggle,
  title,
  description,
  children,
}) => (
  <button
    type="button"
    onClick={onToggle}
    aria-pressed={selected}
    className={`hf-selectable-card w-full text-left ${selected ? 'hf-selectable-card-selected' : ''}`}
  >
    <div className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
          selected
            ? 'border-[var(--hf-brand-500)] bg-[var(--hf-brand-500)] text-white'
            : 'border-[color-mix(in_srgb,var(--hf-border)_80%,transparent)] bg-transparent'
        }`}
        aria-hidden
      >
        {selected ? <Check size={12} strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-sm font-medium text-slate-200">{title}</span>
        {description ? <span className="mt-0.5 block text-xs hf-muted">{description}</span> : null}
        {children}
      </span>
    </div>
  </button>
);
