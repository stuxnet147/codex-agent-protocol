import { IntegrationHost } from "../../src/index.js";
import { createSoftwareCompanyEnvironment, simulateAgentAction } from "./shared.js";

async function main(): Promise<void> {
  const env = createSoftwareCompanyEnvironment();
  env.registerAgents();

  const stopTimeline = env.monitorTopic("studio.timeline", "timeline");
  const stopEngineer = env.monitorDirect("agent:engineer", "engineer");
  const stopArchitect = env.monitorDirect("agent:architect", "architect");
  const stopQa = env.monitorDirect("agent:qa", "qa");

  const sessionId = "session:code-review-loop";
  const context = env.createContext(sessionId);

  const integrations = new IntegrationHost();
  integrations.register({
    name: "lint",
    capabilities: ["readFs"],
    async invoke(args: { diff: string }) {
      const warnings = args.diff.includes("TODO")
        ? ["TODO reminders detected"]
        : [];
      return { warnings };
    },
  });

  try {
    await env.workflows.run(
      [
        {
          id: "engineer-pr",
          async run() {
            const pr = await simulateAgentAction({
              env,
              agentId: "agent:engineer",
              detail: "Engineer opened pull request for anomaly feed.",
              result: {
                id: "PR-204",
                changedFiles: ["alerts/service.ts", "alerts/rules.ts"],
                diff: "refined anomaly detection and removed legacy todos",
              },
              sessionId,
            });
            context.contextStore.set("delivery", "pr", pr);
            return pr;
          },
        },
        {
          id: "automation-lint",
          dependsOn: ["engineer-pr"],
          async run() {
            const pr = context.contextStore.get<{ diff: string }>(
              "delivery",
              "pr"
            );
            const report = await integrations.invoke("lint", { diff: pr?.diff ?? "" });
            env.bus.publish("automation.reports", { tool: "lint", report }, sessionId);
            context.contextStore.set("quality", "lint", report);
            return report;
          },
        },
        {
          id: "architect-review",
          dependsOn: ["automation-lint"],
          async run() {
            const lintReport = context.contextStore.get("quality", "lint");
            const review = await simulateAgentAction({
              env,
              agentId: "agent:architect",
              detail: "Architect reviewed architecture implications of the change.",
              result: {
                status: "approved",
                notes: lintReport,
              },
              sessionId,
            });
            context.contextStore.set("architecture", "review", review);
            return review;
          },
        },
        {
          id: "qa-verdict",
          dependsOn: ["architect-review"],
          async run() {
            const review = context.contextStore.get("architecture", "review");
            const qa = await simulateAgentAction({
              env,
              agentId: "agent:qa",
              detail: "QA analyst tagged regression suite and approved merge.",
              result: {
                status: "ready-to-merge",
                review,
              },
              sessionId,
            });
            context.contextStore.set("quality", "qa-review", qa);
            return qa;
          },
        },
      ],
      context,
      {
        concurrency: 1,
        onTaskComplete(task) {
          console.log(`[workflow] ${task} complete`);
        },
      }
    );

    console.log("Code review trail", {
      pr: context.contextStore.get("delivery", "pr"),
      lint: context.contextStore.get("quality", "lint"),
      approvals: context.contextStore.get("quality", "qa-review"),
    });
  } finally {
    stopTimeline();
    stopEngineer();
    stopArchitect();
    stopQa();
  }
}

main().catch((error) => {
  console.error("Code review loop example failed", error);
  process.exitCode = 1;
});
