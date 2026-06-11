import { describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';

import type { AppContext } from '../context';
import { PlaybackTokenService } from '../services/playback-token';
import {
  canServePublicEmbedManifest,
  domainMatches,
  extractRequestDomain,
  issueRotatedPlaybackToken,
  resolveEmbedManifestToken,
  tokenGenerationIsValid,
} from './playback-access';
import type { DomainBlock } from '@hydrofoil/shared-types';

const playbackTokenService = new PlaybackTokenService('hydrofoil-dev-playback-secret');

function mockRequest(headers: Record<string, string> = {}, query: Record<string, string> = {}): Request {
  return { headers, query } as unknown as Request;
}

function mockCtx(overrides: {
  generation?: number;
  incrementResult?: number;
  inputId?: string | null;
} = {}): AppContext {
  const inputId = overrides.inputId === undefined ? 'input-1' : overrides.inputId;
  const generation = overrides.generation ?? 0;
  const incrementResult = overrides.incrementResult ?? generation + 1;

  return {
    organizationId: 'org-1',
    repos: {
      inputs: {
        findByAppAndStreamKey: vi.fn(async () =>
          inputId ? { id: inputId, enabled: true } : null
        ),
        getPlaybackTokenGeneration: vi.fn(async () => generation),
        incrementPlaybackTokenGeneration: vi.fn(async () => incrementResult),
      },
      outputs: {
        listAll: vi.fn(async () => []),
      },
      routes: {
        findInputIdByOutputId: vi.fn(async () => null),
      },
    },
  } as unknown as AppContext;
}

function issueToken(app: string, stream: string, gen?: number) {
  return playbackTokenService.issueToken({
    organizationId: 'org-1',
    app,
    stream,
    exp: Math.floor(Date.now() / 1000) + 3600,
    gen,
  });
}

describe('tokenGenerationIsValid', () => {
  it('accepts matching and newer generations', () => {
    expect(tokenGenerationIsValid(0, 0)).toBe(true);
    expect(tokenGenerationIsValid(1, 1)).toBe(true);
    expect(tokenGenerationIsValid(2, 1)).toBe(true);
  });

  it('rejects stale generations', () => {
    expect(tokenGenerationIsValid(0, 1)).toBe(false);
    expect(tokenGenerationIsValid(1, 2)).toBe(false);
  });
});

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

  it('denies restricted embeds when the allowlist is empty', async () => {
    const block = {
      playbackAccessPolicy: 'restricted',
      allowedDomains: [],
    } as DomainBlock;

    expect(
      await canServePublicEmbedManifest(
        mockCtx(),
        organizationId,
        block,
        mockRequest({ origin: 'https://player.example.com' }),
        app,
        stream
      )
    ).toBe(false);
  });

  it('allows restricted embeds when the request domain matches the allowlist', async () => {
    const block = {
      playbackAccessPolicy: 'restricted',
      allowedDomains: ['player.example.com'],
    } as DomainBlock;

    expect(
      await canServePublicEmbedManifest(
        mockCtx(),
        organizationId,
        block,
        mockRequest({ origin: 'https://player.example.com' }),
        app,
        stream
      )
    ).toBe(true);
  });

  it('allows restricted embeds when Origin is opaque null but referer matches the allowlist', async () => {
    const block = {
      playbackAccessPolicy: 'restricted',
      allowedDomains: ['hydrofoil.silvans.ch'],
    } as DomainBlock;

    expect(
      await canServePublicEmbedManifest(
        mockCtx(),
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

  it('rejects rotated-out playback tokens for token-required streams', async () => {
    const block = {
      playbackAccessPolicy: 'token-required',
      allowedDomains: [],
    } as DomainBlock;
    const staleToken = issueToken(app, stream);

    expect(
      await canServePublicEmbedManifest(
        mockCtx({ generation: 1 }),
        organizationId,
        block,
        mockRequest({}, { token: staleToken }),
        app,
        stream
      )
    ).toBe(false);
  });
});

describe('playback token rotation', () => {
  const organizationId = 'org-1';
  const app = 'live';
  const stream = 'main';
  const block = {
    playbackAccessPolicy: 'token-required',
    allowedDomains: [],
  } as DomainBlock;

  it('increments generation and embeds gen when issuing a new token', async () => {
    const ctx = mockCtx({ generation: 0, incrementResult: 1 });

    const token = await issueRotatedPlaybackToken(ctx, {
      organizationId,
      app,
      stream,
      expiresInSeconds: 3600,
      inputId: 'input-1',
    });

    expect(ctx.repos.inputs.incrementPlaybackTokenGeneration).toHaveBeenCalledWith(
      organizationId,
      'input-1'
    );
    expect(playbackTokenService.verifyToken(token)?.gen).toBe(1);
  });

  it('reuses a still-valid request token for public embed manifests', async () => {
    const ctx = mockCtx({ generation: 1 });
    const currentToken = issueToken(app, stream, 1);

    const token = await resolveEmbedManifestToken(
      ctx,
      organizationId,
      block,
      mockRequest({}, { token: currentToken }),
      app,
      stream,
      {
        allowTokenIssue: false,
        expiresInSeconds: 3600,
        inputId: 'input-1',
        queryTokenOnly: true,
      }
    );

    expect(token).toBe(currentToken);
    expect(ctx.repos.inputs.incrementPlaybackTokenGeneration).not.toHaveBeenCalled();
  });

  it('always rotates when operator requests a fresh signed link', async () => {
    const ctx = mockCtx({ generation: 1, incrementResult: 2 });
    const currentToken = issueToken(app, stream, 1);

    const token = await resolveEmbedManifestToken(
      ctx,
      organizationId,
      block,
      mockRequest({}, { token: currentToken }),
      app,
      stream,
      {
        allowTokenIssue: true,
        expiresInSeconds: 3600,
        inputId: 'input-1',
        queryTokenOnly: true,
      }
    );

    expect(ctx.repos.inputs.incrementPlaybackTokenGeneration).toHaveBeenCalled();
    expect(token).not.toBe(currentToken);
    expect(playbackTokenService.verifyToken(token!)?.gen).toBe(2);
  });
});
