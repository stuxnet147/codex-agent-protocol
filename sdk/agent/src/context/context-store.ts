import { randomUUID } from "node:crypto";
import type { ContextSnapshot, ContextStore } from "../types/index.js";

interface NamespaceStorage {
  [key: string]: unknown;
}

export class InMemoryContextStore implements ContextStore {
  private readonly namespaces = new Map<string, NamespaceStorage>();

  set(namespace: string, key: string, value: unknown): void {
    const store = this.namespaces.get(namespace) ?? {};
    store[key] = value;
    this.namespaces.set(namespace, store);
  }

  get<T = unknown>(namespace: string, key: string): T | undefined {
    const store = this.namespaces.get(namespace);
    if (!store) {
      return undefined;
    }
    return store[key] as T | undefined;
  }

  delete(namespace: string, key: string): void {
    const store = this.namespaces.get(namespace);
    if (!store) {
      return;
    }
    delete store[key];
    if (Object.keys(store).length === 0) {
      this.namespaces.delete(namespace);
    } else {
      this.namespaces.set(namespace, store);
    }
  }

  snapshot(namespace: string): ContextSnapshot {
    const store = this.namespaces.get(namespace) ?? {};
    const data = { ...store };
    return {
      id: randomUUID(),
      createdAt: Date.now(),
      data,
    };
  }

  listNamespaces(): string[] {
    return Array.from(this.namespaces.keys());
  }

  clear(): void {
    this.namespaces.clear();
  }
}
