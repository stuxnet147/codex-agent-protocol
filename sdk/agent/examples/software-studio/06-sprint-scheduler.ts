import { createSoftwareCompanyEnvironment, simulateAgentAction } from "./shared.js";

async function main(): Promise<void> {
  const env = createSoftwareCompanyEnvironment();
  env.registerAgents();

  const stopTimeline = env.monitorTopic("studio.timeline", "timeline");
  const stopPm = env.monitorDirect("agent:pm", "pm");
  const stopEngineer = env.monitorDirect("agent:engineer", "engineer");
  const stopQa = env.monitorDirect("agent:qa", "qa");

  const sessionId = "session:sprint-scheduler";
  const context = env.createContext(sessionId);

  const readyStories = [
    { id: "ST-101", effort: 5, qa: true },
    { id: "ST-102", effort: 3, qa: false },
    { id: "ST-103", effort: 8, qa: true },
  ];
  context.contextStore.set("delivery", "ready", readyStories);

  try {
    await env.workflows.run(
      [
        {
          id: "engineer-availability",
          async run() {
            const availability = await simulateAgentAction({
              env,
              agentId: "agent:engineer",
              detail: "Engineering lead published sprint capacity.",
              result: {
                team: "Swifts",
                capacity: 16,
                pairingSlots: 2,
              },
              sessionId,
            });
            context.contextStore.set("delivery", "capacity", availability);
            return availability;
          },
        },
        {
          id: "qa-slots",
          async run() {
            const slots = await simulateAgentAction({
              env,
              agentId: "agent:qa",
              detail: "QA analyst listed automation slots for the sprint.",
              result: {
                automationSlots: 2,
                exploratoryHours: 10,
              },
              sessionId,
            });
            context.contextStore.set("quality", "slots", slots);
            return slots;
          },
        },
        {
          id: "pm-schedule",
          dependsOn: ["engineer-availability", "qa-slots"],
          async run() {
            const capacity = context.contextStore.get<{ capacity: number }>(
              "delivery",
              "capacity"
            );
            const slots = context.contextStore.get<{ automationSlots: number }>(
              "quality",
              "slots"
            );
            const scheduled = await simulateAgentAction({
              env,
              agentId: "agent:pm",
              detail: "Project manager scheduled sprint based on capacity and QA slots.",
              result: readyStories.map((story, index) => ({
                story,
                sprintDay: index % 5,
                requiresQa: story.qa,
              })),
              sessionId,
              topic: "sprint.assignments",
            });
            context.contextStore.set("delivery", "sprint-plan", {
              capacity,
              qa: slots,
              scheduled,
            });
            return scheduled;
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

    console.log("Sprint plan", context.contextStore.get("delivery", "sprint-plan"));
  } finally {
    stopTimeline();
    stopPm();
    stopEngineer();
    stopQa();
  }
}

main().catch((error) => {
  console.error("Sprint scheduler example failed", error);
  process.exitCode = 1;
});
