import { describe, expect, it } from 'vitest';

import { mp4ObjectKeyFromFlvKey } from './remux-mp4';

describe('mp4ObjectKeyFromFlvKey', () => {
  it('replaces FLV extension with MP4', () => {
    expect(mp4ObjectKeyFromFlvKey('dvr/live/main.flv')).toBe('dvr/live/main.mp4');
  });

  it('appends MP4 when source key has no FLV extension', () => {
    expect(mp4ObjectKeyFromFlvKey('dvr/live/main')).toBe('dvr/live/main.mp4');
  });
});
