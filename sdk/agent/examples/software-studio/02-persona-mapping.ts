import { createSoftwareCompanyEnvironment, simulateAgentAction } from "./shared.js";

async function main(): Promise<void> {
  const env = createSoftwareCompanyEnvironment();
  env.registerAgents();

  const stopTimeline = env.monitorTopic("studio.timeline", "timeline");
  const stopAnalyst = env.monitorDirect("agent:analyst", "analyst");
  const stopPlanner = env.monitorDirect("agent:planner", "planner");
  const stopPm = env.monitorDirect("agent:pm", "pm");

  const sessionId = "session:persona-mapping";
  const context = env.createContext(sessionId);

  const intakeSnapshot = {
    segments: ["DIY investors", "Busy executives"],
    initialPersona: "Self-directed investor",
  };
  context.contextStore.set("intake", "snapshot", intakeSnapshot);

  try {
    await env.workflows.run(
      [
        {
          id: "collect-market-signals",
          async run() {
            const signals = await simulateAgentAction({
              env,
              agentId: "agent:analyst",
              detail: "Analyst captured top market and competitor signals.",
              result: {
                competitors: ["Mint", "Morning Brew"],
                differentiators: ["Daily anomaly alerts", "Copilot guidance"],
              },
              sessionId,
            });
            context.contextStore.set("research", "signals", signals);
            return signals;
          },
        },
        {
          id: "draft-persona",
          dependsOn: ["collect-market-signals"],
          async run() {
            const signals = context.contextStore.get<{
              competitors: string[];
              differentiators: string[];
            }>("research", "signals");
            const persona = await simulateAgentAction({
              env,
              agentId: "agent:planner",
              detail: "Planner translated signals into a primary persona.",
              result: {
                name: "Adaptive Investor",
                frustrations: ["Fragmented dashboards", "Slow manual insights"],
                differentiators: signals?.differentiators,
              },
              sessionId,
            });
            context.contextStore.set("planning", "persona", persona);
            return persona;
          },
        },
        {
          id: "pm-acceptance",
          dependsOn: ["draft-persona"],
          async run() {
            const persona = context.contextStore.get("planning", "persona");
            const ready = await simulateAgentAction({
              env,
              agentId: "agent:pm",
              detail: "Project manager captured acceptance criteria for the persona.",
              result: {
                persona,
                acceptanceCriteria: [
                  "Persona receives actionable alert under 30 seconds",
                  "Persona sees aggregated holdings accuracy within 1%",
                ],
              },
              sessionId,
            });
            context.contextStore.set("delivery", "persona-acceptance", ready);
            return ready;
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

    console.log("Persona package", {
      persona: context.contextStore.get("planning", "persona"),
      acceptance: context.contextStore.get("delivery", "persona-acceptance"),
    });
  } finally {
    stopTimeline();
    stopAnalyst();
    stopPlanner();
    stopPm();
  }
}

main().catch((error) => {
  console.error("Persona mapping example failed", error);
  process.exitCode = 1;
});
