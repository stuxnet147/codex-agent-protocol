import { resolve, join } from "node:path";
import { describe, expect, it } from "vitest";
import { SecurityGuard } from "../src/security/security-guard.js";

describe("SecurityGuard", () => {
  it("enforces capability and filesystem policies", () => {
    const guard = new SecurityGuard();
    const baseDir = resolve(process.cwd(), "tmp-allowed");
    const safeBinary = resolve(process.cwd(), "bin", "safe.sh");

    guard.register({
      agentId: "agent-secure",
      capabilities: ["readFs", "exec", "netOutbound"],
      fsAllowList: [baseDir],
      execAllowList: [safeBinary],
      allowNetworkOutbound: true,
    });

    guard.assertCapability("agent-secure", "readFs");

    const allowedPath = join(baseDir, "data.json");
    expect(() => guard.assertFsAccess("agent-secure", allowedPath)).not.toThrow();

    const forbiddenPath = resolve(baseDir, "..", "restricted.txt");
    expect(() => guard.assertFsAccess("agent-secure", forbiddenPath)).toThrow(
      /not permitted/
    );

    expect(() => guard.assertExec("agent-secure", safeBinary)).not.toThrow();
    expect(() =>
      guard.assertExec("agent-secure", resolve(process.cwd(), "bin", "other.sh"))
    ).toThrow(/not permitted/);

    expect(() => guard.assertNetworkOutbound("agent-secure")).not.toThrow();
  });

  it("blocks network access when disabled", () => {
    const guard = new SecurityGuard();
    guard.register({
      agentId: "agent-network",
      capabilities: ["netInbound", "netOutbound"],
      allowNetworkInbound: false,
      allowNetworkOutbound: false,
    });

    expect(() => guard.assertNetworkInbound("agent-network")).toThrow(
      /disabled/
    );
    expect(() => guard.assertNetworkOutbound("agent-network")).toThrow(
      /disabled/
    );
  });
});
