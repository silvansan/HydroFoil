import type { Application, Input } from '@hydrofoil/shared-types';

import type { AppContext } from '../context';
import { buildRtmpRouteTarget, watchOutputName, watchRouteName } from './playback-target';

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
  const output = await ctx.repos.outputs.create(ctx.organizationId, {
    name: watchOutputName(appName, input.streamKey),
    routeTarget: buildRtmpRouteTarget(appName, input.streamKey),
    playbackProtocol: 'rtmp',
    gatewayAppName: appName,
    gatewayStreamName: input.streamKey,
    enabled: true,
    isPublic: true,
  });

  const route = await ctx.repos.routes.create(ctx.organizationId, {
    inputId: input.id,
    name: watchRouteName(appName, input.streamKey),
    outputIds: [output.id],
    enabled: true,
  });

  return { outputId: output.id, routeId: route.id };
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
