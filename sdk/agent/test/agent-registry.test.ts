import { describe, expect, it, vi } from "vitest";
import { AgentRegistry } from "../src/lifecycle/agent-registry.js";
import type { AgentDefinition } from "../src/types/index.js";

const baseAgent: AgentDefinition = {
  id: "agent:test",
  name: "Test Agent",
  capabilities: ["readFs"],
};

describe("AgentRegistry", () => {
  it("registers agents and emits lifecycle events", () => {
    const registry = new AgentRegistry();
    const registered = vi.fn();
    const stateChanged = vi.fn();
    registry.on("registered", registered);
    registry.on("stateChanged", stateChanged);

    const entry = registry.register(baseAgent);
    expect(entry.definition).toEqual(baseAgent);
    expect(registry.get(baseAgent.id)).toBeDefined();
    expect(registered).toHaveBeenCalledWith(entry);

    registry.setStatus(baseAgent.id, "running");
    expect(stateChanged).toHaveBeenCalled();
  });

  it("enforces singleton agents", () => {
    const registry = new AgentRegistry();
    const singletonAgent: AgentDefinition = {
      ...baseAgent,
      id: "agent:singleton",
      singleton: true,
    };

    registry.register(singletonAgent);
    expect(() => registry.register(singletonAgent)).toThrow(
      /already registered as singleton/
    );
  });

  it("updates runtime state timestamps and resources", () => {
    const registry = new AgentRegistry();
    registry.register(baseAgent);

    vi.useFakeTimers();
    const firstStamp = Date.now();
    const newState = registry.updateResources(baseAgent.id, { cpu: 0.5 });
    expect(newState.resourceUsage?.cpu).toBe(0.5);
    expect(newState.updatedAt).toBe(firstStamp);

    vi.setSystemTime(firstStamp + 1000);
    const statusState = registry.setStatus(baseAgent.id, "error", "boom");
    expect(statusState.status).toBe("error");
    expect(statusState.error).toBe("boom");
    expect(statusState.updatedAt).toBe(firstStamp + 1000);
    vi.useRealTimers();
  });

  it("unregisters agents and reports removal", () => {
    const registry = new AgentRegistry();
    const agent: AgentDefinition = { ...baseAgent, id: "agent:remove" };
    registry.register(agent);
    const unregistered = vi.fn();
    registry.on("unregistered", unregistered);

    expect(registry.unregister(agent.id)).toBe(true);
    expect(unregistered).toHaveBeenCalledWith(agent.id);
    expect(registry.get(agent.id)).toBeUndefined();
  });
});
