import { v4 as uuidv4 } from 'uuid';

import type { DomainEvent } from './types';

/** Canonical domain event names (dot notation) */
export const DomainEventType = {
  GATEWAY_RECONCILIATION_REQUIRED: 'gateway.reconciliation.required',
  STREAM_STARTED: 'stream.started',
  STREAM_STOPPED: 'stream.stopped',
  ROUTE_CREATED: 'route.created',
  ROUTE_UPDATED: 'route.updated',
  ROUTE_DELETED: 'route.deleted',
  RECORDING_FINALIZED: 'recording.finalized',
} as const;

export type DomainEventTypeName = (typeof DomainEventType)[keyof typeof DomainEventType];

export function createDomainEvent(params: {
  eventType: DomainEventTypeName;
  aggregateId: string;
  aggregateType: string;
  data: Record<string, unknown>;
}): DomainEvent {
  return {
    eventId: uuidv4(),
    eventType: params.eventType,
    timestamp: new Date(),
    aggregateId: params.aggregateId,
    aggregateType: params.aggregateType,
    data: params.data,
  };
}

export function gatewayReconciliationRequired(
  organizationId: string,
  reason: string,
  metadata?: Record<string, unknown>
): DomainEvent {
  return createDomainEvent({
    eventType: DomainEventType.GATEWAY_RECONCILIATION_REQUIRED,
    aggregateId: organizationId,
    aggregateType: 'Organization',
    data: { organizationId, reason, ...metadata },
  });
}

export function streamStarted(
  sessionId: string,
  organizationId: string,
  inputId: string,
  streamKey: string
): DomainEvent {
  return createDomainEvent({
    eventType: DomainEventType.STREAM_STARTED,
    aggregateId: sessionId,
    aggregateType: 'LiveSession',
    data: { organizationId, inputId, streamKey },
  });
}

export function streamStopped(
  sessionId: string,
  organizationId: string,
  inputId: string,
  streamKey: string
): DomainEvent {
  return createDomainEvent({
    eventType: DomainEventType.STREAM_STOPPED,
    aggregateId: sessionId,
    aggregateType: 'LiveSession',
    data: { organizationId, inputId, streamKey },
  });
}
