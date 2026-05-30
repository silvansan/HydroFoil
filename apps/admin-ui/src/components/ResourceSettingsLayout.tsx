import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@hydrofoil/ui-kit';

interface ResourceSettingsLayoutProps {
  backTo: string;
  backLabel: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export const ResourceSettingsLayout: React.FC<ResourceSettingsLayoutProps> = ({
  backTo,
  backLabel,
  title,
  description,
  action,
  children,
}) => (
  <div className="space-y-6">
    <Link
      to={backTo}
      className="inline-flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300"
    >
      <ArrowLeft size={16} />
      {backLabel}
    </Link>
    <PageHeader title={title} description={description} action={action} />
    {children}
  </div>
);
