import type { Request } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import type { DomainBlock, Output } from '@hydrofoil/shared-types';

import type { AppContext } from '../context';
import { config } from '../config';
import { BadRequestError, HttpError, NotFoundError } from '../errors';
import { asyncHandler } from '../middleware/async-handler';
import { proxySrsMediaToResponse } from '../lib/proxy-srs-media';
import { PlaybackTokenService } from '../services/playback-token';
import { resolveLivePlayback } from '../services/playback-resolver';
import { buildPlaybackShareByIngest } from '../services/input-playback-share';

const issuePlaybackTokenSchema = z.object({
  app: z.string().min(1),
  stream: z.string().min(1),
  expiresInSeconds: z.number().int().positive().max(86400).optional(),
});

const playbackTokenService = new PlaybackTokenService(config.playbackTokenSecret);

function appendTokenToPath(path: string, token?: string): string {
  if (!token) return path;
  const [base, search = ''] = path.split('?');
  const params = new URLSearchParams(search);
  params.set('token', token);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

function rewritePlaylist(body: string, app: string, token?: string): string {
  return body
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return line;

      let nextPath = trimmed;
      if (nextPath.startsWith(`/${app}/`)) {
        nextPath = nextPath.slice(app.length + 2);
      } else if (nextPath.startsWith('/')) {
        nextPath = nextPath.slice(1);
      }

      return appendTokenToPath(`/api/playback/live/${app}/${nextPath}`, token);
    })
    .join('\n');
}

