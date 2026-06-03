import type { DomainBlock } from '../api/types';

export type PlaybackAccessPolicy = DomainBlock['playbackAccessPolicy'];

export const PLAYBACK_ACCESS_OPTIONS: Array<{
  value: PlaybackAccessPolicy;
  title: string;
  description: string;
  browserNote: string;
  shortLabel: string;
}> = [
  {
    value: 'public',
    title: 'Open to everyone',
    shortLabel: 'Public',
    description: 'No domain or token checks. Fine for public events and open embeds.',
    browserNote: 'Viewers can open playback URLs directly in the browser.',
  },
  {
    value: 'token-required',
    title: 'Signed playback links',
    shortLabel: 'Signed links',
    description: 'Requires a short-lived token in the URL. Good for partners without listing every domain.',
    browserNote: 'Playback goes through the protected player; raw media URLs are blocked.',
  },
  {
    value: 'restricted',
    title: 'Only listed websites',
    shortLabel: 'Domain allowlist',
    description: 'Embed and playback only work on domains you allow (e.g. yoursite.com, *.partner.org).',
    browserNote: 'Protected player only; direct media links are blocked.',
  },
];

export function describePlaybackAccess(policy: PlaybackAccessPolicy): string {
  return PLAYBACK_ACCESS_OPTIONS.find((o) => o.value === policy)?.title ?? policy;
}

export function accessBadgeTone(
  policy: PlaybackAccessPolicy
): 'neutral' | 'brand' | 'amber' {
  if (policy === 'public') return 'neutral';
  if (policy === 'token-required') return 'brand';
  return 'amber';
}

export function slugifyPolicyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export function ensureUniquePolicySlug(baseSlug: string, taken: ReadonlySet<string>): string {
  if (!baseSlug) return baseSlug;
  if (!taken.has(baseSlug)) return baseSlug;
  const root = baseSlug.slice(0, 40).replace(/-$/, '');
  for (let n = 2; n < 10_000; n += 1) {
    const suffix = `-${n}`;
    const candidate = `${root.slice(0, Math.max(1, 40 - suffix.length))}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${root}-${Date.now().toString(36).slice(-4)}`;
}

export function previewPolicySlug(name: string, existingSlugs: string[]): string {
  const base = slugifyPolicyName(name);
  if (!base) return '';
  return ensureUniquePolicySlug(base, new Set(existingSlugs));
}

export type PrivacyAccessFilter = 'all' | PlaybackAccessPolicy;

export function privacyAccessCounts(items: DomainBlock[]) {
  return {
    all: items.length,
    public: items.filter((b) => b.playbackAccessPolicy === 'public').length,
    'token-required': items.filter((b) => b.playbackAccessPolicy === 'token-required').length,
    restricted: items.filter((b) => b.playbackAccessPolicy === 'restricted').length,
  };
}

export function filterPrivacyPolicies(
  items: DomainBlock[],
  options: { search?: string; access?: PrivacyAccessFilter }
): DomainBlock[] {
  const q = options.search?.trim().toLowerCase() ?? '';
  return items.filter((block) => {
    if (options.access && options.access !== 'all' && block.playbackAccessPolicy !== options.access) {
      return false;
    }
    if (!q) return true;
    const haystack = [block.name, block.slug, block.playbackAccessPolicy, ...(block.allowedDomains ?? [])]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function parseAllowedDomains(raw: string): string[] {
  const seen = new Set<string>();
  const domains: string[] = [];
  for (const part of raw.split(/[\n,]+/)) {
    const domain = part.trim().toLowerCase();
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);
    domains.push(domain);
  }
  return domains;
}

const DOMAIN_PATTERN =
  /^(\*\.)?([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export function validateAllowedDomains(raw: string): string | null {
  const domains = parseAllowedDomains(raw);
  if (domains.length === 0) {
    return 'Add at least one website when using a domain allowlist.';
  }
  for (const domain of domains) {
    const normalized = domain.startsWith('*.') ? domain.slice(2) : domain;
    if (!DOMAIN_PATTERN.test(normalized)) {
      return `"${domain}" does not look like a valid domain. Example: yoursite.com or *.partner.org`;
    }
  }
  return null;
}

export function formatDomainsPreview(domains: string[], max = 3): string {
  if (domains.length === 0) return 'No domains listed';
  if (domains.length <= max) return domains.join(', ');
  return `${domains.slice(0, max).join(', ')} +${domains.length - max} more`;
}

export function policyFormErrors(values: {
  name: string;
  playbackAccessPolicy: PlaybackAccessPolicy;
  allowedDomains: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.name.trim()) {
    errors.name = 'Give this policy a display name.';
  }
  if (values.playbackAccessPolicy === 'restricted') {
    const domainError = validateAllowedDomains(values.allowedDomains);
    if (domainError) errors.allowedDomains = domainError;
  }
  return errors;
}
