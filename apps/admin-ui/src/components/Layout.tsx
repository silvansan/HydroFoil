import React from 'react';
import { Link, useLocation } from 'react-router-dom';
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
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

type ThemeMode = 'light' | 'dark';

const APP_VERSION = '0.1.0';
const LICENSE_LABEL = import.meta.env.VITE_LICENSE_LABEL ?? 'AGPL-3.0';
const REPOSITORY_URL =
  import.meta.env.VITE_REPOSITORY_URL ?? 'https://github.com/silvansan/HydroFoil';

function initialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  const saved = window.localStorage.getItem('hydrofoil-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const [theme, setTheme] = React.useState<ThemeMode>(initialTheme);
  const isActive = (path: string) =>
    path === '/restreaming'
      ? location.pathname === '/restreaming'
      : location.pathname === path;

  React.useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('hydrofoil-theme', theme);
  }, [theme]);

  const navItems = [
    { path: '/inputs', label: 'Inputs', icon: Radio },
    { path: '/restreaming', label: 'Restreaming', icon: Share2 },
    { path: '/domain-blocks', label: 'Domain Blocks', icon: Lock },
    { path: '/recordings', label: 'Recordings', icon: HardDrive },
    { path: '/live-sessions', label: 'Live Sessions', icon: Zap },
    { path: '/storage', label: 'Storage', icon: List },
    { path: '/recording-policies', label: 'Recording Policies', icon: FileVideo },
    { path: '/stream-profiles', label: 'Stream Profiles', icon: Sliders },
    { path: '/audio-feed-profiles', label: 'Audio Feeds', icon: Headphones },
    { path: '/system-status', label: 'System Status', icon: BarChart3 },
  ];

  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'));

  return (
    <div className="hf-app-shell flex h-screen">
      <aside className="hf-sidebar w-64 flex flex-col border-r shadow-xl">
        <div className="hf-sidebar-logo px-4 py-6 border-b">
          <Link to="/inputs" className="block" aria-label="HydroFoil home">
            <img
              src="/hydrofoil-logo.png"
              alt="HydroFoil"
              className="w-full max-w-[220px] h-auto object-contain mx-auto"
            />
          </Link>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={`hf-nav-link flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                isActive(path)
                  ? 'hf-nav-link-active font-medium border'
                  : 'hf-nav-link-idle'
              }`}
            >
              <Icon size={18} />
              <span className="text-sm">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="hf-sidebar-meta px-4 py-4 border-t text-xs">
          <p>v{APP_VERSION} · dev</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="hf-header h-14 shrink-0 border-b backdrop-blur-md flex items-center justify-between px-8">
          <p className="text-sm hf-muted">
            Operator console ·{' '}
            <span className="hf-strong font-medium">Live routing & assets</span>
          </p>
          <button
            type="button"
            onClick={toggleTheme}
            className="hf-theme-toggle inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
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
              <button
                type="button"
                onClick={toggleTheme}
                className="hf-footer-theme inline-flex items-center gap-1 rounded-full border px-2.5 py-1 transition"
              >
                {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Layout;
