import { describe, expect, it } from 'vitest';

import {
  isRootOnlyMediaUrl,
  mediaOriginFromUrl,
  resolveMediaOrigin,
  resolveMediaUrl,
} from './media-url';

describe('media-url helpers', () => {
  it('detects root-only URLs', () => {
    expect(isRootOnlyMediaUrl('')).toBe(true);
    expect(isRootOnlyMediaUrl('https://hydrofoil.silvans.ch/')).toBe(true);
    expect(isRootOnlyMediaUrl('https://hydrofoil.silvans.ch/srs-media/live/x.flv')).toBe(false);
  });

  it('extracts origin from absolute media URLs', () => {
    expect(mediaOriginFromUrl('https://hydrofoil.silvans.ch/srs-media/live/x.flv')).toBe(
      'https://hydrofoil.silvans.ch'
    );
  });

  it('resolves relative paths against a known origin', () => {
    expect(
      resolveMediaUrl('/srs-media/live/demo.flv', 'https://hydrofoil.silvans.ch')
    ).toBe('https://hydrofoil.silvans.ch/srs-media/live/demo.flv');
  });

  it('ignores opaque iframe origins when resolving media base', () => {
    expect(
      resolveMediaOrigin(['https://hydrofoil.silvans.ch/live.m3u8'], 'null')
    ).toBe('https://hydrofoil.silvans.ch');
    expect(resolveMediaOrigin([], 'null')).toBeUndefined();
  });
});
