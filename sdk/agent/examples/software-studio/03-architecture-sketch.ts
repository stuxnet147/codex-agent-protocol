import { createSoftwareCompanyEnvironment, simulateAgentAction } from "./shared.js";

async function main(): Promise<void> {
  const env = createSoftwareCompanyEnvironment();
  env.registerAgents();

  const stopTimeline = env.monitorTopic("studio.timeline", "timeline");
  const stopPlanner = env.monitorDirect("agent:planner", "planner");
  const stopArchitect = env.monitorDirect("agent:architect", "architect");
  const stopEngineer = env.monitorDirect("agent:engineer", "engineer");
  const stopDevops = env.monitorDirect("agent:devops", "devops");

  const sessionId = "session:architecture-sketch";
  const context = env.createContext(sessionId);

  try {
    await env.workflows.run(
      [
        {
          id: "prepare-scope",
          async run() {
            const scope = await simulateAgentAction({
              env,
              agentId: "agent:planner",
              detail: "Planner refined the scope of the MVP modules.",
              result: {
                modules: ["Aggregation", "Alerting", "Copilot"],
                constraints: ["SOC2 ready", "Supports 50k accounts"],
              },
              sessionId,
            });
            context.contextStore.set("planning", "scope", scope);
            return scope;
          },
        },
        {
          id: "draft-architecture",
          dependsOn: ["prepare-scope"],
          async run() {
            const scope = context.contextStore.get<{ modules: string[] }>(
              "planning",
              "scope"
            );
            const blueprint = await simulateAgentAction({
              env,
              agentId: "agent:architect",
              detail: "Architect produced the initial system topology.",
              result: {
                services: [
                  { name: "aggregation-service", pattern: "event-driven" },
                  { name: "alert-orchestrator", pattern: "queue-consumer" },
                  { name: "copilot-service", pattern: "LLM gateway" },
                ],
                modules: scope?.modules,
              },
              sessionId,
            });
            context.contextStore.set("architecture", "blueprint", blueprint);
            return blueprint;
          },
        },
        {
          id: "devops-readiness",
          dependsOn: ["prepare-scope"],
          async run() {
            const readiness = await simulateAgentAction({
              env,
              agentId: "agent:devops",
              detail: "Release engineer prepared the deployment checklist draft.",
              result: {
                ci: "GitHub Actions baseline",
                environments: ["preview", "staging", "production"],
              },
              sessionId,
            });
            context.contextStore.set("operations", "readiness", readiness);
            return readiness;
          },
        },
        {
          id: "engineering-estimate",
          dependsOn: ["draft-architecture", "devops-readiness"],
          async run() {
            const blueprint = context.contextStore.get("architecture", "blueprint");
            const readiness = context.contextStore.get("operations", "readiness");
            const estimate = await simulateAgentAction({
              env,
              agentId: "agent:engineer",
              detail: "Engineer mapped components into implementation phases.",
              result: {
                phases: [
                  { name: "Foundation", points: 8 },
                  { name: "Signals", points: 13 },
                  { name: "Copilot", points: 8 },
                ],
                dependencies: [blueprint, readiness],
              },
              sessionId,
            });
            context.contextStore.set("delivery", "estimate", estimate);
            return estimate;
          },
        },
      ],
      context,
      {
        concurrency: 2,
        onTaskComplete(task) {
          console.log(`[workflow] ${task} complete`);
        },
      }
    );

    console.log("Architecture package", {
      blueprint: context.contextStore.get("architecture", "blueprint"),
      readiness: context.contextStore.get("operations", "readiness"),
      estimate: context.contextStore.get("delivery", "estimate"),
    });
  } finally {
    stopTimeline();
    stopPlanner();
    stopArchitect();
    stopEngineer();
    stopDevops();
  }
}

main().catch((error) => {
  console.error("Architecture sketch example failed", error);
  process.exitCode = 1;
});
