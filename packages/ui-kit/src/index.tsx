// Shared UI components for HydroFoil

import React from 'react';

/**
 * Core UI components
 */

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ className = '', ...props }) => (
  <div
    className={`rounded-xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-sm shadow-lg ${className}`}
    {...props}
  />
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  icon: Icon,
  ...props
}) => {
  const baseClasses = 'font-medium rounded-lg transition-colors';
  const variants = {
    primary:
      'bg-gradient-to-r from-brand-600 to-brand-500 text-white hover:from-brand-500 hover:to-brand-400 shadow-md shadow-brand-900/30',
    secondary:
      'hf-btn-secondary bg-slate-700/80 text-slate-200 hover:bg-slate-600 border border-slate-600',
    danger: 'bg-red-600/90 text-white hover:bg-red-500',
  };
  const sizes = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {Icon ? <Icon className="mr-2 inline-block h-4 w-4" /> : null}
      {props.children}
    </button>
  );
};

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const TextInput: React.FC<TextInputProps> = ({ label, error, className = '', ...props }) => (
  <div className="flex flex-col gap-2">
    {label && <label className="text-sm font-medium text-slate-300">{label}</label>}
    <input
      className={`rounded-lg border ${error ? 'border-red-500' : 'border-slate-600'} bg-slate-900/50 px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 ${className}`}
      {...props}
    />
    {error && <span className="text-sm text-red-600">{error}</span>}
  </div>
);

export interface TableProps<T> {
  columns: { key: keyof T; label: string; width?: string }[];
  data: T[];
  keyExtractor?: (item: T, index: number) => string;
}

export const Table = React.forwardRef<HTMLTableElement, TableProps<any>>(
  ({ columns, data, keyExtractor }, ref) => (
    <table ref={ref} className="w-full border-collapse">
      <thead>
        <tr className="border-b border-slate-700/50 bg-slate-800/40">
          {columns.map((col) => (
            <th
              key={String(col.key)}
              className="px-4 py-3 text-left text-sm font-medium text-slate-400"
              style={{ width: col.width }}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, index) => (
          <tr key={keyExtractor ? keyExtractor(row, index) : index} className="border-b border-slate-800/50 hover:bg-white/5">
            {columns.map((col) => (
              <td key={String(col.key)} className="px-4 py-3 text-sm text-slate-200">
                {String(row[col.key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
);

Table.displayName = 'Table';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <Card className="max-w-lg w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>
      </Card>
    </div>
  );
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error';
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', className = '', ...props }) => {
  const variants = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
  };

  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${variants[variant]} ${className}`} {...props} />;
};

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, action }) => (
  <div className="flex justify-between items-start mb-6">
    <div>
      <h1 className="text-3xl font-bold text-slate-100">{title}</h1>
      {description && <p className="text-slate-400 mt-1">{description}</p>}
    </div>
    {action && <div>{action}</div>}
  </div>
);
