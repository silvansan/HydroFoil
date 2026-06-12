import type { Request } from 'express';
import { describe, expect, it } from 'vitest';

import { absoluteUrl, appendTokenToPath } from './absolute-url';

function mockReq(overrides?: Partial<Request>): Request {
  return {
    protocol: 'http',
    get: (name: string) => (name === 'host' ? 'localhost:3000' : undefined),
    headers: {},
    ...overrides,
  } as Request;
}

describe('absoluteUrl', () => {
  it('returns empty string for blank paths instead of site root', () => {
    expect(absoluteUrl(mockReq(), '')).toBe('');
    expect(absoluteUrl(mockReq(), '   ')).toBe('');
  });

  it('builds absolute URLs from relative media paths', () => {
    expect(absoluteUrl(mockReq(), '/srs-media/live/demo.flv')).toBe(
      'http://localhost:3000/srs-media/live/demo.flv'
    );
  });

  it('passes through already-absolute URLs', () => {
    expect(absoluteUrl(mockReq(), 'https://cdn.example/live.flv')).toBe(
      'https://cdn.example/live.flv'
    );
  });
});

describe('appendTokenToPath', () => {
  it('appends token query params', () => {
    expect(appendTokenToPath('/api/playback/live/live/demo.flv', 'abc')).toBe(
      '/api/playback/live/live/demo.flv?token=abc'
    );
  });
});
