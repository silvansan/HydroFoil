import { isExternalPushTarget, isSrtPushTarget, isWatchOutputName } from '@hydrofoil/domain';
import { resolveForwardRtmpUrl } from '@hydrofoil/domain';
import type { Input, Output, Route } from '@hydrofoil/shared-types';

import { config } from '../config';

export interface RestreamDestinationDto {
  id: string;
  name: string;
  enabled: boolean;
  kind: 'local_watch' | 'local_mirror' | 'external';
  delivery: 'hls' | 'http-flv' | 'rtmp' | 'srt';
  copyUrl: string;
  routeTarget: string;
  gatewayApp?: string;
  gatewayStream?: string;
  externalUrl?: string;
  isSystem: boolean;
  routeId?: string;
}

export interface RestreamGroupDto {
  input: Input;
  destinations: RestreamDestinationDto[];
}

export function toRestreamDestination(
  output: Output,
  _input: Input,
  routeId?: string
): RestreamDestinationDto {
  const gatewayApp = output.gatewayAppName;
  const gatewayStream = output.gatewayStreamName;
  const isSystem = isWatchOutputName(output.name);

  let kind: RestreamDestinationDto['kind'];
  let delivery: RestreamDestinationDto['delivery'];

  if (isSystem) {
    kind = 'local_watch';
    delivery = 'hls';
  } else if (isSrtPushTarget(output.routeTarget)) {
    kind = 'external';
    delivery = 'srt';
  } else if (isExternalPushTarget(output.routeTarget)) {
    kind = 'external';
    delivery = 'rtmp';
  } else {
    kind = 'local_mirror';
    delivery =
      output.playbackProtocol === 'http-flv'
        ? 'http-flv'
        : output.playbackProtocol === 'rtmp'
          ? 'rtmp'
          : 'hls';
  }

  const copyUrl =
    kind === 'external'
      ? output.routeTarget.trim()
      : kind === 'local_watch'
        ? output.routeTarget
        : resolveForwardRtmpUrl(
            {
              app: gatewayApp,
              stream: gatewayStream,
              routeTarget: output.routeTarget,
            },
            config.srsRtmpForwardBase
          );

  return {
    id: output.id,
    name: output.name,
    enabled: output.enabled,
    kind,
    delivery,
    copyUrl,
    routeTarget: output.routeTarget,
    gatewayApp,
    gatewayStream,
    externalUrl: kind === 'external' ? output.routeTarget.trim() : undefined,
    isSystem,
    routeId,
  };
}

export function buildRestreamGroups(
  inputs: Input[],
  routes: Route[],
  outputs: Output[]
): RestreamGroupDto[] {
  const outputById = new Map(outputs.map((o) => [o.id, o]));
  const inputById = new Map(inputs.map((i) => [i.id, i]));

  const destByInput = new Map<string, Map<string, RestreamDestinationDto>>();

  for (const route of routes) {
    const input = inputById.get(route.inputId);
    if (!input) continue;

    for (const outputId of route.outputIds) {
      const output = outputById.get(outputId);
      if (!output) continue;

      if (!destByInput.has(input.id)) {
        destByInput.set(input.id, new Map());
      }
      const bucket = destByInput.get(input.id)!;
      bucket.set(output.id, toRestreamDestination(output, input, route.id));
    }
  }

  return inputs
    .map((input) => {
      const bucket = destByInput.get(input.id);
      const destinations = bucket
        ? [...bucket.values()].sort((a, b) => {
            if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
            return a.name.localeCompare(b.name);
          })
        : [];
      return { input, destinations };
    })
    .sort((a, b) => {
      const appA = a.input.application?.name ?? '';
      const appB = b.input.application?.name ?? '';
      if (appA !== appB) return appA.localeCompare(appB);
      return a.input.name.localeCompare(b.input.name);
    });
}

export { isWatchOutputName, isExternalPushTarget, isSrtPushTarget };
