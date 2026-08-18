// socketHub.ts
// Decouples the service/controller layers from Socket.IO: feature code
// emits domain events here, and server.ts forwards them to the
// subscribed dashboard clients. Services stay framework-agnostic.

import { EventEmitter } from 'events';

export const ruleEvents = new EventEmitter();

/** Notify subscribed dashboards that a child's block rules changed. */
export const emitRuleChange = (childId: string): void => {
  ruleEvents.emit('rule:changed', childId);
};