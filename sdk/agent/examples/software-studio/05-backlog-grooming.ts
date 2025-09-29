import { createSoftwareCompanyEnvironment, simulateAgentAction } from "./shared.js";

async function main(): Promise<void> {
  const env = createSoftwareCompanyEnvironment();
  env.registerAgents();

  const stopTimeline = env.monitorTopic("studio.timeline", "timeline");
  const stopPm = env.monitorDirect("agent:pm", "pm");
  const stopPlanner = env.monitorDirect("agent:planner", "planner");
  const stopQa = env.monitorDirect("agent:qa", "qa");

  const sessionId = "session:backlog-grooming";
  const context = env.createContext(sessionId);

  let qaAttempts = 0;

  try {
    await env.workflows.run(
      [
        {
          id: "pm-prioritise",
          async run() {
            const priorities = await simulateAgentAction({
              env,
              agentId: "agent:pm",
              detail: "Project manager prioritised near-term backlog items.",
              result: [
                { id: "ST-1a", priority: 1 },
                { id: "ST-1b", priority: 2 },
                { id: "ST-2a", priority: 3 },
              ],
              sessionId,
            });
            context.contextStore.set("delivery", "priorities", priorities);
            return priorities;
          },
        },
        {
          id: "planner-acceptance",
          dependsOn: ["pm-prioritise"],
          async run() {
            const priorities = context.contextStore.get(
              "delivery",
              "priorities"
            ) as Array<{ id: string; priority: number }>;
            const acceptance = await simulateAgentAction({
              env,
              agentId: "agent:planner",
              detail: "Planner defined acceptance signals per backlog item.",
              result: priorities.map((item) => ({
                id: item.id,
                criteria: [
                  "Edge cases handled",
                  "Telemetry logged",
                  "Docs updated",
                ],
              })),
              sessionId,
            });
            context.contextStore.set("planning", "acceptance", acceptance);
            return acceptance;
          },
        },
        {
          id: "qa-review",
          dependsOn: ["planner-acceptance"],
          retry: {
            attempts: 2,
            delayMs: 80,
          },
          async run() {
            qaAttempts += 1;
            if (qaAttempts === 1) {
              await simulateAgentAction({
                env,
                agentId: "agent:qa",
                detail: "QA flagged missing telemetry coverage.",
                sessionId,
              });
              throw new Error("Telemetry checklist incomplete");
            }
            const acceptance = context.contextStore.get("planning", "acceptance");
            const qaResult = await simulateAgentAction({
              env,
              agentId: "agent:qa",
              detail: "QA approved backlog grooming after fixes.",
              result: {
                status: "ready",
                acceptance,
              },
              sessionId,
            });
            context.contextStore.set("quality", "groomed", qaResult);
            return qaResult;
          },
        },
      ],
      context,
      {
        concurrency: 1,
        onTaskComplete(task) {
          console.log(`[workflow] ${task} complete`);
        },
        onTaskError(task, error) {
          console.error(`[workflow] ${task} failed`, error);
        },
      }
    );

    console.log("Backlog grooming results", {
      priorities: context.contextStore.get("delivery", "priorities"),
      acceptance: context.contextStore.get("planning", "acceptance"),
      qa: context.contextStore.get("quality", "groomed"),
      attempts: qaAttempts,
    });
  } finally {
    stopTimeline();
    stopPm();
    stopPlanner();
    stopQa();
  }
}

main().catch((error) => {
  console.error("Backlog grooming example failed", error);
  process.exitCode = 1;
});
