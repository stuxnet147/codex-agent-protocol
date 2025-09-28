import {
  AgentRegistry,
  CodexClient,
  MessageBus,
  SecurityGuard,
  WorkflowEngine,
  type WorkflowContext,
} from "../src/index.js";

const cliPath = process.env.CODEX_CLI_PATH;
const commandPath = process.env.CODEX_COMMAND_PATH;
const commandArgs = process.env.CODEX_COMMAND_ARGS
  ? process.env.CODEX_COMMAND_ARGS.split(/\s+/).filter(Boolean)
  : undefined;

const registry = new AgentRegistry();
const security = new SecurityGuard();
const bus = new MessageBus();
const workflows = new WorkflowEngine();

const agentId = "example:planner";

registry.register({
  id: agentId,
  name: "Planning Agent",
  capabilities: ["readFs", "exec"],
});

security.register({
  agentId,
  capabilities: ["readFs", "exec"],
  fsAllowList: [process.cwd()],
  execAllowList: [],
  allowNetworkOutbound: false,
  allowNetworkInbound: false,
});

bus.subscribe("codex/events", (envelope) => {
  console.log("[bus] codex event", envelope.payload);
});

const context: WorkflowContext = {
  contextStore: {
    set() {},
    get() {
      return undefined;
    },
    delete() {},
    snapshot(namespace) {
      return {
        id: namespace,
        createdAt: Date.now(),
        data: {},
      };
    },
  },
};

async function main(): Promise<void> {
  const codex = new CodexClient({
    cliPath,
    commandPath,
    commandArgs,
    cwd: process.cwd(),
    autoRestart: true,
    responseTimeoutMs: 15_000,
  });

  codex.on("protocolError", (error) => {
    console.warn("[codex] protocol error", error);
  });

  codex.on("restarted", (attempt) => {
    console.info(`[codex] restart attempt ${attempt}`);
  });

  codex.on("notification", (payload) => {
    bus.publish("codex/events", payload);
  });

  try {
    await codex.start();
  } catch (error) {
    console.warn(
      "Codex CLI unavailable. Set CODEX_CLI_PATH to override the default binary.",
      error
    );
    return;
  }

  const summary = await workflows.run(
    [
      {
        id: "codex-status",
        async run() {
          const result = await codex.exec<{ status: string }>({ op: "status" });
          if (!result.ok) {
            throw new Error(result.error ?? "Unknown Codex error");
          }
          bus.publish("codex/events", result.data);
          return result.data;
        },
        rollback: async () => {
          try {
            await codex.exec({ op: "cancel" });
          } catch {
            // Intentionally swallow rollback failures in the example.
          }
        },
      },
    ],
    context,
    {
      onTaskComplete(node, data) {
        console.log(`[workflow] ${node} complete`, data);
      },
      onTaskError(node, error) {
        console.error(`[workflow] ${node} failed`, error);
      },
    }
  );

  console.log("Workflow summary", {
    completed: Array.from(summary.completed),
    failed: Array.from(summary.failed.keys()),
    durationMs: summary.finishedAt! - summary.startedAt,
  });

  codex.stop();
}

main().catch((error) => {
  console.error("Example failed", error);
  process.exitCode = 1;
});
