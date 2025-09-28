import { EventEmitter } from "node:events";
import type {
  AgentDefinition,
  AgentId,
  AgentRegistryEntry,
  AgentRuntimeState,
  AgentStatus,
} from "../types/index.js";

const DEFAULT_STATE: AgentRuntimeState = {
  status: "offline",
  updatedAt: Date.now(),
};

export interface AgentRegistryEvents {
  registered: (entry: AgentRegistryEntry) => void;
  unregistered: (agentId: AgentId) => void;
  stateChanged: (agentId: AgentId, state: AgentRuntimeState) => void;
}

export type AgentRegistryEventName = keyof AgentRegistryEvents;

type AgentRegistryEventHandler<T extends AgentRegistryEventName> = AgentRegistryEvents[T];

export class AgentRegistry extends EventEmitter {
  private readonly entries = new Map<AgentId, AgentRegistryEntry>();

  register(definition: AgentDefinition): AgentRegistryEntry {
    const existing = this.entries.get(definition.id);

    if (existing && definition.singleton) {
      throw new Error(
        "Agent " + definition.id + " already registered as singleton."
      );
    }

    const entry: AgentRegistryEntry = {
      definition,
      state: existing?.state ?? { ...DEFAULT_STATE },
    };

    this.entries.set(definition.id, entry);
    this.emit("registered", entry);
    return entry;
  }

  unregister(agentId: AgentId): boolean {
    const didDelete = this.entries.delete(agentId);
    if (didDelete) {
      this.emit("unregistered", agentId);
    }
    return didDelete;
  }

  updateState(agentId: AgentId, state: Partial<AgentRuntimeState>): AgentRuntimeState {
    const entry = this.entries.get(agentId);
    if (!entry) {
      throw new Error("Agent " + agentId + " is not registered.");
    }

    entry.state = {
      ...entry.state,
      ...state,
      updatedAt: Date.now(),
    };

    this.emit("stateChanged", agentId, entry.state);
    return entry.state;
  }

  setStatus(agentId: AgentId, status: AgentStatus, error?: string): AgentRuntimeState {
    return this.updateState(agentId, { status, error });
  }

  updateResources(
    agentId: AgentId,
    usage: AgentRuntimeState["resourceUsage"]
  ): AgentRuntimeState {
    return this.updateState(agentId, { resourceUsage: usage });
  }

  get(agentId: AgentId): AgentRegistryEntry | undefined {
    return this.entries.get(agentId);
  }

  list(): AgentRegistryEntry[] {
    return Array.from(this.entries.values());
  }

  has(agentId: AgentId): boolean {
    return this.entries.has(agentId);
  }

  on<T extends AgentRegistryEventName>(event: T, handler: AgentRegistryEventHandler<T>): this {
    return super.on(event, handler as never);
  }
}
