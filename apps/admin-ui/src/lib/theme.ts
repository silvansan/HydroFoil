export type ThemeMode = 'light' | 'dark';

export function initialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  const saved = window.localStorage.getItem('hydrofoil-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(theme: ThemeMode): void {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem('hydrofoil-theme', theme);
}
