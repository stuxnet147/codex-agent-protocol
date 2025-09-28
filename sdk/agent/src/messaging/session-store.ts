import { randomUUID } from "node:crypto";
import type { AgentId, SessionRecord } from "../types/index.js";

export class SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();

  create(ttlMs?: number, seedContext?: Record<string, unknown>): SessionRecord {
    const id = randomUUID();
    const now = Date.now();
    const session: SessionRecord = {
      id,
      createdAt: now,
      ttlMs,
      expiresAt: ttlMs ? now + ttlMs : undefined,
      context: { ...(seedContext ?? {}) },
      agents: new Set<AgentId>(),
    };
    this.sessions.set(id, session);
    return session;
  }

  attachAgent(sessionId: string, agentId: AgentId): void {
    const session = this.require(sessionId);
    session.agents.add(agentId);
  }

  detachAgent(sessionId: string, agentId: AgentId): void {
    const session = this.require(sessionId);
    session.agents.delete(agentId);
  }

  get(sessionId: string): SessionRecord | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }
    if (this.isExpired(session)) {
      this.sessions.delete(sessionId);
      return undefined;
    }
    return session;
  }

  setContext(sessionId: string, key: string, value: unknown): void {
    const session = this.require(sessionId);
    session.context[key] = value;
  }

  getContext<T = unknown>(sessionId: string, key: string): T | undefined {
    const session = this.require(sessionId);
    return session.context[key] as T | undefined;
  }

  extend(sessionId: string, ttlMs: number): void {
    const session = this.require(sessionId);
    session.ttlMs = ttlMs;
    session.expiresAt = Date.now() + ttlMs;
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  sweep(): void {
    const iterator = this.sessions.entries();
    let current = iterator.next();
    while (!current.done) {
      const [id, session] = current.value;
      if (this.isExpired(session)) {
        this.sessions.delete(id);
      }
      current = iterator.next();
    }
  }

  list(): SessionRecord[] {
    this.sweep();
    return Array.from(this.sessions.values());
  }

  private require(sessionId: string): SessionRecord {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Unknown session " + sessionId);
    }
    if (this.isExpired(session)) {
      this.sessions.delete(sessionId);
      throw new Error("Session " + sessionId + " is expired.");
    }
    return session;
  }

  private isExpired(session: SessionRecord): boolean {
    return Boolean(session.expiresAt && session.expiresAt <= Date.now());
  }
}
