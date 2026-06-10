import type { Request } from 'express';
import type { Application, DomainBlock, Input, Output, Route } from '@hydrofoil/shared-types';
import { isWatchOutputName } from '@hydrofoil/domain';
import { buildIframeEmbedCode } from '../lib/iframe-embed';

import type { AppContext } from '../context';
import { config } from '../config';
import { HttpError, NotFoundError } from '../errors';
import { absoluteUrl, appendTokenToPath } from '../lib/absolute-url';
import {
  canServePublicEmbedManifest,
  policyNeedsToken,
  resolveEmbedManifestToken,
  usesProtectedPlayback,
} from '../lib/playback-access';
import { resolvePlaybackExpirySeconds } from '../lib/playback-expiry';
import { ensureInputHlsOutput } from '../lib/provision-input-playback';
import { buildScriptEmbedCode } from '../lib/script-embed';
import { resolveInputAbrRenditions, type AbrRenditionDto } from './input-abr-renditions';
import { resolveLivePlayback } from './playback-resolver';
import { resolvePlayableWebHlsTarget } from './resolve-web-playback';

export interface InputPlaybackShareDto {
  app: string;
  stream: string;
  ingestApp: string;
  ingestStream: string;
  active: boolean;
  hlsPlayable: boolean;
  playbackAccessPolicy: 'public' | 'token-required' | 'restricted';
  domainBlockId?: string;
  domainBlockName?: string;
  previewUrl: string;
  shareUrl: string;
  embedUrl: string;
  hlsUrl: string;
  flvUrl: string;
  token?: string;
  expiresAt?: string;
  expiresInSeconds?: number;
  iframeEmbedCode: string;
  scriptEmbedCode: string;
  abrRenditions: AbrRenditionDto[];
}

function pickWebPlaybackOutput(outputs: Output[]): Output | null {
  const enabled = outputs.filter((output) => output.enabled);
  const dedicatedHls = enabled.find(
    (output) => output.playbackProtocol === 'hls' && !isWatchOutputName(output.name)
  );
  if (dedicatedHls) return dedicatedHls;
  const hlsWatch = enabled.find((output) => output.playbackProtocol === 'hls');
  if (hlsWatch) return hlsWatch;
  const watch = enabled.find((output) => isWatchOutputName(output.name));
  if (watch) return watch;
  return enabled[0] ?? null;
}

function resolveEffectiveDomainBlock(
  outputs: Output[],
  domainBlockById: Map<string, DomainBlock>
): DomainBlock | undefined {
  for (const output of outputs) {
    if (!output.domainBlockId) continue;
    const block = domainBlockById.get(output.domainBlockId);
    if (block) return block;
  }
  return undefined;
}

export interface BuildPlaybackShareOptions {
  /** Operator-only endpoints may mint fresh signed links. Public embed manifest must not. */
  allowTokenIssue?: boolean;
}

export async function buildPlaybackShareByIngest(
  ctx: AppContext,
  app: string,
  stream: string,
  req: Request,
  options?: BuildPlaybackShareOptions
): Promise<InputPlaybackShareDto> {
  const safeApp = app.replace(/^\/+|\/+$/g, '');
  const safeStream = stream.replace(/^\/+|\/+$/g, '');
  const input = await ctx.repos.inputs.findByAppAndStreamKey(
    ctx.organizationId,
    safeApp,
    safeStream
  );
  if (!input?.enabled) {
    throw new NotFoundError('Stream not found');
  }
  return buildInputPlaybackShare(ctx, String(input.id), req, options);
}

