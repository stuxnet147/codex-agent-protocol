import { createSoftwareCompanyEnvironment, simulateAgentAction } from "./shared.js";

async function main(): Promise<void> {
  const env = createSoftwareCompanyEnvironment();
  env.registerAgents();

  const stopTimeline = env.monitorTopic("studio.timeline", "timeline");
  const stopQa = env.monitorDirect("agent:qa", "qa");
  const stopEngineer = env.monitorDirect("agent:engineer", "engineer");
  const stopDevops = env.monitorDirect("agent:devops", "devops");

  const sessionId = "session:qa-validation";
  const context = env.createContext(sessionId);

  try {
    await env.workflows.run(
      [
        {
          id: "qa-smoke-suite",
          async run() {
            const smoke = await simulateAgentAction({
              env,
              agentId: "agent:qa",
              detail: "QA analyst executed smoke suite for anomaly features.",
              result: {
                suite: "smoke",
                passed: true,
                durationMs: 92000,
              },
              sessionId,
            });
            context.contextStore.set("quality", "smoke", smoke);
            return smoke;
          },
        },
        {
          id: "engineer-bugfix",
          dependsOn: ["qa-smoke-suite"],
          retry: {
            attempts: 2,
            delayMs: 60,
          },
          async run() {
            const smoke = context.contextStore.get<{ passed: boolean }>(
              "quality",
              "smoke"
            );
            if (smoke && !smoke.passed) {
              await simulateAgentAction({
                env,
                agentId: "agent:engineer",
                detail: "Engineer patched smoke regression.",
                sessionId,
              });
              context.contextStore.set("quality", "smoke", { ...smoke, passed: true });
            }
            return context.contextStore.get("quality", "smoke");
          },
        },
        {
          id: "devops-test-env",
          async run() {
            const envReady = await simulateAgentAction({
              env,
              agentId: "agent:devops",
              detail: "Release engineer provisioned ephemeral QA environment.",
              result: {
                url: "https://qa-preview.acme.dev",
                seedData: true,
              },
              sessionId,
            });
            context.contextStore.set("operations", "qa-env", envReady);
            return envReady;
          },
        },
        {
          id: "qa-summary",
          dependsOn: ["engineer-bugfix", "devops-test-env"],
          async run() {
            const smoke = context.contextStore.get("quality", "smoke");
            const envReady = context.contextStore.get("operations", "qa-env");
            const summary = await simulateAgentAction({
              env,
              agentId: "agent:qa",
              detail: "QA produced release-blocking checklist outcome.",
              result: {
                status: "green",
                smoke,
                environment: envReady,
              },
              sessionId,
            });
            context.contextStore.set("quality", "summary", summary);
            return summary;
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

    console.log("QA validation summary", context.contextStore.get("quality", "summary"));
  } finally {
    stopTimeline();
    stopQa();
    stopEngineer();
    stopDevops();
  }
}

main().catch((error) => {
  console.error("QA validation example failed", error);
  process.exitCode = 1;
});
