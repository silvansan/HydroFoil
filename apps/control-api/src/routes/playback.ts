import { Router } from 'express';
import { z } from 'zod';
import type { Input, Output } from '@hydrofoil/shared-types';

import type { AppContext } from '../context';
import { config } from '../config';
import { BadRequestError, NotFoundError } from '../errors';
import { asyncHandler } from '../middleware/async-handler';
import {
  enforcePlaybackAccess,
  extractPlaybackToken,
  issueRotatedPlaybackToken,
  resolveStreamPlaybackBlock,
  usesProtectedPlayback,
} from '../lib/playback-access';
import { proxySrsMediaToResponse } from '../lib/proxy-srs-media';
import { PlaybackTokenService } from '../services/playback-token';
import { resolveInputAbrRenditions } from '../services/input-abr-renditions';
import { buildPublicMediaPath, resolveLivePlayback } from '../services/playback-resolver';
import { buildPlaybackShareByIngest } from '../services/input-playback-share';
import { probeUpstreamMedia } from '../lib/srs-upstream-fetch';

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

      const streamFromFile = (resource.split('/').pop() ?? resource).replace(/\.(m3u8|flv|ts)$/i, '');
      const output = await findPlaybackOutput(ctx, app, resource);
      const stream = output?.gatewayStreamName ?? streamFromFile;
      await enforcePlaybackAccess(ctx, app, stream, req);

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

      const share = await buildPlaybackShareByIngest(ctx, app, stream, req, {
        allowTokenIssue: false,
      });

      const signedLinkRequired = share.playbackAccessPolicy === 'token-required';

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
        abrRenditions: share.abrRenditions,
        embedUrl: share.embedUrl,
        iframeEmbedCode: share.iframeEmbedCode,
        scriptEmbedCode: share.scriptEmbedCode,
        playbackAccessPolicy: share.playbackAccessPolicy,
        requiresToken: signedLinkRequired && !share.token,
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
      const input = (await ctx.repos.inputs.findByAppAndStreamKey(
        ctx.organizationId,
        app,
        stream
      )) as Input | null;
      const abrRenditions = input ? await resolveInputAbrRenditions(ctx, input) : [];
      const hlsPlayable =
        resolved.active &&
        (await probeUpstreamMedia(buildPublicMediaPath(app, stream, 'm3u8')));

      const outputs = (await ctx.repos.outputs.listAll(ctx.organizationId)) as Output[];
      const webHlsOutput = outputs.find(
        (item) =>
          item.enabled &&
          item.gatewayAppName === app &&
          item.gatewayStreamName === stream &&
          item.playbackProtocol === 'hls'
      );

      const playbackBlock = await resolveStreamPlaybackBlock(ctx, app, stream);
      let monitorFlvUrl = resolved.srsMediaFlv;
      let playerHlsUrl = resolved.srsMediaHls;
      if (usesProtectedPlayback(playbackBlock)) {
        const monitorToken = playbackTokenService.issueToken({
          organizationId: ctx.organizationId,
          app: resolved.app,
          stream: resolved.stream,
          exp: Math.floor(Date.now() / 1000) + config.playbackTokenTtlSeconds,
        });
        monitorFlvUrl = appendTokenToPath(resolved.protectedFlv, monitorToken);
        playerHlsUrl = appendTokenToPath(resolved.protectedHls, monitorToken);
      }

      res.json({
        active: resolved.active,
        playable: resolved.playable,
        monitorMode: resolved.monitorMode,
        vhost: resolved.vhost,
        app: resolved.app,
        stream: resolved.stream,
        rtmpPublishUrl: resolved.rtmpPublishUrl,
        rtmpPlayUrl: resolved.rtmpPlayUrl,
        monitorFlvUrl,
        playerHlsUrl,
        protectedHlsUrl: resolved.protectedHls,
        protectedFlvUrl: resolved.protectedFlv,
        webPlaybackAvailable: Boolean(webHlsOutput),
        webHlsRouteTarget: webHlsOutput?.routeTarget ?? null,
        hlsPlayable,
        abrRenditions,
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

      const token = await issueRotatedPlaybackToken(ctx, {
        organizationId: ctx.organizationId,
        app,
        stream,
        expiresInSeconds,
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
