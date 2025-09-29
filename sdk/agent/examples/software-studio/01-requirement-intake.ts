import { createSoftwareCompanyEnvironment, simulateAgentAction } from "./shared.js";

async function main(): Promise<void> {
  const env = createSoftwareCompanyEnvironment();
  env.registerAgents();

  const stopTimeline = env.monitorTopic("studio.timeline", "timeline");
  const stopPlanner = env.monitorDirect("agent:planner", "planner");
  const stopPm = env.monitorDirect("agent:pm", "pm");

  const sessionId = "session:requirement-intake";
  const context = env.createContext(sessionId);

  const clientBrief = {
    company: "Acme Fintech",
    goal: "Launch a lightweight portfolio insights app in six weeks.",
    successMetric: "First cohort retention above 40%.",
    mustHaves: ["Account aggregation", "Daily anomaly digest", "AI suggestions"],
  };

  context.contextStore.set("intake", "client-brief", clientBrief);

  try {
    const summary = await env.workflows.run(
      [
        {
          id: "capture-requirements",
          async run() {
            const intake = await simulateAgentAction({
              env,
              agentId: "agent:pm",
              detail: "Project manager logged the client request into the intake board.",
              result: {
                requestId: "REQ-1001",
                owner: "agent:pm",
                summary: clientBrief,
              },
              sessionId,
            });
            context.contextStore.set("intake", "record", intake);
            return intake;
          },
        },
        {
          id: "planner-brief",
          dependsOn: ["capture-requirements"],
          async run() {
            const brief = await simulateAgentAction({
              env,
              agentId: "agent:planner",
              detail: "Planner produced a concise product brief with themes and success metrics.",
              result: {
                themes: [
                  "Automated aggregation",
                  "Daily signals",
                  "Advisory copilots",
                ],
                risks: ["Bank API throttling", "PII compliance"],
                successMetric: clientBrief.successMetric,
              },
              sessionId,
            });
            context.contextStore.set("planning", "brief", brief);
            return brief;
          },
        },
        {
          id: "designer-storyboard",
          dependsOn: ["planner-brief"],
          async run() {
            const storyboard = await simulateAgentAction({
              env,
              agentId: "agent:designer",
              detail: "Designer sketched day-one journey for the flagship persona.",
              result: {
                persona: "Self-directed investor",
                journey: ["Morning digest", "Portfolio scan", "Action prompts"],
              },
              sessionId,
            });
            context.contextStore.set("design", "storyboard", storyboard);
            return storyboard;
          },
        },
      ],
      context,
      {
        concurrency: 2,
        onTaskComplete(task, result) {
          console.log(`[workflow] ${task} complete`, result);
        },
        onTaskError(task, error) {
          console.error(`[workflow] ${task} failed`, error);
        },
      }
    );

    console.log("Requirement intake deliverables", {
      summary,
      brief: context.contextStore.get("planning", "brief"),
      storyboard: context.contextStore.get("design", "storyboard"),
    });
  } finally {
    stopTimeline();
    stopPlanner();
    stopPm();
  }
}

main().catch((error) => {
  console.error("Requirement intake example failed", error);
  process.exitCode = 1;
});
