import type { Request } from 'express';
import type { DomainBlock, Input, Output, Route } from '@hydrofoil/shared-types';
import { isWatchOutputName } from '@hydrofoil/domain';

import type { AppContext } from '../context';
import { config } from '../config';
import { NotFoundError } from '../errors';
import { absoluteUrl, appendTokenToPath } from '../lib/absolute-url';
import { PlaybackTokenService } from './playback-token';
import { resolveLivePlayback } from './playback-resolver';

const playbackTokenService = new PlaybackTokenService(config.playbackTokenSecret);

export interface InputPlaybackShareDto {
  app: string;
  stream: string;
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
}

function pickWebPlaybackOutput(outputs: Output[]): Output | null {
  const enabled = outputs.filter((output) => output.enabled);
  const dedicatedHls = enabled.find(
    (output) => output.playbackProtocol === 'hls' && !isWatchOutputName(output.name)
  );
  if (dedicatedHls) return dedicatedHls;
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
  return block.playbackAccessPolicy === 'token-required' || Boolean(block.tokenRequired);
}

function usesProtectedPlayback(block: DomainBlock | undefined): boolean {
  if (!block) return false;
  return block.playbackAccessPolicy !== 'public';
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

  const application = input.applicationId
    ? await ctx.repos.applications.findById(ctx.organizationId, input.applicationId)
    : null;
  const defaultApp = application?.appName ?? 'live';

  const [routes, allOutputs, domainBlocks] = await Promise.all([
    ctx.repos.routes.findByInputId(ctx.organizationId, input.id),
    ctx.repos.outputs.listAll(ctx.organizationId),
    ctx.repos.domainBlocks.listAll(ctx.organizationId),
  ]);

  const linkedOutputIds = new Set(
    (routes as Route[]).flatMap((route) => route.outputIds.map(String))
  );
  const linkedOutputs = (allOutputs as Output[]).filter((output) => linkedOutputIds.has(output.id));
  const webOutput = pickWebPlaybackOutput(linkedOutputs);
  const domainBlockById = new Map(
    (domainBlocks as DomainBlock[]).map((block) => [block.id, block])
  );
  const block = resolveEffectiveDomainBlock(linkedOutputs, domainBlockById);
  const outputBlock = webOutput?.domainBlockId
    ? domainBlockById.get(webOutput.domainBlockId)
    : undefined;
  const effectiveBlock = outputBlock ?? block;

  const app = webOutput?.gatewayAppName ?? defaultApp;
  const stream = webOutput?.gatewayStreamName ?? input.streamKey;
  const playback = await resolveLivePlayback(app, stream, { probe: false });

  const needsToken = policyNeedsToken(effectiveBlock);
  const protectedPaths = usesProtectedPlayback(effectiveBlock);
  const expiresInSeconds = config.playbackTokenTtlSeconds;

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
      app,
      stream,
      live: '1',
      ...(token ? { token } : {}),
      title: input.name,
    }).toString()}`
  );

  return {
    app,
    stream,
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
  };
}
