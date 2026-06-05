import React from 'react';

type PolicySectionProps = {
  title: string;
  description: React.ReactNode;
  emptyMessage?: string;
  isEmpty?: boolean;
  children: React.ReactNode;
};

/** Grouped policy block — theme-aware panel (no flat gray slab in light mode). */
export const PolicySection: React.FC<PolicySectionProps> = ({
  title,
  description,
  emptyMessage = 'No templates configured.',
  isEmpty = false,
  children,
}) => (
  <section className="hf-policy-section space-y-3">
    <div>
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      <p className="text-xs hf-muted">{description}</p>
    </div>
    {isEmpty ? <p className="text-sm hf-muted">{emptyMessage}</p> : children}
  </section>
);
