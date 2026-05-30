/** SRS-compatible application slug (RTMP app segment). */
const APP_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$|^[a-z0-9]$/;

export function slugifyAppName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 63);
  if (!slug) return `app-${Math.random().toString(36).slice(2, 8)}`;
  if (APP_NAME_PATTERN.test(slug)) return slug;
  return slug.replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 63) || 'app';
}

export function isValidAppName(appName: string): boolean {
  return APP_NAME_PATTERN.test(appName);
}
