import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Github,
  Radio,
  Zap,
  Share2,
  Lock,
  HardDrive,
  List,
  FileVideo,
  Sliders,
  Headphones,
  BarChart3,
  Moon,
  Scale,
  Sun,
  Users,
  UserCircle,
  LogOut,
  Film,
  ChevronDown,
} from 'lucide-react';
import {
  canManageRecordingPolicyDefinitions,
  canManageUsers,
  canSeeDomainBlocksNav,
  canSeeStorageNav,
  canSeeVodNav,
  useAuth,
} from '../auth/AuthContext';
import CollapsibleNavSection from './CollapsibleNavSection';

interface LayoutProps {
  children: React.ReactNode;
}

type ThemeMode = 'light' | 'dark';

type NavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  prefixMatch?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const APP_VERSION = '0.1.0';
const LICENSE_LABEL = import.meta.env.VITE_LICENSE_LABEL ?? 'AGPL-3.0';
const REPOSITORY_URL =
  import.meta.env.VITE_REPOSITORY_URL ?? 'https://github.com/silvansan/HydroFoil';

const ROLE_LABELS: Record<string, string> = {
  'super-admin': 'Super Admin',
  admin: 'Admin',
  manager: 'Moderator',
};

function initialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  const saved = window.localStorage.getItem('hydrofoil-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Live',
    items: [
      { path: '/inputs', label: 'Inputs', icon: Radio },
      { path: '/live-sessions', label: 'Live Sessions', icon: Zap, prefixMatch: true },
      { path: '/restreaming', label: 'Restreaming', icon: Share2 },
    ],
  },
  {
    label: 'Publish',
    items: [
      { path: '/domain-blocks', label: 'Privacy Policies', icon: Lock, prefixMatch: true },
      { path: '/vod-routes', label: 'VOD Routes', icon: Film, prefixMatch: true },
    ],
  },
  {
    label: 'REC',
    items: [
      { path: '/storage', label: 'Storage', icon: List, prefixMatch: true },
      { path: '/recordings', label: 'Recordings', icon: HardDrive, prefixMatch: true },
      { path: '/recording-policies', label: 'Recording Policies', icon: FileVideo, prefixMatch: true },
      { path: '/stream-profiles', label: 'Stream Profiles', icon: Sliders },
      { path: '/audio-feed-profiles', label: 'Audio Feeds', icon: Headphones },
    ],
  },
];

const DASHBOARD_NAV: NavItem = {
  path: '/system-status',
  label: 'Dashboard',
  icon: BarChart3,
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { user, access, logout } = useAuth();
  const [theme, setTheme] = React.useState<ThemeMode>(initialTheme);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  const isActive = (path: string, prefixMatch?: boolean) => {
    if (prefixMatch) {
      return location.pathname === path || location.pathname.startsWith(`${path}/`);
    }
    return location.pathname === path;
  };

  React.useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('hydrofoil-theme', theme);
  }, [theme]);

  React.useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  const showUsersNav = canManageUsers(user?.role);

  const adminNavItems: NavItem[] = showUsersNav
    ? [{ path: '/users', label: 'Users', icon: Users, prefixMatch: true }]
    : [];

  const navGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.path === '/vod-routes') return canSeeVodNav(user?.role, access);
      if (item.path === '/domain-blocks') return canSeeDomainBlocksNav(user?.role, access);
      if (item.path === '/storage') return canSeeStorageNav(user?.role, access);
      if (item.path === '/recording-policies') {
        return canManageRecordingPolicyDefinitions(user?.role, access);
      }
      return true;
    }),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="hf-app-shell flex h-screen">
      <aside className="hf-sidebar w-64 flex flex-col border-r shadow-xl">
        <div className="hf-sidebar-logo px-4 py-6 border-b">
          <Link to="/system-status" className="block" aria-label="HydroFoil home">
            <img
              src="/hydrofoil-logo.png"
              alt="HydroFoil"
              className="w-full max-w-[220px] h-auto object-contain mx-auto"
            />
          </Link>
        </div>

        <nav className="flex-1 px-3 py-5 overflow-y-auto space-y-2">
          <Link
            to={DASHBOARD_NAV.path}
            className={`hf-nav-link flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all mb-3 ${
              isActive(DASHBOARD_NAV.path)
                ? 'hf-nav-link-active font-medium border'
                : 'hf-nav-link-idle'
            }`}
          >
            <DASHBOARD_NAV.icon size={18} />
            <span className="text-sm">{DASHBOARD_NAV.label}</span>
          </Link>

          {navGroups.map((group) => (
            <CollapsibleNavSection
              key={group.label}
              label={group.label}
              items={group.items}
              isActive={isActive}
            />
          ))}

          {adminNavItems.length > 0 && (
            <CollapsibleNavSection label="Admin" items={adminNavItems} isActive={isActive} />
          )}
        </nav>

        <div className="hf-sidebar-meta px-4 py-4 border-t text-xs">
          <p>v{APP_VERSION} · dev</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="hf-header h-14 shrink-0 border-b backdrop-blur-md flex items-center justify-between px-8 gap-4">
          <p className="text-sm hf-muted truncate">
            Operator console ·{' '}
            <span className="hf-strong font-medium">Live routing & assets</span>
          </p>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="hf-theme-toggle inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>

            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((open) => !open)}
                className="hf-theme-toggle inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition max-w-[220px]"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                <UserCircle size={14} className="shrink-0" />
                <span className="truncate">{user?.displayName || user?.email || 'Account'}</span>
                <ChevronDown size={14} className="shrink-0 opacity-70" />
              </button>

              {userMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-2 min-w-[200px] rounded-lg border py-1 shadow-lg z-50"
                  style={{
                    borderColor: 'color-mix(in srgb, var(--hf-border) 80%, transparent)',
                    backgroundColor: 'color-mix(in srgb, var(--hf-panel) 95%, transparent)',
                  }}
                >
                  <div className="px-3 py-2 border-b text-xs" style={{ borderColor: 'var(--hf-border)' }}>
                    <p className="hf-strong font-medium truncate">{user?.email}</p>
                    <p className="hf-muted mt-0.5">
                      {user ? (ROLE_LABELS[user.role] ?? user.role) : ''}
                    </p>
                  </div>
                  <Link
                    to="/profile"
                    role="menuitem"
                    className="flex items-center gap-2 px-3 py-2 text-sm hf-nav-link-idle hover:bg-slate-800/40"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <UserCircle size={16} />
                    My profile
                  </Link>
                  {showUsersNav && (
                    <Link
                      to="/users"
                      role="menuitem"
                      className="flex items-center gap-2 px-3 py-2 text-sm hf-nav-link-idle hover:bg-slate-800/40"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Users size={16} />
                      Users
                    </Link>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hf-nav-link-idle hover:bg-slate-800/40"
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                    }}
                  >
                    <LogOut size={16} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
        </main>

        <footer className="hf-footer shrink-0 border-t px-8 py-3">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-medium">HydroFoil</span>
              <span>v{APP_VERSION}</span>
              <span className="inline-flex items-center gap-1">
                <Scale size={14} />
                License: {LICENSE_LABEL}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {REPOSITORY_URL ? (
                <a
                  href={REPOSITORY_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  <Github size={14} />
                  Git repository
                </a>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Github size={14} />
                  Local repo
                </span>
              )}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Layout;
