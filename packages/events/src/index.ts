// Domain events for HydroFoil

import { v4 as uuidv4 } from 'uuid';

export * from './types';
export * from './domain-events';

import type { DomainEvent } from './types';

export class EventBus {
  private listeners: Map<string, Function[]> = new Map();

  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(handler);
  }

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.listeners.get(event.eventType) || [];
    await Promise.all(handlers.map((handler) => handler(event)));
  }
}

// Domain Events
export namespace Events {
  export function inputCreated(inputId: string, _organizationId: string, data: Record<string, unknown>): DomainEvent {
    return {
      eventId: uuidv4(),
      eventType: 'InputCreated',
      timestamp: new Date(),
      aggregateId: inputId,
      aggregateType: 'Input',
      data,
    };
  }

  export function outputCreated(outputId: string, _organizationId: string, data: Record<string, unknown>): DomainEvent {
    return {
      eventId: uuidv4(),
      eventType: 'OutputCreated',
      timestamp: new Date(),
      aggregateId: outputId,
      aggregateType: 'Output',
      data,
    };
  }

  export function routeCreated(routeId: string, _organizationId: string, data: Record<string, unknown>): DomainEvent {
    return {
      eventId: uuidv4(),
      eventType: 'RouteCreated',
      timestamp: new Date(),
      aggregateId: routeId,
      aggregateType: 'Route',
      data,
    };
  }

  export function liveSessionStarted(sessionId: string, organizationId: string, inputId: string): DomainEvent {
    return {
      eventId: uuidv4(),
      eventType: 'LiveSessionStarted',
      timestamp: new Date(),
      aggregateId: sessionId,
      aggregateType: 'LiveSession',
      data: { organizationId, inputId },
    };
  }

  export function liveSessionEnded(sessionId: string, organizationId: string, inputId: string): DomainEvent {
    return {
      eventId: uuidv4(),
      eventType: 'LiveSessionEnded',
      timestamp: new Date(),
      aggregateId: sessionId,
      aggregateType: 'LiveSession',
      data: { organizationId, inputId },
    };
  }

  export function recordingStarted(recordingId: string, organizationId: string, sessionId: string): DomainEvent {
    return {
      eventId: uuidv4(),
      eventType: 'RecordingStarted',
      timestamp: new Date(),
      aggregateId: recordingId,
      aggregateType: 'RecordingAsset',
      data: { organizationId, sessionId },
    };
  }

  export function recordingFinalized(recordingId: string, organizationId: string, objectKey: string): DomainEvent {
    return {
      eventId: uuidv4(),
      eventType: 'RecordingFinalized',
      timestamp: new Date(),
      aggregateId: recordingId,
      aggregateType: 'RecordingAsset',
      data: { organizationId, objectKey },
    };
  }

  export function audioAssetGenerated(audioId: string, organizationId: string, recordingId: string): DomainEvent {
    return {
      eventId: uuidv4(),
      eventType: 'AudioAssetGenerated',
      timestamp: new Date(),
      aggregateId: audioId,
      aggregateType: 'GeneratedAudioAsset',
      data: { organizationId, recordingId },
    };
  }

  export function configReconcilationRequired(organizationId: string): DomainEvent {
    return {
      eventId: uuidv4(),
      eventType: 'ConfigReconcilationRequired',
      timestamp: new Date(),
      aggregateId: organizationId,
      aggregateType: 'Organization',
      data: { organizationId },
    };
  }
}
