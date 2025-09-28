import { randomUUID } from "node:crypto";
import type { AgentId, MessageEnvelope } from "../types/index.js";

export type MessageHandler<T = unknown> = (message: MessageEnvelope<T>) => void;

interface Subscription {
  topic: string;
  handler: MessageHandler;
}

export class MessageBus {
  private readonly topics = new Map<string, Set<MessageHandler>>();
  private readonly direct = new Map<AgentId, Set<MessageHandler>>();

  publish<T>(topic: string, payload: T, sessionId?: string): MessageEnvelope<T> {
    const envelope: MessageEnvelope<T> = {
      id: randomUUID(),
      topic,
      payload,
      sessionId,
      type: "broadcast",
      timestamp: Date.now(),
    };
    this.dispatch(topic, envelope);
    return envelope;
  }

  sendToAgent<T>(agentId: AgentId, payload: T, sessionId?: string): MessageEnvelope<T> {
    const envelope: MessageEnvelope<T> = {
      id: randomUUID(),
      topic: agentId,
      payload,
      sessionId,
      type: "direct",
      timestamp: Date.now(),
    };
    this.dispatchDirect(agentId, envelope);
    return envelope;
  }

  subscribe(topic: string, handler: MessageHandler): Subscription {
    const handlers = this.topics.get(topic) ?? new Set<MessageHandler>();
    handlers.add(handler);
    this.topics.set(topic, handlers);
    return { topic, handler };
  }

  subscribeAgent(agentId: AgentId, handler: MessageHandler): Subscription {
    const handlers = this.direct.get(agentId) ?? new Set<MessageHandler>();
    handlers.add(handler);
    this.direct.set(agentId, handlers);
    return { topic: agentId, handler };
  }

  unsubscribe(subscription: Subscription): void {
    const set = this.topics.get(subscription.topic);
    if (set) {
      set.delete(subscription.handler);
      if (set.size === 0) {
        this.topics.delete(subscription.topic);
      }
    }
    const directSet = this.direct.get(subscription.topic as AgentId);
    if (directSet) {
      directSet.delete(subscription.handler);
      if (directSet.size === 0) {
        this.direct.delete(subscription.topic as AgentId);
      }
    }
  }

  private dispatch<T>(topic: string, message: MessageEnvelope<T>): void {
    const handlers = this.topics.get(topic);
    if (!handlers) {
      return;
    }
    handlers.forEach((handler) => handler(message));
  }

  private dispatchDirect<T>(agentId: AgentId, message: MessageEnvelope<T>): void {
    const handlers = this.direct.get(agentId);
    if (!handlers) {
      return;
    }
    handlers.forEach((handler) => handler(message));
  }
}
