/** Organization-unique privacy policy slug (URL-safe identifier). */
const POLICY_SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]{0,46}[a-z0-9])?$/;

export function slugifyPolicyName(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  if (slug && POLICY_SLUG_PATTERN.test(slug)) return slug;
  const trimmed = slug.replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  if (trimmed && POLICY_SLUG_PATTERN.test(trimmed)) return trimmed;
  return '';
}

export function normalizePolicySlug(slug: string): string {
  const fromInput = slugifyPolicyName(slug);
  if (fromInput) return fromInput;
  return `policy-${Math.random().toString(36).slice(2, 8)}`;
}

export function resolvePolicySlug(name: string, slugInput?: string): string {
  const trimmed = slugInput?.trim();
  if (trimmed) return normalizePolicySlug(trimmed);
  const fromName = slugifyPolicyName(name);
  return fromName || `policy-${Math.random().toString(36).slice(2, 8)}`;
}

export function ensureUniquePolicySlug(baseSlug: string, taken: ReadonlySet<string>): string {
  if (!taken.has(baseSlug)) return baseSlug;
  const maxBase = 40;
  const root = baseSlug.slice(0, maxBase).replace(/-$/, '');
  for (let n = 2; n < 10_000; n += 1) {
    const suffix = `-${n}`;
    const candidate = `${root.slice(0, Math.max(1, maxBase - suffix.length))}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${root}-${Date.now().toString(36).slice(-4)}`;
}

export function isValidPolicySlug(slug: string): boolean {
  return POLICY_SLUG_PATTERN.test(slug);
}
