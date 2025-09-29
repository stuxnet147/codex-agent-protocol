import { createSoftwareCompanyEnvironment, simulateAgentAction } from "./shared.js";

async function main(): Promise<void> {
  const env = createSoftwareCompanyEnvironment();
  env.registerAgents();

  const stopTimeline = env.monitorTopic("studio.timeline", "timeline");
  const stopPlanner = env.monitorDirect("agent:planner", "planner");
  const stopEngineer = env.monitorDirect("agent:engineer", "engineer");
  const stopPm = env.monitorDirect("agent:pm", "pm");

  const sessionId = "session:product-plan";
  const context = env.createContext(sessionId);

  try {
    await env.workflows.run(
      [
        {
          id: "planner-epics",
          async run() {
            const epics = await simulateAgentAction({
              env,
              agentId: "agent:planner",
              detail: "Planner organised customer problems into three epics.",
              result: [
                { id: "EP-1", name: "Account aggregation" },
                { id: "EP-2", name: "Insights delivery" },
                { id: "EP-3", name: "Copilot assistance" },
              ],
              sessionId,
            });
            context.contextStore.set("planning", "epics", epics);
            return epics;
          },
        },
        {
          id: "engineer-breakdown",
          dependsOn: ["planner-epics"],
          async run() {
            const epics = context.contextStore.get<{ id: string; name: string }[]>(
              "planning",
              "epics"
            );
            const stories = await simulateAgentAction({
              env,
              agentId: "agent:engineer",
              detail: "Engineer decomposed epics into acceptance-testable stories.",
              result: epics?.map((epic, index) => ({
                epic,
                stories: [
                  {
                    id: `ST-${index + 1}a`,
                    title: `${epic.name} baseline flow`,
                    estimate: 3,
                  },
                  {
                    id: `ST-${index + 1}b`,
                    title: `${epic.name} async validation`,
                    estimate: 5,
                  },
                ],
              })),
              sessionId,
            });
            context.contextStore.set("delivery", "stories", stories);
            return stories;
          },
        },
        {
          id: "pm-roadmap",
          dependsOn: ["planner-epics", "engineer-breakdown"],
          async run() {
            const stories = context.contextStore.get(
              "delivery",
              "stories"
            ) as Array<{ epic: { id: string; name: string }; stories: unknown[] }>;
            const roadmap = await simulateAgentAction({
              env,
              agentId: "agent:pm",
              detail: "Project manager produced quarter-level roadmap forecasts.",
              result: {
                quarters: [
                  {
                    name: "Q1",
                    focus: stories?.[0]?.epic.name,
                    velocity: 20,
                  },
                  {
                    name: "Q2",
                    focus: stories?.[1]?.epic.name,
                    velocity: 22,
                  },
                  {
                    name: "Q3",
                    focus: stories?.[2]?.epic.name,
                    velocity: 24,
                  },
                ],
              },
              sessionId,
            });
            context.contextStore.set("delivery", "roadmap", roadmap);
            return roadmap;
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

    const snapshot = context.contextStore.snapshot("delivery");
    console.log("Product plan", {
      epics: context.contextStore.get("planning", "epics"),
      roadmap: context.contextStore.get("delivery", "roadmap"),
      snapshot,
    });
  } finally {
    stopTimeline();
    stopPlanner();
    stopEngineer();
    stopPm();
  }
}

main().catch((error) => {
  console.error("Product plan example failed", error);
  process.exitCode = 1;
});
