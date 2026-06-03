import { Readable } from 'node:stream';
import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import type { DomainBlock } from '@hydrofoil/shared-types';

import type { AppContext } from '../context';
import { config } from '../config';
import { BadRequestError, HttpError, NotFoundError } from '../errors';
import { buildStorageLocationRef } from '../lib/recording-defaults';
import { asyncHandler } from '../middleware/async-handler';
import { parsePagination } from '../lib/pagination';
import { formatZodError } from '../lib/zod-errors';
import {
  assertVodRouteAccess,
  canManageVodRoutes,
  filterVodRoutesForScope,
  getAccessScope,
} from '../lib/access-control';
import { ForbiddenError } from '../errors';
import { resolveStorageObject } from '../services/recording-playback';
import { VodPlaybackTokenService } from '../services/vod-playback-token';

const createVodRouteSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean().optional(),
  requestDomain: z.string().trim().optional(),
  publicPath: z.string().min(1),
  deliveryType: z.enum(['hls', 'progressive']),
  sourceType: z.enum(['storage-location', 'remote-http']),
  storageLocationId: z.string().uuid().optional(),
  sourcePath: z.string().min(1),
  domainBlockId: z.string().uuid().optional(),
  allowDirectAccess: z.boolean().optional(),
  generateIframePlaylist: z.boolean().optional(),
});

const updateVodRouteSchema = createVodRouteSchema.partial();
const vodPlaybackTokenService = new VodPlaybackTokenService(config.playbackTokenSecret);

type VodRouteRecord = Awaited<ReturnType<AppContext['repos']['vodRoutes']['findById']>>;

function normalizePublicPath(path: string): string {
  const normalized = `/${path}`.replace(/\/+/g, '/').replace(/\/$/, '');
  return normalized.length > 0 ? normalized : '/';
}

function normalizeOptionalDomain(domain: string | undefined): string | undefined {
  const trimmed = domain?.trim().toLowerCase();
  return trimmed ? trimmed : undefined;
}

function extractPlaybackToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }
  return typeof req.query.token === 'string' ? req.query.token : null;
}

