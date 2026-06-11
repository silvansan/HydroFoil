import { describe, expect, it } from 'vitest';

import {
  canServePublicEmbedManifest,
  domainMatches,
  extractRequestDomain,
} from './playback-access';
import type { DomainBlock } from '@hydrofoil/shared-types';
import type { Request } from 'express';

function mockRequest(headers: Record<string, string> = {}): Request {
  return { headers, query: {} } as unknown as Request;
}

describe('domainMatches', () => {
  it('allows any domain when the allowlist is empty and emptyMeansAllow is true', () => {
    expect(domainMatches([], 'example.com')).toBe(true);
    expect(domainMatches([], null)).toBe(true);
  });

  it('denies when the allowlist is empty and emptyMeansAllow is false', () => {
    expect(domainMatches([], 'example.com', false)).toBe(false);
    expect(domainMatches([], null, false)).toBe(false);
  });

  it('matches exact and subdomain entries', () => {
    expect(domainMatches(['example.com'], 'example.com')).toBe(true);
    expect(domainMatches(['example.com'], 'player.example.com')).toBe(true);
    expect(domainMatches(['example.com'], 'other.com')).toBe(false);
  });

  it('supports wildcard subdomain patterns', () => {
    expect(domainMatches(['*.example.com'], 'player.example.com')).toBe(true);
    expect(domainMatches(['*.example.com'], 'example.com')).toBe(true);
    expect(domainMatches(['*.example.com'], 'other.com')).toBe(false);
  });
});

describe('extractRequestDomain', () => {
  it('falls back to referer when Origin is the opaque null sentinel', () => {
    expect(
      extractRequestDomain(
        mockRequest({
          origin: 'null',
          referer: 'https://hydrofoil.silvans.ch/embed?app=live&stream=main',
        })
      )
    ).toBe('hydrofoil.silvans.ch');
  });
});

describe('canServePublicEmbedManifest', () => {
  const organizationId = 'org-1';
  const app = 'live';
  const stream = 'main';

  it('denies restricted embeds when the allowlist is empty', () => {
    const block = {
      playbackAccessPolicy: 'restricted',
      allowedDomains: [],
    } as DomainBlock;

    expect(
      canServePublicEmbedManifest(organizationId, block, mockRequest({ origin: 'https://player.example.com' }), app, stream)
    ).toBe(false);
  });

  it('allows restricted embeds when the request domain matches the allowlist', () => {
    const block = {
      playbackAccessPolicy: 'restricted',
      allowedDomains: ['player.example.com'],
    } as DomainBlock;

    expect(
      canServePublicEmbedManifest(organizationId, block, mockRequest({ origin: 'https://player.example.com' }), app, stream)
    ).toBe(true);
  });

  it('allows restricted embeds when Origin is opaque null but referer matches the allowlist', () => {
    const block = {
      playbackAccessPolicy: 'restricted',
      allowedDomains: ['hydrofoil.silvans.ch'],
    } as DomainBlock;

    expect(
      canServePublicEmbedManifest(
        organizationId,
        block,
        mockRequest({
          origin: 'null',
          referer: 'https://hydrofoil.silvans.ch/embed?app=live&stream=main',
        }),
        app,
        stream
      )
    ).toBe(true);
  });
});
