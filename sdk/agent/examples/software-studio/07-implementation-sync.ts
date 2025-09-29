import { createSoftwareCompanyEnvironment, simulateAgentAction } from "./shared.js";

async function main(): Promise<void> {
  const env = createSoftwareCompanyEnvironment();
  env.registerAgents();

  const stopTimeline = env.monitorTopic("studio.timeline", "timeline");
  const stopArchitect = env.monitorDirect("agent:architect", "architect");
  const stopEngineer = env.monitorDirect("agent:engineer", "engineer");
  const stopDevops = env.monitorDirect("agent:devops", "devops");

  const sessionId = "session:implementation-sync";
  const context = env.createContext(sessionId);

  try {
    await env.workflows.run(
      [
        {
          id: "architect-handshake",
          async run() {
            const guidance = await simulateAgentAction({
              env,
              agentId: "agent:architect",
              detail: "Architect clarified integration contracts for services.",
              result: {
                contracts: [
                  { service: "aggregation-service", schema: "accounts.v1" },
                  { service: "alert-orchestrator", schema: "signals.v1" },
                ],
              },
              sessionId,
            });
            context.contextStore.set("architecture", "contracts", guidance);
            return guidance;
          },
        },
        {
          id: "engineer-foundation",
          dependsOn: ["architect-handshake"],
          async run() {
            const foundation = await simulateAgentAction({
              env,
              agentId: "agent:engineer",
              detail: "Engineer implemented aggregation foundation with feature toggles.",
              result: {
                modules: ["ingest-adapters", "data-normaliser"],
                coverage: 0.78,
              },
              sessionId,
            });
            context.contextStore.set("delivery", "foundation", foundation);
            return foundation;
          },
        },
        {
          id: "engineer-alerts",
          dependsOn: ["engineer-foundation"],
          async run() {
            const alerts = await simulateAgentAction({
              env,
              agentId: "agent:engineer",
              detail: "Engineer wired alert orchestrator with rule templates.",
              result: {
                rules: ["holding-delta", "cash-balance"],
                latencyMs: 340,
              },
              sessionId,
            });
            context.contextStore.set("delivery", "alerts", alerts);
            return alerts;
          },
        },
        {
          id: "devops-ci",
          dependsOn: ["engineer-alerts"],
          async run() {
            const ci = await simulateAgentAction({
              env,
              agentId: "agent:devops",
              detail: "Release engineer updated pipeline to include new services.",
              result: {
                workflows: ["ci.yml", "deploy-preview.yml"],
                status: "green",
              },
              sessionId,
            });
            context.contextStore.set("operations", "ci", ci);
            return ci;
          },
        },
      ],
      context,
      {
        concurrency: 1,
        onTaskComplete(task, result) {
          console.log(`[workflow] ${task} complete`, result);
        },
      }
    );

    console.log("Implementation snapshot", {
      contracts: context.contextStore.get("architecture", "contracts"),
      foundation: context.contextStore.get("delivery", "foundation"),
      alerts: context.contextStore.get("delivery", "alerts"),
      ci: context.contextStore.get("operations", "ci"),
    });
  } finally {
    stopTimeline();
    stopArchitect();
    stopEngineer();
    stopDevops();
  }
}

main().catch((error) => {
  console.error("Implementation sync example failed", error);
  process.exitCode = 1;
});
