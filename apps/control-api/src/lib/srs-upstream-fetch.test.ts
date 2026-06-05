import { describe, expect, it } from 'vitest';

import { normalizeUpstreamMediaPath } from './srs-upstream-fetch';

describe('normalizeUpstreamMediaPath', () => {
  it('adds a leading slash for proxy-style paths', () => {
    expect(normalizeUpstreamMediaPath('gtch/fr-gi2uep.m3u8')).toBe('/gtch/fr-gi2uep.m3u8');
  });

  it('preserves query strings', () => {
    expect(normalizeUpstreamMediaPath('gtch/fr-gi2uep.m3u8?vhost=hydrofoil.silvans.ch')).toBe(
      '/gtch/fr-gi2uep.m3u8?vhost=hydrofoil.silvans.ch'
    );
  });

  it('leaves already-normalized paths unchanged', () => {
    expect(normalizeUpstreamMediaPath('/gtch/fr-gi2uep.m3u8')).toBe('/gtch/fr-gi2uep.m3u8');
  });
});