export async function buildInputPlaybackShare(
  ctx: AppContext,
  inputId: string,
  req: Request,
  options?: BuildPlaybackShareOptions
): Promise<InputPlaybackShareDto> {
  const input = (await ctx.repos.inputs.findById(ctx.organizationId, inputId)) as Input | null;
  if (!input) {
    throw new NotFoundError('Input not found');
  }

  const application = (input.applicationId
    ? await ctx.repos.applications.findById(ctx.organizationId, input.applicationId)
    : null) as Application | null;
  const defaultApp = application?.appName ?? 'live';
  const ingestApp = defaultApp;
  const ingestStream = input.streamKey;

  const [routes, allOutputs, domainBlocks] = await Promise.all([
    ctx.repos.routes.findByInputId(ctx.organizationId, input.id),
    ctx.repos.outputs.listAll(ctx.organizationId),
    ctx.repos.domainBlocks.listAll(ctx.organizationId),
  ]);

  let linkedOutputIds = new Set(
    (routes as Route[]).flatMap((route) => route.outputIds.map(String))
  );
  let linkedOutputs = (allOutputs as Output[]).filter((output) => linkedOutputIds.has(output.id));

  if (application) {
    await ensureInputHlsOutput(ctx, input, application, routes as Route[], linkedOutputs);
    const [refreshedRoutes, refreshedOutputs] = await Promise.all([
      ctx.repos.routes.findByInputId(ctx.organizationId, input.id),
      ctx.repos.outputs.listAll(ctx.organizationId),
    ]);
    linkedOutputIds = new Set(
      (refreshedRoutes as Route[]).flatMap((route) => route.outputIds.map(String))
    );
    linkedOutputs = (refreshedOutputs as Output[]).filter((output) =>
      linkedOutputIds.has(String(output.id))
    );
  }

  const webOutput = pickWebPlaybackOutput(linkedOutputs);
  const domainBlockById = new Map(
    (domainBlocks as DomainBlock[]).map((block) => [block.id, block])
  );
  const block = resolveEffectiveDomainBlock(linkedOutputs, domainBlockById);
  const outputBlock = webOutput?.domainBlockId
    ? domainBlockById.get(webOutput.domainBlockId)
    : undefined;
  const effectiveBlock = outputBlock ?? block;

  const playableTarget = await resolvePlayableWebHlsTarget({
    defaultApp,
    input,
    linkedOutputs,
  });

  const app = playableTarget.app;
  const stream = playableTarget.stream;
  const playback = await resolveLivePlayback(app, stream, { probe: false });

  const needsToken = policyNeedsToken(effectiveBlock);
  const protectedPaths = usesProtectedPlayback(effectiveBlock);
  const allowTokenIssue = options?.allowTokenIssue ?? false;
  const expiresInSeconds = needsToken ? resolvePlaybackExpirySeconds(req) : config.playbackTokenTtlSeconds;

  const token = resolveEmbedManifestToken(ctx.organizationId, effectiveBlock, req, app, stream, {
    allowTokenIssue,
    expiresInSeconds,
  });

  const manifestAllowed = canServePublicEmbedManifest(
    ctx.organizationId,
    effectiveBlock,
    req,
    app,
    stream
  );

  if (
    !allowTokenIssue &&
    effectiveBlock?.playbackAccessPolicy === 'restricted' &&
    !manifestAllowed
  ) {
    throw new HttpError(403, 'Playback blocked for this domain');
  }

  const canPublishUrls =
    !needsToken ||
    allowTokenIssue ||
    manifestAllowed ||
    Boolean(token);

  const hlsPath = canPublishUrls
    ? protectedPaths
      ? appendTokenToPath(playback.protectedHls, token)
      : playback.srsMediaHls
    : '';
  const flvPath = canPublishUrls
    ? protectedPaths
      ? appendTokenToPath(playback.protectedFlv, token)
      : playback.srsMediaFlv
    : '';
  const hlsUrl = absoluteUrl(req, hlsPath);
  const flvUrl = absoluteUrl(req, flvPath);
  const embedUrl = absoluteUrl(
    req,
    `/embed?${new URLSearchParams({
      app: ingestApp,
      stream: ingestStream,
      live: '1',
      ...(token ? { token } : {}),
      title: input.name,
    }).toString()}`
  );

  const abrRenditions = await resolveInputAbrRenditions(ctx, input);

  const iframeEmbedCode = buildIframeEmbedCode({
    embedUrl,
    title: `${ingestApp}/${ingestStream}`,
  });

  return {
    app,
    stream,
    ingestApp,
    ingestStream,
    active: playableTarget.active,
    hlsPlayable: playableTarget.hlsPlayable,
    playbackAccessPolicy: effectiveBlock?.playbackAccessPolicy ?? 'public',
    domainBlockId: effectiveBlock?.id,
    domainBlockName: effectiveBlock?.name,
    previewUrl: hlsUrl,
    shareUrl: hlsUrl,
    embedUrl,
    hlsUrl,
    flvUrl,
    token,
    expiresAt: token ? new Date(Date.now() + expiresInSeconds * 1000).toISOString() : undefined,
    expiresInSeconds: token ? expiresInSeconds : undefined,
    iframeEmbedCode,
    scriptEmbedCode: buildScriptEmbedCode(hlsUrl, input.name),
    abrRenditions,
  };
}
