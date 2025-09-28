import { describe, expect, it, vi } from "vitest";
import { MessageBus } from "../src/messaging/message-bus.js";

describe("MessageBus", () => {
  it("delivers broadcast messages to subscribed handlers", () => {
    const bus = new MessageBus();
    const handler = vi.fn();
    bus.subscribe("workflow:update", handler);

    const envelope = bus.publish("workflow:update", { step: 1 }, "session-1");

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(envelope);
    expect(envelope.type).toBe("broadcast");
    expect(envelope.sessionId).toBe("session-1");
  });

  it("delivers direct messages and can unsubscribe handlers", () => {
    const bus = new MessageBus();
    const directHandler = vi.fn();
    const subscription = bus.subscribeAgent("agent-123", directHandler);

    const envelope = bus.sendToAgent("agent-123", { hello: true });
    expect(directHandler).toHaveBeenCalledWith(envelope);
    expect(envelope.type).toBe("direct");

    bus.unsubscribe(subscription);
    bus.sendToAgent("agent-123", { hello: false });
    expect(directHandler).toHaveBeenCalledTimes(1);
  });

  it("isolates topics between broadcast and direct subscriptions", () => {
    const bus = new MessageBus();
    const broadcastHandler = vi.fn();
    const directHandler = vi.fn();

    bus.subscribe("agent-xyz", broadcastHandler);
    bus.subscribeAgent("agent-xyz", directHandler);

    bus.publish("agent-xyz", { from: "broadcast" });
    bus.sendToAgent("agent-xyz", { from: "direct" });

    expect(broadcastHandler).toHaveBeenCalledTimes(1);
    expect(directHandler).toHaveBeenCalledTimes(1);
    expect(
      broadcastHandler.mock.calls[0]?.[0]?.type ?? ""
    ).toBe("broadcast");
    expect(directHandler.mock.calls[0]?.[0]?.type ?? "").toBe("direct");
  });
});
