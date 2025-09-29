import { createSoftwareCompanyEnvironment, simulateAgentAction } from "./shared.js";

async function main(): Promise<void> {
  const env = createSoftwareCompanyEnvironment();
  env.registerAgents();

  const stopTimeline = env.monitorTopic("studio.timeline", "timeline");
  const stopPlanner = env.monitorDirect("agent:planner", "planner");
  const stopEngineer = env.monitorDirect("agent:engineer", "engineer");
  const stopPm = env.monitorDirect("agent:pm", "pm");
  const stopFeedback = env.monitorTopic("feedback.events", "feedback");

  const sessionId = "session:feedback-integration";
  const context = env.createContext(sessionId);

  try {
    await env.workflows.run(
      [
        {
          id: "collect-feedback",
          async run() {
            const feedback = await simulateAgentAction({
              env,
              agentId: "agent:planner",
              detail: "Planner aggregated pilot cohort feedback.",
              result: [
                { customer: "Vault Bank", request: "Bulk export" },
                { customer: "Redwood Partners", request: "Mobile digest" },
              ],
              sessionId,
            });
            env.bus.publish("feedback.events", feedback, sessionId);
            context.contextStore.set("research", "feedback", feedback);
            return feedback;
          },
        },
        {
          id: "engineer-impact",
          dependsOn: ["collect-feedback"],
          async run() {
            const feedback = context.contextStore.get(
              "research",
              "feedback"
            ) as Array<{ customer: string; request: string }>;
            const impact = await simulateAgentAction({
              env,
              agentId: "agent:engineer",
              detail: "Engineer evaluated engineering impact for feedback items.",
              result: feedback.map((item) => ({
                request: item.request,
                impact: item.request.includes("Mobile") ? "medium" : "high",
              })),
              sessionId,
            });
            context.contextStore.set("delivery", "impact", impact);
            return impact;
          },
        },
        {
          id: "pm-reprioritise",
          dependsOn: ["engineer-impact"],
          async run() {
            const impact = context.contextStore.get("delivery", "impact");
            const reprioritised = await simulateAgentAction({
              env,
              agentId: "agent:pm",
              detail: "Project manager reprioritised roadmap with feedback scores.",
              result: {
                backlog: [
                  { id: "ST-201", request: "Bulk export", priority: 1 },
                  { id: "ST-202", request: "Mobile digest", priority: 2 },
                ],
                impact,
              },
              sessionId,
            });
            context.contextStore.set("delivery", "reprioritised", reprioritised);
            return reprioritised;
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

    console.log("Feedback integration result", {
      feedback: context.contextStore.get("research", "feedback"),
      impact: context.contextStore.get("delivery", "impact"),
      backlog: context.contextStore.get("delivery", "reprioritised"),
    });
  } finally {
    stopTimeline();
    stopPlanner();
    stopEngineer();
    stopPm();
    stopFeedback();
  }
}

main().catch((error) => {
  console.error("Feedback integration example failed", error);
  process.exitCode = 1;
});
