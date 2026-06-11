import { describe, expect, it } from 'vitest';

import { resolveLocationObjectKey } from './storage-object-keys';

describe('resolveLocationObjectKey', () => {
  it('prepends the location prefix for relative paths', () => {
    expect(resolveLocationObjectKey({ prefixPath: 'media' }, 'vod/demo.mp4')).toBe('media/vod/demo.mp4');
  });

  it('does not double-prefix when the key already includes the location root', () => {
    expect(resolveLocationObjectKey({ prefixPath: 'media' }, 'media/vod/demo.mp4')).toBe(
      'media/vod/demo.mp4'
    );
  });

  it('returns the key unchanged when the location has no prefix', () => {
    expect(resolveLocationObjectKey({ prefixPath: '' }, 'vod/demo.mp4')).toBe('vod/demo.mp4');
  });
});
