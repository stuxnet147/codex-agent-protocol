import type { ContextStore, PromptPackage } from "../types/index.js";

export interface PromptPackOptions {
  namespace: string;
  keys?: string[];
  sessionId?: string;
  attachments?: Array<{ path: string; content: Buffer | string }>;
}

export function packPrompt(
  store: ContextStore,
  options: PromptPackOptions
): PromptPackage {
  const keys = options.keys ?? [];
  const entries: Array<{ key: string; value: unknown }> = [];

  if (keys.length === 0) {
    const snapshot = store.snapshot(options.namespace);
    Object.keys(snapshot.data).forEach((key) => {
      entries.push({ key, value: snapshot.data[key] });
    });
  } else {
    keys.forEach((key) => {
      const value = store.get(options.namespace, key);
      if (typeof value !== "undefined") {
        entries.push({ key, value });
      }
    });
  }

  return {
    sessionId: options.sessionId,
    entries,
    attachments: options.attachments,
  };
}
