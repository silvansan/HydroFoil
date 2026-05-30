import React from 'react';
import { useNavigate } from 'react-router-dom';

const rowClass =
  'border-b border-slate-800/50 hover:bg-brand-500/10 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50';

interface ClickableRowProps {
  to: string;
  children: React.ReactNode;
  className?: string;
  as?: 'tr' | 'li';
}

/** Table/list row that navigates to a resource settings page (actions column should stop propagation). */
export const ClickableRow: React.FC<ClickableRowProps> = ({
  to,
  children,
  className = '',
  as = 'tr',
}) => {
  const navigate = useNavigate();

  const go = () => navigate(to);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      go();
    }
  };

  if (as === 'li') {
    return (
      <li
        role="button"
        tabIndex={0}
        onClick={go}
        onKeyDown={onKeyDown}
        className={`${rowClass} ${className}`}
      >
        {children}
      </li>
    );
  }

  return (
    <tr role="button" tabIndex={0} onClick={go} onKeyDown={onKeyDown} className={`${rowClass} ${className}`}>
      {children}
    </tr>
  );
};

/** Wrap row action buttons so clicking them does not navigate. */
export const RowActionsCell: React.FC<{
  children: React.ReactNode;
  className?: string;
  as?: 'td' | 'div';
}> = ({ children, className = '', as = 'td' }) => {
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  if (as === 'div') {
    return (
      <div className={className} onClick={stop}>
        {children}
      </div>
    );
  }
  return (
    <td className={className} onClick={stop}>
      {children}
    </td>
  );
};
