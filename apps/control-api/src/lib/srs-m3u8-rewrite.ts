/** Rewrite absolute SRS playlist paths so segment requests stay under /srs-media. */
export function rewriteM3u8PlaylistForProxy(body: string, prefix = '/srs-media'): string {
  const base = prefix.replace(/\/$/, '');
  return body
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return line;
      if (trimmed.startsWith(`${base}/`)) return line;
      if (trimmed.startsWith('/')) return `${base}${trimmed}`;
      return line;
    })
    .join('\n');
}