function extractRequestDomain(req: Request): string | null {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const raw =
    typeof origin === 'string' && origin
      ? origin
      : typeof referer === 'string' && referer
        ? referer
        : '';

  if (raw) {
    try {
      return new URL(raw).hostname.toLowerCase();
    } catch {
      return null;
    }
  }

  return req.hostname ? String(req.hostname).toLowerCase() : null;
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

function appendToken(urlPath: string, token?: string): string {
  if (!token) return urlPath;
  const separator = urlPath.includes('?') ? '&' : '?';
  return `${urlPath}${separator}token=${encodeURIComponent(token)}`;
}

function absoluteUrl(req: Request, urlPath: string): string {
  if (/^https?:\/\//i.test(urlPath)) return urlPath;
  return `${req.protocol}://${req.get('host')}${urlPath.startsWith('/') ? urlPath : `/${urlPath}`}`;
}

async function validateVodRouteSource(ctx: AppContext, data: z.infer<typeof createVodRouteSchema>) {
  if (data.sourceType === 'storage-location') {
    if (!data.storageLocationId) {
      throw new BadRequestError('Storage-backed VOD routes require a storage location');
    }
    const location = await ctx.repos.storageLocations.findById(ctx.organizationId, data.storageLocationId);
    if (!location) {
      throw new BadRequestError('Storage location not found');
    }
    return;
  }

  try {
    const url = new URL(data.sourcePath);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error();
    }
  } catch {
    throw new BadRequestError('Remote HTTP VOD routes require a valid http(s) source URL');
  }
}

async function getEffectiveDomainBlock(ctx: AppContext, route: NonNullable<VodRouteRecord>) {
  if (!route.domainBlockId) return null;
  return (await ctx.repos.domainBlocks.findById(
    ctx.organizationId,
    String(route.domainBlockId)
  )) as DomainBlock | null;
}

async function enforceVodAccess(ctx: AppContext, route: NonNullable<VodRouteRecord>, req: Request) {
  const routeDomain = normalizeOptionalDomain(route.requestDomain);
  const hostDomain = req.hostname ? String(req.hostname).toLowerCase() : '';
  if (routeDomain && hostDomain && hostDomain !== routeDomain) {
    throw new NotFoundError('VOD route not found');
  }

  const block = await getEffectiveDomainBlock(ctx, route);
  if (!block) {
    if (!route.allowDirectAccess && isDirectBrowserNavigation(req)) {
      throw new HttpError(403, 'Direct browser navigation to this VOD route is disabled');
    }
    return;
  }

  const requestDomain = extractRequestDomain(req);
  const token = extractPlaybackToken(req);

  if (block.playbackAccessPolicy === 'restricted' && !domainMatches(block.allowedDomains ?? [], requestDomain)) {
    throw new HttpError(403, 'Playback blocked for this domain');
  }

  if (block.playbackAccessPolicy === 'token-required' || block.tokenRequired) {
    if (!token) {
      throw new HttpError(401, 'Playback token required');
    }
    const payload = vodPlaybackTokenService.verifyToken(token);
    if (!payload || payload.organizationId !== ctx.organizationId || payload.routeId !== route.id) {
      throw new HttpError(403, 'Invalid playback token');
    }
    if (!domainMatches(block.allowedDomains ?? [], requestDomain)) {
      throw new HttpError(403, 'Playback blocked for this domain');
    }
  }

  if (!route.allowDirectAccess && isDirectBrowserNavigation(req)) {
    throw new HttpError(403, 'Direct browser navigation to this VOD route is disabled');
  }
}

function resolveStorageSourceObjectKey(
  route: NonNullable<VodRouteRecord>,
  assetPath?: string
): string {
  const basePath = String(route.sourcePath).replace(/^\/+/, '').replace(/\/+$/, '');
  if (route.deliveryType === 'progressive') {
    if (!assetPath) {
      return basePath;
    }
    return [basePath, assetPath.replace(/^\/+/, '')].filter(Boolean).join('/');
  }

  if (!assetPath) {
    return basePath;
  }

  const baseDir = basePath.includes('/') ? basePath.slice(0, basePath.lastIndexOf('/') + 1) : '';
  return `${baseDir}${assetPath.replace(/^\/+/, '')}`;
}

function resolveRemoteSourceUrl(route: NonNullable<VodRouteRecord>, assetPath?: string): string {
  const sourceUrl = new URL(String(route.sourcePath));
  if (route.deliveryType === 'progressive' && assetPath) {
    return new URL(assetPath.replace(/^\/+/, ''), sourceUrl.toString().endsWith('/') ? sourceUrl : new URL(`${sourceUrl.toString()}/`)).toString();
  }
  if (route.deliveryType === 'progressive' || !assetPath) {
    return sourceUrl.toString();
  }
  return new URL(assetPath.replace(/^\/+/, ''), sourceUrl).toString();
}

function rewriteHlsManifest(body: string, basePublicPath: string, token?: string): string {
  return body
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return line;
      return appendToken(`${basePublicPath}/${trimmed.replace(/^\/+/, '')}`, token);
    })
    .join('\n');
}

function inferProgressiveContentType(objectKey: string): string {
  const lower = objectKey.toLowerCase();
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.m4v')) return 'video/mp4';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.aac')) return 'audio/aac';
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.flac')) return 'audio/flac';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

async function resolveDirectProgressiveUrl(
  ctx: AppContext,
  route: NonNullable<VodRouteRecord>,
  assetPath: string | undefined
): Promise<string | null> {
  if (route.deliveryType !== 'progressive') {
    return null;
  }

  if (route.sourceType === 'remote-http') {
    return resolveRemoteSourceUrl(route, assetPath);
  }

  const storageLocationRef = buildStorageLocationRef(ctx.organizationId, String(route.storageLocationId));
  const objectKey = resolveStorageSourceObjectKey(route, assetPath);
  const resolved = await resolveStorageObject(storageLocationRef, objectKey, ctx.repos);
  if (resolved.kind === 'local') {
    return null;
  }
  return await resolved.storage.getSignedUrl(resolved.bucket, resolved.objectKey, 60 * 60);
}

