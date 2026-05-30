export function slugifyAppName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 63);
  if (!slug) return `app-${Math.random().toString(36).slice(2, 8)}`;
  return slug;
}
