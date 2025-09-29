import { createSoftwareCompanyEnvironment, simulateAgentAction } from "./shared.js";

async function main(): Promise<void> {
  const env = createSoftwareCompanyEnvironment();
  env.registerAgents();

  const stopTimeline = env.monitorTopic("studio.timeline", "timeline");
  const stopDevops = env.monitorDirect("agent:devops", "devops");
  const stopPm = env.monitorDirect("agent:pm", "pm");
  const stopPlanner = env.monitorDirect("agent:planner", "planner");

  const sessionId = "session:release-brief";
  const context = env.createContext(sessionId);

  const stopReleaseBroadcast = env.monitorTopic("release.broadcast", "release");

  try {
    await env.workflows.run(
      [
        {
          id: "pm-release-notes",
          async run() {
            const notes = await simulateAgentAction({
              env,
              agentId: "agent:pm",
              detail: "Project manager drafted release notes for stakeholders.",
              result: {
                highlights: [
                  "Daily anomaly digest",
                  "Smart rebalance recommendation",
                  "Portfolio insights dashboard",
                ],
              },
              sessionId,
            });
            context.contextStore.set("delivery", "release-notes", notes);
            return notes;
          },
        },
        {
          id: "devops-freeze",
          async run() {
            const freeze = await simulateAgentAction({
              env,
              agentId: "agent:devops",
              detail: "Release engineer initiated code freeze checklist.",
              result: {
                approvals: ["PM", "QA"],
                freezeTimestamp: new Date().toISOString(),
              },
              sessionId,
            });
            context.contextStore.set("operations", "freeze", freeze);
            return freeze;
          },
        },
        {
          id: "planner-gtm",
          dependsOn: ["pm-release-notes"],
          async run() {
            const notes = context.contextStore.get("delivery", "release-notes");
            const gtm = await simulateAgentAction({
              env,
              agentId: "agent:planner",
              detail: "Planner aligned go-to-market messaging with release outcomes.",
              result: {
                launchChannels: ["Email", "In-product"],
                tagline: "Insights before the market opens",
                notes,
              },
              sessionId,
            });
            context.contextStore.set("planning", "gtm", gtm);
            return gtm;
          },
        },
        {
          id: "release-brief",
          dependsOn: ["pm-release-notes", "devops-freeze", "planner-gtm"],
          async run() {
            const release = {
              notes: context.contextStore.get("delivery", "release-notes"),
              freeze: context.contextStore.get("operations", "freeze"),
              gtm: context.contextStore.get("planning", "gtm"),
            };
            env.bus.publish("release.broadcast", release, sessionId);
            return release;
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

    console.log("Release brief", {
      notes: context.contextStore.get("delivery", "release-notes"),
      freeze: context.contextStore.get("operations", "freeze"),
      gtm: context.contextStore.get("planning", "gtm"),
    });
  } finally {
    stopTimeline();
    stopDevops();
    stopPm();
    stopPlanner();
    stopReleaseBroadcast();
  }
}

main().catch((error) => {
  console.error("Release brief example failed", error);
  process.exitCode = 1;
});