async function streamVodAsset(
  ctx: AppContext,
  route: NonNullable<VodRouteRecord>,
  assetPath: string | undefined,
  req: Request,
  res: Response
) {
  const directProgressiveUrl = await resolveDirectProgressiveUrl(ctx, route, assetPath);
  if (directProgressiveUrl) {
    res.redirect(302, directProgressiveUrl);
    return;
  }

  if (route.sourceType === 'storage-location') {
    const storageLocationRef = buildStorageLocationRef(ctx.organizationId, String(route.storageLocationId));
    const objectKey = resolveStorageSourceObjectKey(route, assetPath);
    const { storage, bucket, objectKey: resolvedObjectKey } = await resolveStorageObject(
      storageLocationRef,
      objectKey,
      ctx.repos
    );
    const stream = await storage.getObjectStream(bucket, resolvedObjectKey);

    if (route.deliveryType === 'hls' && !assetPath) {
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const rewritten = rewriteHlsManifest(
        Buffer.concat(chunks).toString('utf8'),
        normalizePublicPath(route.publicPath),
        extractPlaybackToken(req) ?? undefined
      );
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'private, max-age=60');
      res.send(rewritten);
      return;
    }

    if (route.deliveryType === 'hls') {
      res.setHeader('Content-Type', assetPath?.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t');
    } else {
      res.setHeader('Content-Type', inferProgressiveContentType(resolvedObjectKey));
    }
    stream.on('error', () => {
      if (!res.headersSent) res.status(500).end();
    });
    stream.pipe(res);
    return;
  }

  const sourceUrl = resolveRemoteSourceUrl(route, assetPath);
  const upstream = await fetch(sourceUrl);

  if (route.deliveryType === 'hls' && !assetPath && upstream.ok) {
    const buffer = Buffer.from(await upstream.arrayBuffer());
    const rewritten = rewriteHlsManifest(
      buffer.toString('utf8'),
      normalizePublicPath(route.publicPath),
      extractPlaybackToken(req) ?? undefined
    );
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/vnd.apple.mpegurl');
    res.send(rewritten);
    return;
  }

  res.status(upstream.status);
  const contentType = upstream.headers.get('content-type');
  if (contentType) {
    res.setHeader('Content-Type', contentType);
  }
  if (!upstream.body) {
    res.end();
    return;
  }
  Readable.fromWeb(upstream.body as globalThis.ReadableStream<Uint8Array>).pipe(res);
}

function matchVodRouteForRequest(
  routes: NonNullable<Awaited<ReturnType<AppContext['repos']['vodRoutes']['listAll']>>>,
  requestPath: string,
  host: string
) {
  const normalizedPath = normalizePublicPath(requestPath);
  return [...routes]
    .sort((a, b) => String(b.publicPath).length - String(a.publicPath).length)
    .find((route) => {
      if (!route.enabled) return false;
      const routePath = normalizePublicPath(String(route.publicPath));
      const routeDomain = normalizeOptionalDomain(
        route.requestDomain != null ? String(route.requestDomain) : undefined
      );
      if (routeDomain && routeDomain !== host) return false;

      if (route.deliveryType === 'progressive') {
        return normalizedPath === routePath || normalizedPath.startsWith(`${routePath}/`);
      }

      return normalizedPath === routePath || normalizedPath.startsWith(`${routePath}/`);
    });
}

function relativeAssetPath(route: NonNullable<VodRouteRecord>, requestPath: string): string | undefined {
  const routePath = normalizePublicPath(String(route.publicPath));
  const normalizedPath = normalizePublicPath(requestPath);
  if (normalizedPath === routePath) return undefined;
  return normalizedPath.slice(routePath.length).replace(/^\/+/, '') || undefined;
}

