import type { Request } from 'express';
import type { Application, DomainBlock, Input, Output, Route } from '@hydrofoil/shared-types';
import { isWatchOutputName } from '@hydrofoil/domain';

import type { AppContext } from '../context';
import { config } from '../config';
import { NotFoundError } from '../errors';
import { absoluteUrl, appendTokenToPath } from '../lib/absolute-url';
import { resolvePlaybackExpirySeconds } from '../lib/playback-expiry';
import { ensureInputHlsOutput } from '../lib/provision-input-playback';
import { buildScriptEmbedCode } from '../lib/script-embed';
import { PlaybackTokenService } from './playback-token';
import { resolveLivePlayback } from './playback-resolver';
import { resolvePlayableWebHlsTarget } from './resolve-web-playback';

const playbackTokenService = new PlaybackTokenService(config.playbackTokenSecret);

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
  token?: string;
  expiresAt?: string;
  expiresInSeconds?: number;
  iframeEmbedCode: string;
  scriptEmbedCode: string;
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

function policyNeedsToken(block: DomainBlock | undefined): boolean {
  if (!block) return false;
  return (
    block.playbackAccessPolicy === 'token-required' ||
    block.playbackAccessPolicy === 'restricted' ||
    Boolean(block.tokenRequired)
  );
}

function usesProtectedPlayback(block: DomainBlock | undefined): boolean {
  if (!block) return false;
  return block.playbackAccessPolicy !== 'public';
}

export async function buildPlaybackShareByIngest(
  ctx: AppContext,
  app: string,
  stream: string,
  req: Request
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
  return buildInputPlaybackShare(ctx, String(input.id), req);
}

export async function buildInputPlaybackShare(
  ctx: AppContext,
  inputId: string,
  req: Request
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
  const expiresInSeconds = needsToken ? resolvePlaybackExpirySeconds(req) : config.playbackTokenTtlSeconds;

  let token: string | undefined;
  if (needsToken) {
    token = playbackTokenService.issueToken({
      organizationId: ctx.organizationId,
      app,
      stream,
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    });
  }

  const hlsPath = protectedPaths
    ? appendTokenToPath(playback.protectedHls, token)
    : playback.srsMediaHls;
  const hlsUrl = absoluteUrl(req, hlsPath);
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

  const iframeEmbedCode = `<!-- HydroFoil Player (iframe) -->
<iframe
  src=${JSON.stringify(embedUrl)}
  title=${JSON.stringify(`${ingestApp}/${ingestStream}`)}
  width="960"
  height="540"
  style="border:0;border-radius:8px;background:#000;max-width:100%"
  allow="autoplay; fullscreen; picture-in-picture"
></iframe>`;

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
    token,
    expiresAt: token ? new Date(Date.now() + expiresInSeconds * 1000).toISOString() : undefined,
    expiresInSeconds: token ? expiresInSeconds : undefined,
    iframeEmbedCode,
    scriptEmbedCode: buildScriptEmbedCode(hlsUrl, input.name),
  };
}