function extractPlaybackToken(req: Request): string | null {
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

function extractRequestDomain(req: Request): string | null {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const raw = typeof origin === 'string' && origin
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

function domainMatches(allowedDomains: string[], requestDomain: string | null): boolean {
  if (allowedDomains.length === 0) {
    return true;
  }
  if (!requestDomain) {
    return false;
  }

  const normalized = requestDomain.toLowerCase();
  return allowedDomains.some((domain) => {
    const expected = domain.trim().toLowerCase();
    return normalized === expected || normalized.endsWith(`.${expected}`);
  });
}

function isDirectBrowserNavigation(req: Request): boolean {
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

async function findPlaybackOutput(ctx: AppContext, app: string, resourcePath: string) {
  const outputs = (await ctx.repos.outputs.listAll(ctx.organizationId)) as Output[];
  const filename = resourcePath.split('/').pop() ?? resourcePath;
  const candidates = outputs
    .filter((output) => output.enabled && output.gatewayAppName === app)
    .filter((output) => {
      const streamName = output.gatewayStreamName;
      return (
        filename === `${streamName}.m3u8` ||
        filename === `${streamName}.flv` ||
        filename.startsWith(`${streamName}-`) ||
        filename.startsWith(`${streamName}_`) ||
        filename.startsWith(`${streamName}.`)
      );
    })
    .sort((a: Output, b: Output) => b.gatewayStreamName.length - a.gatewayStreamName.length);

  return candidates[0] ?? null;
}

async function enforcePlaybackPolicy(
  ctx: AppContext,
  app: string,
  stream: string,
  req: Request
) {
  const outputs = (await ctx.repos.outputs.listAll(ctx.organizationId)) as Output[];
  const output = outputs.find(
    (item) => item.enabled && item.gatewayAppName === app && item.gatewayStreamName === stream
  );

  if (!output) {
    throw new NotFoundError('Playback target not found');
  }

  if (!output.domainBlockId) {
    return output;
  }

  const block = (await ctx.repos.domainBlocks.findById(
    ctx.organizationId,
    output.domainBlockId
  )) as DomainBlock | null;
  if (!block) {
    return output;
  }

  const requestDomain = extractRequestDomain(req);
  const token = extractPlaybackToken(req);

  const allowedDomains = Array.isArray(block.allowedDomains) ? block.allowedDomains : [];

  const verifyPlaybackToken = () => {
    if (!token) return false;
    const payload = playbackTokenService.verifyToken(token);
    return Boolean(
      payload &&
        payload.organizationId === ctx.organizationId &&
        payload.app === app &&
        payload.stream === stream
    );
  };

  if (block.playbackAccessPolicy === 'restricted') {
    if (verifyPlaybackToken()) {
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
    if (!verifyPlaybackToken()) {
      throw new HttpError(403, 'Invalid playback token');
    }
    if (allowedDomains.length > 0 && !domainMatches(allowedDomains, requestDomain)) {
      throw new HttpError(403, 'Playback blocked for this domain');
    }
  }

  return output;
}

async function resolvePlaybackOutput(
  ctx: AppContext,
  app: string,
  stream: string
) {
  const outputs = (await ctx.repos.outputs.listAll(ctx.organizationId)) as Output[];
  const output = outputs.find(
    (item) => item.enabled && item.gatewayAppName === app && item.gatewayStreamName === stream
  );

  if (!output) {
    throw new NotFoundError('Playback target not found');
  }

  return output;
}

/** Operator preview: allow registered inputs (ingest) without a separate output row. */
async function assertOperatorPlaybackTarget(ctx: AppContext, app: string, stream: string) {
  const input = await ctx.repos.inputs.findByAppAndStreamKey(
    ctx.organizationId,
    app,
    stream
  );
  if (input?.enabled) {
    return;
  }
  await resolvePlaybackOutput(ctx, app, stream);
}

/** Partner/embed HLS proxy — playback token policy, not operator JWT. */
function registerPublicLiveMediaRoute(router: Router, ctx: AppContext) {
  router.get(
    '/live/:app/:resource(*)',
    asyncHandler(async (req, res) => {
      const app = String(req.params.app ?? '').replace(/^\/+|\/+$/g, '');
      const resource = String(req.params.resource ?? '').replace(/^\/+/, '');
      if (!app || !resource) {
        throw new NotFoundError('Playback target not found');
      }

      const output = await findPlaybackOutput(ctx, app, resource);
      if (output) {
        await enforcePlaybackPolicy(ctx, app, output.gatewayStreamName, req);
      } else {
        const streamFromFile = (resource.split('/').pop() ?? resource).replace(/\.(m3u8|flv|ts)$/i, '');
        const input = await ctx.repos.inputs.findByAppAndStreamKey(
          ctx.organizationId,
          app,
          streamFromFile
        );
        if (!input?.enabled) {
          throw new NotFoundError('Playback target not found');
        }
      }

      if (isDirectBrowserNavigation(req)) {
        throw new HttpError(403, 'Direct browser navigation to protected media is disabled');
      }

      const token = extractPlaybackToken(req) ?? undefined;
      await proxySrsMediaToResponse(`${app}/${resource}`, res, {
        rewriteM3u8Prefix: '/api/playback/live',
        rewritePlaylist: resource.endsWith('.m3u8')
          ? (body) => rewritePlaylist(body, app, token)
          : undefined,
      });
    })
  );
}

/** Public routes for /embed (no operator JWT). Playback tokens may still be issued. */
export function createPublicPlaybackRouter(ctx: AppContext): Router {
  const router = Router();

  router.get(
    '/embed-manifest',
    asyncHandler(async (req, res) => {
      const app = String(req.query.app ?? '').replace(/^\/+|\/+$/g, '');
      const stream = String(req.query.stream ?? '').replace(/^\/+|\/+$/g, '');
      if (!app || !stream) {
        throw new BadRequestError('Query params app and stream are required');
      }

      const share = await buildPlaybackShareByIngest(ctx, app, stream, req);

      res.json({
        active: share.active,
        playable: share.hlsPlayable,
        flvPlayable: share.active,
        app: share.ingestApp,
        stream: share.ingestStream,
        playApp: share.app,
        playStream: share.stream,
        playerHlsUrl: share.hlsUrl,
        playerFlvUrl: share.flvUrl,
        embedUrl: share.embedUrl,
        iframeEmbedCode: share.iframeEmbedCode,
        scriptEmbedCode: share.scriptEmbedCode,
        playbackAccessPolicy: share.playbackAccessPolicy,
        requiresToken: Boolean(share.token),
        token: share.token,
        expiresAt: share.expiresAt,
      });
    })
  );

  registerPublicLiveMediaRoute(router, ctx);

  return router;
}

export function createPlaybackRouter(ctx: AppContext): Router {
  const router = Router();

  router.get(
    '/resolve',
    asyncHandler(async (req, res) => {
      const app = String(req.query.app ?? '').replace(/^\/+|\/+$/g, '');
      const stream = String(req.query.stream ?? '').replace(/^\/+|\/+$/g, '');
      if (!app || !stream) {
        throw new BadRequestError('Query params app and stream are required');
      }

      await assertOperatorPlaybackTarget(ctx, app, stream);
      const resolved = await resolveLivePlayback(app, stream, { monitorMode: 'rtmp' });

      const outputs = (await ctx.repos.outputs.listAll(ctx.organizationId)) as Output[];
      const webHlsOutput = outputs.find(
        (item) =>
          item.enabled &&
          item.gatewayAppName === app &&
          item.gatewayStreamName === stream &&
          item.playbackProtocol === 'hls'
      );

      res.json({
        active: resolved.active,
        playable: resolved.playable,
        monitorMode: resolved.monitorMode,
        vhost: resolved.vhost,
        app: resolved.app,
        stream: resolved.stream,
        rtmpPublishUrl: resolved.rtmpPublishUrl,
        rtmpPlayUrl: resolved.rtmpPlayUrl,
        monitorFlvUrl: resolved.srsMediaFlv,
        playerHlsUrl: resolved.srsMediaHls,
        protectedHlsUrl: resolved.protectedHls,
        protectedFlvUrl: resolved.protectedFlv,
        webPlaybackAvailable: Boolean(webHlsOutput),
        webHlsRouteTarget: webHlsOutput?.routeTarget ?? null,
      });
    })
  );

  router.post(
    '/live-token',
    asyncHandler(async (req, res) => {
      const parsed = issuePlaybackTokenSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.message);
      }

      const app = parsed.data.app.replace(/^\/+|\/+$/g, '');
      const stream = parsed.data.stream.replace(/^\/+|\/+$/g, '');
      const expiresInSeconds = parsed.data.expiresInSeconds ?? config.playbackTokenTtlSeconds;
      await resolvePlaybackOutput(ctx, app, stream);

      const token = playbackTokenService.issueToken({
        organizationId: ctx.organizationId,
        app,
        stream,
        exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
      });

      const playback = await resolveLivePlayback(app, stream, { probe: false });
      const hlsPath = playback.protectedHls;
      const flvPath = playback.protectedFlv;
      const embedUrl = `/embed?${new URLSearchParams({
        app,
        stream,
        live: '1',
        token,
      }).toString()}`;

      res.json({
        token,
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
        expiresInSeconds,
        hlsUrl: appendTokenToPath(hlsPath, token),
        flvUrl: appendTokenToPath(flvPath, token),
        embedUrl,
      });
    })
  );

  return router;
}
