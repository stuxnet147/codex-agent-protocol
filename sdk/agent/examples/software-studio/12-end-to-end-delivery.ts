import { createSoftwareCompanyEnvironment, simulateAgentAction } from "./shared.js";

async function main(): Promise<void> {
  const env = createSoftwareCompanyEnvironment();
  env.registerAgents();

  const stopTimeline = env.monitorTopic("studio.timeline", "timeline");
  const stopPlanner = env.monitorDirect("agent:planner", "planner");
  const stopPm = env.monitorDirect("agent:pm", "pm");
  const stopArchitect = env.monitorDirect("agent:architect", "architect");
  const stopEngineer = env.monitorDirect("agent:engineer", "engineer");
  const stopQa = env.monitorDirect("agent:qa", "qa");
  const stopDevops = env.monitorDirect("agent:devops", "devops");

  const sessionId = "session:end-to-end-delivery";
  const context = env.createContext(sessionId);

  const clientGoal = {
    vision: "Deliver AI-assisted insights for mid-market investors",
    kpis: { retention: 0.4, engagement: 0.6 },
  };
  context.contextStore.set("intake", "goal", clientGoal);

  try {
    const summary = await env.workflows.run(
      [
        {
          id: "pm-alignment",
          async run() {
            const alignment = await simulateAgentAction({
              env,
              agentId: "agent:pm",
              detail: "Project manager aligned stakeholders on success criteria.",
              result: {
                stakeholders: ["Product", "Engineering", "Compliance"],
                goal: clientGoal,
              },
              sessionId,
            });
            context.contextStore.set("delivery", "alignment", alignment);
            return alignment;
          },
        },
        {
          id: "planner-roadmap",
          dependsOn: ["pm-alignment"],
          async run() {
            const roadmap = await simulateAgentAction({
              env,
              agentId: "agent:planner",
              detail: "Planner produced a milestone roadmap covering MVP to scale.",
              result: {
                milestones: [
                  { name: "MVP", output: "Daily digest" },
                  { name: "M1", output: "Copilot recommendations" },
                  { name: "M2", output: "Advisor console" },
                ],
              },
              sessionId,
            });
            context.contextStore.set("planning", "roadmap", roadmap);
            return roadmap;
          },
        },
        {
          id: "architect-design",
          dependsOn: ["planner-roadmap"],
          async run() {
            const design = await simulateAgentAction({
              env,
              agentId: "agent:architect",
              detail: "Architect delivered system design with integration contracts.",
              result: {
                domains: ["aggregation", "analytics", "copilot"],
                decisions: ["CQRS for analytics", "Event backbone"]
              },
              sessionId,
            });
            context.contextStore.set("architecture", "design", design);
            return design;
          },
        },
        {
          id: "devops-blueprint",
          dependsOn: ["planner-roadmap"],
          async run() {
            const blueprint = await simulateAgentAction({
              env,
              agentId: "agent:devops",
              detail: "Release engineer mapped environments and deployment gates.",
              result: {
                environments: ["dev", "staging", "production"],
                gates: ["lint", "integration", "load-test"],
              },
              sessionId,
            });
            context.contextStore.set("operations", "blueprint", blueprint);
            return blueprint;
          },
        },
        {
          id: "engineer-build",
          dependsOn: ["architect-design"],
          async run() {
            const build = await simulateAgentAction({
              env,
              agentId: "agent:engineer",
              detail: "Engineering squad shipped MVP feature set.",
              result: {
                featureFlags: ["digest-v1", "copilot-alpha"],
                commit: "1a2b3c",
              },
              sessionId,
            });
            context.contextStore.set("delivery", "build", build);
            return build;
          },
        },
        {
          id: "qa-certification",
          dependsOn: ["engineer-build", "devops-blueprint"],
          async run() {
            const certification = await simulateAgentAction({
              env,
              agentId: "agent:qa",
              detail: "QA certified MVP via automation and exploratory suites.",
              result: {
                automation: "96% passing",
                exploratoryNotes: ["copilot prompts helpful"],
              },
              sessionId,
            });
            context.contextStore.set("quality", "certification", certification);
            return certification;
          },
        },
        {
          id: "release-readout",
          dependsOn: ["qa-certification"],
          async run() {
            const release = {
              roadmap: context.contextStore.get("planning", "roadmap"),
              design: context.contextStore.get("architecture", "design"),
              build: context.contextStore.get("delivery", "build"),
              certification: context.contextStore.get("quality", "certification"),
              operations: context.contextStore.get("operations", "blueprint"),
            };
            env.bus.publish("release.broadcast", release, sessionId);
            context.contextStore.set("delivery", "release", release);
            return release;
          },
        },
      ],
      context,
      {
        concurrency: 3,
        onTaskComplete(task) {
          console.log(`[workflow] ${task} complete`);
        },
        onTaskError(task, error) {
          console.error(`[workflow] ${task} failed`, error);
        },
      }
    );

    console.log("End-to-end delivery summary", {
      summary,
      release: context.contextStore.get("delivery", "release"),
    });
  } finally {
    stopTimeline();
    stopPlanner();
    stopPm();
    stopArchitect();
    stopEngineer();
    stopQa();
    stopDevops();
  }
}

main().catch((error) => {
  console.error("End-to-end delivery example failed", error);
  process.exitCode = 1;
});
