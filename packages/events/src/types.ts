export interface DomainEvent {
  eventId: string;
  eventType: string;
  timestamp: Date;
  aggregateId: string;
  aggregateType: string;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}
