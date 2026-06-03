import React from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown } from 'lucide-react';

const CLOSE_DELAY_MS = 500;

export type CollapsibleNavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  prefixMatch?: boolean;
};

type CollapsibleNavSectionProps = {
  label: string;
  items: CollapsibleNavItem[];
  isActive: (path: string, prefixMatch?: boolean) => boolean;
};

const CollapsibleNavSection: React.FC<CollapsibleNavSectionProps> = ({ label, items, isActive }) => {
  const hasActiveRoute = items.some((item) => isActive(item.path, item.prefixMatch));
  const [expanded, setExpanded] = React.useState(hasActiveRoute);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOpen = expanded || hasActiveRoute;

  React.useEffect(() => {
    if (hasActiveRoute) {
      setExpanded(true);
    }
  }, [hasActiveRoute]);

  React.useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const openSection = () => {
    clearCloseTimer();
    setExpanded(true);
  };

  const scheduleClose = () => {
    if (hasActiveRoute) {
      return;
    }
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setExpanded(false);
      closeTimerRef.current = null;
    }, CLOSE_DELAY_MS);
  };

  const toggleExpanded = () => {
    clearCloseTimer();
    if (hasActiveRoute) {
      setExpanded(true);
      return;
    }
    setExpanded((current) => !current);
  };

  return (
    <div className="hf-nav-section" onMouseEnter={openSection} onMouseLeave={scheduleClose}>
      <button
        type="button"
        onClick={toggleExpanded}
        aria-expanded={isOpen}
        className={`hf-nav-section-trigger w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
          isOpen ? 'hf-nav-section-trigger-open' : 'hf-nav-section-trigger-idle'
        }`}
      >
        <span className="hf-nav-group-label text-[10px] font-semibold uppercase tracking-wider">
          {label}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 opacity-70 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      <div className={`hf-nav-section-panel ${isOpen ? 'hf-nav-section-panel-open' : ''}`}>
        <div className="hf-nav-section-panel-inner space-y-1 pt-1">
          {items.map(({ path, label: itemLabel, icon: Icon, prefixMatch }) => (
            <Link
              key={path}
              to={path}
              className={`hf-nav-link flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                isActive(path, prefixMatch)
                  ? 'hf-nav-link-active font-medium border'
                  : 'hf-nav-link-idle'
              }`}
            >
              <Icon size={18} />
              <span className="text-sm">{itemLabel}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CollapsibleNavSection;
