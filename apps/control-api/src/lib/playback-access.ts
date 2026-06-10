import type { Request } from 'express';
import type { DomainBlock, Output } from '@hydrofoil/shared-types';

import type { AppContext } from '../context';
import { HttpError, NotFoundError } from '../errors';
import { PlaybackTokenService } from '../services/playback-token';
import { config } from '../config';

const playbackTokenService = new PlaybackTokenService(config.playbackTokenSecret);

export function extractPlaybackToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }

  const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
  if (queryToken) {
    return queryToken;
  }

  const cookieHeader = req.headers.cookie ?? '';
  const cookieToken = cookieHeader
    .split(';')
    .map((part: string) => part.trim())
    .find((part: string) => part.startsWith('hydrofoil_playback_token='));

  return cookieToken ? decodeURIComponent(cookieToken.split('=')[1] ?? '') : null;
}

export function extractRequestDomain(req: Request): string | null {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const raw =
    typeof origin === 'string' && origin
      ? origin
      : typeof referer === 'string' && referer
        ? referer
        : '';

  if (!raw) return null;

  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function domainMatches(allowedDomains: string[], requestDomain: string | null): boolean {
  if (allowedDomains.length === 0) {
    return true;
  }
  if (!requestDomain) {
    return false;
  }

  const normalized = requestDomain.toLowerCase();
  return allowedDomains.some((domain) => {
    const expected = domain.trim().toLowerCase();
    if (expected.startsWith('*.')) {
      const suffix = expected.slice(2);
      return normalized === suffix || normalized.endsWith(`.${suffix}`);
    }
    return normalized === expected || normalized.endsWith(`.${expected}`);
  });
}

export function isDirectBrowserNavigation(req: Request): boolean {
  const fetchMode = req.headers['sec-fetch-mode'];
  const fetchDest = req.headers['sec-fetch-dest'];
  const accept = req.headers.accept ?? '';

  const mode = Array.isArray(fetchMode) ? fetchMode[0] : fetchMode;
  const dest = Array.isArray(fetchDest) ? fetchDest[0] : fetchDest;

  return (
    mode === 'navigate' ||
    dest === 'document' ||
    (typeof accept === 'string' && accept.includes('text/html'))
  );
}

export function policyNeedsToken(block: DomainBlock | undefined): boolean {
  if (!block) return false;
  return (
    block.playbackAccessPolicy === 'token-required' ||
    block.playbackAccessPolicy === 'restricted' ||
    Boolean(block.tokenRequired)
  );
}

export function usesProtectedPlayback(block: DomainBlock | undefined): boolean {
  if (!block) return false;
  return block.playbackAccessPolicy !== 'public';
}

function verifyPlaybackToken(
  token: string | null | undefined,
  organizationId: string,
  app: string,
  stream: string
): boolean {
  if (!token) return false;
  const payload = playbackTokenService.verifyToken(token);
  return Boolean(
    payload &&
      payload.organizationId === organizationId &&
      payload.app === app &&
      payload.stream === stream
  );
}

async function resolveEffectiveDomainBlock(
  ctx: AppContext,
  outputs: Output[]
): Promise<DomainBlock | undefined> {
  const domainBlocks = await ctx.repos.domainBlocks.listAll(ctx.organizationId);
  const domainBlockById = new Map(
    (domainBlocks as DomainBlock[]).map((block) => [block.id, block])
  );
  for (const output of outputs) {
    if (!output.domainBlockId) continue;
    const block = domainBlockById.get(output.domainBlockId);
    if (block) return block;
  }
  return undefined;
}

export async function resolvePlaybackOutputsForStream(
  ctx: AppContext,
  app: string,
  stream: string
): Promise<Output[]> {
  const outputs = (await ctx.repos.outputs.listAll(ctx.organizationId)) as Output[];
  return outputs.filter(
    (item) => item.enabled && item.gatewayAppName === app && item.gatewayStreamName === stream
  );
}

export async function resolveStreamPlaybackBlock(
  ctx: AppContext,
  app: string,
  stream: string
): Promise<DomainBlock | undefined> {
  const outputs = await resolvePlaybackOutputsForStream(ctx, app, stream);
  return resolveEffectiveDomainBlock(ctx, outputs);
}

export async function enforcePlaybackAccess(
  ctx: AppContext,
  app: string,
  stream: string,
  req: Request,
  options?: { allowDirectNavigation?: boolean }
): Promise<Output | null> {
  const outputs = await resolvePlaybackOutputsForStream(ctx, app, stream);
  const output = outputs[0] ?? null;
  const block = await resolveEffectiveDomainBlock(ctx, outputs);

  if (!block) {
    if (!output) {
      const input = await ctx.repos.inputs.findByAppAndStreamKey(ctx.organizationId, app, stream);
      if (!input?.enabled) {
        throw new NotFoundError('Playback target not found');
      }
    }
    return output;
  }

  const requestDomain = extractRequestDomain(req);
  const token = extractPlaybackToken(req);
  const allowedDomains = Array.isArray(block.allowedDomains) ? block.allowedDomains : [];
  const tokenValid = verifyPlaybackToken(token, ctx.organizationId, app, stream);

  if (block.playbackAccessPolicy === 'restricted') {
    if (tokenValid) {
      return output;
    }
    if (!domainMatches(allowedDomains, requestDomain)) {
      throw new HttpError(403, 'Playback blocked for this domain');
    }
    return output;
  }

  if (block.playbackAccessPolicy === 'token-required' || block.tokenRequired) {
    if (!token) {
      throw new HttpError(401, 'Playback token required');
    }
    if (!tokenValid) {
      throw new HttpError(403, 'Invalid playback token');
    }
    if (allowedDomains.length > 0 && !domainMatches(allowedDomains, requestDomain)) {
      throw new HttpError(403, 'Playback blocked for this domain');
    }
  }

  if (!output) {
    const input = await ctx.repos.inputs.findByAppAndStreamKey(ctx.organizationId, app, stream);
    if (!input?.enabled) {
      throw new NotFoundError('Playback target not found');
    }
  }

  if (!options?.allowDirectNavigation && usesProtectedPlayback(block) && isDirectBrowserNavigation(req)) {
    throw new HttpError(403, 'Direct browser navigation to protected media is disabled');
  }

  return output;
}

export function canServePublicEmbedManifest(
  organizationId: string,
  block: DomainBlock | undefined,
  req: Request,
  app: string,
  stream: string
): boolean {
  if (!block || block.playbackAccessPolicy === 'public') {
    return true;
  }

  const token = extractPlaybackToken(req);
  if (verifyPlaybackToken(token, organizationId, app, stream)) {
    return true;
  }

  if (block.playbackAccessPolicy === 'restricted') {
    const allowedDomains = Array.isArray(block.allowedDomains) ? block.allowedDomains : [];
    return domainMatches(allowedDomains, extractRequestDomain(req));
  }

  return false;
}

export function resolveEmbedManifestToken(
  organizationId: string,
  block: DomainBlock | undefined,
  req: Request,
  app: string,
  stream: string,
  options: { allowTokenIssue: boolean; expiresInSeconds: number }
): string | undefined {
  const needsToken = policyNeedsToken(block);
  if (!needsToken) {
    return undefined;
  }

  const requestToken = extractPlaybackToken(req);
  if (requestToken && verifyPlaybackToken(requestToken, organizationId, app, stream)) {
    return requestToken;
  }

  if (
    block?.playbackAccessPolicy === 'restricted' &&
    canServePublicEmbedManifest(organizationId, block, req, app, stream)
  ) {
    return undefined;
  }

  if (options.allowTokenIssue) {
    return playbackTokenService.issueToken({
      organizationId,
      app,
      stream,
      exp: Math.floor(Date.now() / 1000) + options.expiresInSeconds,
    });
  }

  return undefined;
}
