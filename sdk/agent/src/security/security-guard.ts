import { resolve } from "node:path";
import type { Capability, SecurityDescriptor } from "../types/index.js";

export class SecurityGuard {
  private readonly descriptors = new Map<string, SecurityDescriptor>();

  register(descriptor: SecurityDescriptor): void {
    this.descriptors.set(descriptor.agentId, descriptor);
  }

  unregister(agentId: string): void {
    this.descriptors.delete(agentId);
  }

  assertCapability(agentId: string, capability: Capability): void {
    const descriptor = this.require(agentId);
    if (!descriptor.capabilities.includes(capability)) {
      throw new Error(
        "Agent " + agentId + " lacks capability " + capability + "."
      );
    }
  }

  assertFsAccess(agentId: string, targetPath: string): void {
    const descriptor = this.require(agentId);
    if (!descriptor.capabilities.includes("readFs")) {
      throw new Error("Agent " + agentId + " cannot access filesystem.");
    }
    if (!descriptor.fsAllowList || descriptor.fsAllowList.length === 0) {
      return;
    }
    const normalizedTarget = resolve(targetPath);
    const allowed = descriptor.fsAllowList.some((allowedPath) => {
      const normalizedAllowed = resolve(allowedPath);
      return normalizedTarget.startsWith(normalizedAllowed);
    });
    if (!allowed) {
      throw new Error("Path " + targetPath + " is not permitted.");
    }
  }

  assertExec(agentId: string, binaryPath: string): void {
    const descriptor = this.require(agentId);
    if (!descriptor.capabilities.includes("exec")) {
      throw new Error("Agent " + agentId + " cannot execute processes.");
    }
    if (!descriptor.execAllowList || descriptor.execAllowList.length === 0) {
      return;
    }
    const normalizedBinary = resolve(binaryPath);
    const allowed = descriptor.execAllowList.some((allowedPath) => {
      return resolve(allowedPath) === normalizedBinary;
    });
    if (!allowed) {
      throw new Error("Binary " + binaryPath + " is not permitted.");
    }
  }

  assertNetworkOutbound(agentId: string): void {
    const descriptor = this.require(agentId);
    if (!descriptor.capabilities.includes("netOutbound")) {
      throw new Error("Agent " + agentId + " cannot access outbound network.");
    }
    if (descriptor.allowNetworkOutbound === false) {
      throw new Error("Outbound network access disabled for agent " + agentId + ".");
    }
  }

  assertNetworkInbound(agentId: string): void {
    const descriptor = this.require(agentId);
    if (!descriptor.capabilities.includes("netInbound")) {
      throw new Error("Agent " + agentId + " cannot receive inbound network.");
    }
    if (descriptor.allowNetworkInbound === false) {
      throw new Error("Inbound network access disabled for agent " + agentId + ".");
    }
  }

  private require(agentId: string): SecurityDescriptor {
    const descriptor = this.descriptors.get(agentId);
    if (!descriptor) {
      throw new Error("Security descriptor missing for agent " + agentId + ".");
    }
    return descriptor;
  }
}
