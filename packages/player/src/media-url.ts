/** True when a URL points at a site root with no media resource path. */
export function isRootOnlyMediaUrl(url: string | undefined | null): boolean {
  if (!url?.trim()) return true;
  const trimmed = url.trim();
  if (trimmed === '/') return true;
  try {
    const parsed = new URL(trimmed, 'http://local.invalid');
    return parsed.pathname === '/' && !parsed.search && !parsed.hash;
  } catch {
    return true;
  }
}

/** Origin from an absolute media URL, or undefined when unavailable. */
export function mediaOriginFromUrl(url: string | undefined | null): string | undefined {
  if (!url?.trim() || !/^https?:\/\//i.test(url)) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

/** Best origin for resolving relative media paths in embed/sandbox contexts. */
export function resolveMediaOrigin(
  sampleUrls: Array<string | undefined | null>,
  windowOrigin?: string
): string | undefined {
  for (const sample of sampleUrls) {
    const origin = mediaOriginFromUrl(sample ?? undefined);
    if (origin) return origin;
  }
  if (windowOrigin && windowOrigin !== 'null') return windowOrigin;
  return undefined;
}

/** Normalize a playback URL to an absolute, fetchable media URL. */
export function resolveMediaUrl(
  url: string | undefined | null,
  baseOrigin?: string
): string | undefined {
  if (!url?.trim()) return undefined;
  const trimmed = url.trim();
  if (isRootOnlyMediaUrl(trimmed)) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const base = baseOrigin && baseOrigin !== 'null' ? baseOrigin.replace(/\/$/, '') : undefined;
  if (!base) return undefined;
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${base}${path}`;
}