export function createVodRoutesRouter(ctx: AppContext): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const scope = getAccessScope(req);
      const result = await ctx.repos.vodRoutes.list(ctx.organizationId, parsePagination(req));
      const items = filterVodRoutesForScope(result.items, scope);
      res.json({ ...result, items, total: items.length });
    })
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const scope = getAccessScope(req);
      assertVodRouteAccess(scope, req.params.id);
      const route = await ctx.repos.vodRoutes.findById(ctx.organizationId, req.params.id);
      if (!route) throw new NotFoundError('VOD route not found');
      res.json(route);
    })
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      if (!canManageVodRoutes(getAccessScope(req))) {
        throw new ForbiddenError('Only admins can create VOD routes');
      }
      const parsed = createVodRouteSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(formatZodError(parsed.error));
      await validateVodRouteSource(ctx, parsed.data);
      const route = await ctx.repos.vodRoutes.create(ctx.organizationId, {
        ...parsed.data,
        requestDomain: normalizeOptionalDomain(parsed.data.requestDomain),
        publicPath: normalizePublicPath(parsed.data.publicPath),
      });
      res.status(201).json(route);
    })
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const scope = getAccessScope(req);
      assertVodRouteAccess(scope, req.params.id);
      const parsed = updateVodRouteSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(formatZodError(parsed.error));
      const existing = await ctx.repos.vodRoutes.findById(ctx.organizationId, req.params.id);
      if (!existing) throw new NotFoundError('VOD route not found');
      const merged = {
        ...existing,
        ...parsed.data,
        requestDomain:
          parsed.data.requestDomain !== undefined
            ? normalizeOptionalDomain(parsed.data.requestDomain)
            : existing.requestDomain,
        publicPath:
          parsed.data.publicPath !== undefined
            ? normalizePublicPath(parsed.data.publicPath)
            : existing.publicPath,
      };
      await validateVodRouteSource(ctx, merged as z.infer<typeof createVodRouteSchema>);
      const updated = await ctx.repos.vodRoutes.update(ctx.organizationId, req.params.id, merged);
      if (!updated) throw new NotFoundError('VOD route not found');
      res.json(updated);
    })
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      assertVodRouteAccess(getAccessScope(req), req.params.id);
      const deleted = await ctx.repos.vodRoutes.delete(ctx.organizationId, req.params.id);
      if (!deleted) throw new NotFoundError('VOD route not found');
      res.status(204).send();
    })
  );

  router.get(
    '/:id/playback-url',
    asyncHandler(async (req, res) => {
      assertVodRouteAccess(getAccessScope(req), req.params.id);
      const route = await ctx.repos.vodRoutes.findById(ctx.organizationId, req.params.id);
      if (!route) throw new NotFoundError('VOD route not found');

      const block = await getEffectiveDomainBlock(ctx, route);
      const needsToken = Boolean(block && (block.playbackAccessPolicy === 'token-required' || block.tokenRequired));
      const expiresInSeconds = config.playbackTokenTtlSeconds;
      const token = needsToken
        ? vodPlaybackTokenService.issueToken({
            organizationId: ctx.organizationId,
            routeId: String(route.id),
            exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
          })
        : undefined;

      const sharePath = appendToken(String(route.publicPath), token);
      const shareUrl = absoluteUrl(req, sharePath);
      const embedUrl = absoluteUrl(
        req,
        `/embed?${new URLSearchParams({
          live: '0',
          src: shareUrl,
          title: String(route.name),
        }).toString()}`
      );

      res.json({
        previewUrl: shareUrl,
        shareUrl,
        embedUrl,
        token,
        expiresAt: token ? new Date(Date.now() + expiresInSeconds * 1000).toISOString() : undefined,
        expiresInSeconds: token ? expiresInSeconds : undefined,
      });
    })
  );

  return router;
}

export function createVodPublicPlaybackRouter(ctx: AppContext): Router {
  const router = Router();

  router.get(
    '*',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const routes = await ctx.repos.vodRoutes.listAll(ctx.organizationId);
        const host = req.hostname ? String(req.hostname).toLowerCase() : '';
        const matched = matchVodRouteForRequest(routes, req.path, host);
        if (!matched) {
          next();
          return;
        }

        await enforceVodAccess(ctx, matched, req);
        const assetPath = relativeAssetPath(matched, req.path);
        await streamVodAsset(ctx, matched, assetPath, req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
