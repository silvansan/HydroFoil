import type { Output, Route } from '@hydrofoil/shared-types';
import { isSrtPushTarget } from '@hydrofoil/domain';
import {
  enqueueStartRestreamPush,
  enqueueStopRestreamPush,
  JobType,
  QueueManager,
  type RestreamPushDestination,
  type StartRestreamPushJob,
  type StopRestreamPushJob,
} from '@hydrofoil/queue';
import type { Queue } from '@hydrofoil/queue';
import pino from 'pino';

import { config } from '../config';

const logger = pino({ name: 'restream-orchestrator' });

function rtmpSourceUrl(gatewayApp: string, streamKey: string): string {
  const base = config.srsRtmpReadBase.replace(/\/$/, '');
  const app = gatewayApp.replace(/^\/+|\/+$/g, '') || 'live';
  const stream = streamKey.replace(/^\/+|\/+$/g, '');
  return `${base}/${app}/${stream}`;
}

function collectSrtDestinations(
  routes: Route[],
  outputs: Output[],
  inputId: string
): RestreamPushDestination[] {
  const outputById = new Map(outputs.map((o) => [o.id, o]));
  const destinations: RestreamPushDestination[] = [];

  for (const route of routes) {
    if (!route.enabled || route.inputId !== inputId) continue;
    for (const outputId of route.outputIds) {
      const output = outputById.get(outputId);
      if (!output?.enabled) continue;
      if (!isSrtPushTarget(output.routeTarget)) continue;
      destinations.push({
        destinationId: String(output.id),
        pushUrl: output.routeTarget.trim(),
        name: output.name,
      });
    }
  }

  return destinations;
}

export class RestreamOrchestrator {
  private readonly startQueue: Queue<StartRestreamPushJob>;
  private readonly stopQueue: Queue<StopRestreamPushJob>;

  constructor(queueManager: QueueManager) {
    this.startQueue = queueManager.createQueue(JobType.START_RESTREAM_PUSH);
    this.stopQueue = queueManager.createQueue(JobType.STOP_RESTREAM_PUSH);
  }

  async startSrtPushes(params: {
    sessionId: string;
    inputId: string;
    organizationId: string;
    gatewayApp: string;
    streamKey: string;
    repos: {
      routes: { listAll: (orgId: string) => Promise<Route[]> };
      outputs: { listAll: (orgId: string) => Promise<Output[]> };
    };
  }): Promise<void> {
    const [routes, outputs] = await Promise.all([
      params.repos.routes.listAll(params.organizationId),
      params.repos.outputs.listAll(params.organizationId),
    ]);

    const destinations = collectSrtDestinations(routes, outputs, params.inputId);
    if (destinations.length === 0) return;

    await enqueueStartRestreamPush(this.startQueue, {
      sessionId: params.sessionId,
      inputId: params.inputId,
      organizationId: params.organizationId,
      gatewayApp: params.gatewayApp,
      streamKey: params.streamKey,
      sourceUrl: rtmpSourceUrl(params.gatewayApp, params.streamKey),
      destinations,
    });

    logger.info(
      { sessionId: params.sessionId, streamKey: params.streamKey, count: destinations.length },
      'SRT restream push job enqueued'
    );
  }

  async stopSrtPushes(sessionId: string): Promise<void> {
    await enqueueStopRestreamPush(this.stopQueue, { sessionId });
    logger.info({ sessionId }, 'SRT restream stop job enqueued');
  }
}
