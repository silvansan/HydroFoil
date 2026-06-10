import type { Application, Input, Output } from '@hydrofoil/shared-types';

import type { AppContext } from '../context';
import { buildHlsRouteTarget, buildRtmpRouteTarget, watchOutputName, watchRouteName } from './playback-target';

export interface ProvisionedPlayback {
  outputId: string;
  routeId: string;
}

/** Creates the default RTMP monitor output + route (ingest path; web HLS via restream/transcode outputs). */
export async function provisionDefaultInputPlayback(
  ctx: Pick<AppContext, 'repos' | 'organizationId'>,
  input: Input,
  application: Application
): Promise<ProvisionedPlayback> {
  const appName = application.appName;
  const watchOutput = await ctx.repos.outputs.create(ctx.organizationId, {
    name: watchOutputName(appName, input.streamKey),
    routeTarget: buildRtmpRouteTarget(appName, input.streamKey),
    playbackProtocol: 'rtmp',
    gatewayAppName: appName,
    gatewayStreamName: input.streamKey,
    enabled: true,
    isPublic: true,
  });

  const hlsOutput = await ctx.repos.outputs.create(ctx.organizationId, {
    name: `HLS: ${appName}/${input.streamKey}`,
    routeTarget: buildHlsRouteTarget(appName, input.streamKey),
    playbackProtocol: 'hls',
    gatewayAppName: appName,
    gatewayStreamName: input.streamKey,
    enabled: true,
    isPublic: true,
  });

  const route = await ctx.repos.routes.create(ctx.organizationId, {
    inputId: input.id,
    name: watchRouteName(appName, input.streamKey),
    outputIds: [watchOutput.id, hlsOutput.id],
    enabled: true,
  });

  return { outputId: hlsOutput.id, routeId: route.id };
}

/** Backfill HLS web output for stream keys created before dual watch+HLS provisioning. */
export async function ensureInputHlsOutput(
  ctx: Pick<AppContext, 'repos' | 'organizationId'>,
  input: Input,
  application: Application,
  routes: Array<{ id: unknown; outputIds: string[] }>,
  linkedOutputs: Output[]
): Promise<Output | null> {
  const existing = linkedOutputs.find(
    (output) => output.enabled && output.playbackProtocol === 'hls'
  ) as Output | undefined;
  if (existing) return existing;

  const appName = application.appName;
  const inheritedDomainBlockId = linkedOutputs.find((output) => output.domainBlockId)?.domainBlockId;
  const hlsOutput = await ctx.repos.outputs.create(ctx.organizationId, {
    name: `HLS: ${appName}/${input.streamKey}`,
    routeTarget: buildHlsRouteTarget(appName, input.streamKey),
    playbackProtocol: 'hls',
    gatewayAppName: appName,
    gatewayStreamName: input.streamKey,
    enabled: true,
    isPublic: true,
    domainBlockId: inheritedDomainBlockId,
  });

  const route = routes[0];
  if (route) {
    await ctx.repos.routes.update(ctx.organizationId, String(route.id), {
      outputIds: [...route.outputIds.map(String), String(hlsOutput.id)],
    });
  }

  return hlsOutput as Output;
}

/** Removes auto-linked outputs after routes are gone (call before or after input delete). */
export async function teardownInputPlayback(
  ctx: Pick<AppContext, 'repos' | 'organizationId'>,
  inputId: string
): Promise<void> {
  const routes = await ctx.repos.routes.findByInputId(ctx.organizationId, inputId);
  const outputIds = [...new Set(routes.flatMap((route: { outputIds: string[] }) => route.outputIds))];
  for (const outputId of outputIds) {
    await ctx.repos.outputs.delete(ctx.organizationId, String(outputId));
  }
}
