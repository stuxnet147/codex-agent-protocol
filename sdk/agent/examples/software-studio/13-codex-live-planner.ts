import { CodexProtocolAdapter } from "../../src/index.js";

interface PlannerResult {
  briefing: string;
  risks: string[];
  milestones: string[];
}

async function main(): Promise<void> {
  const adapter = new CodexProtocolAdapter({
    clientOptions: {
      cwd: process.cwd(),
      responseTimeoutMs: 300_000,
    },
  });

  await adapter.start();

  let finalMessage: string | null = null;
  let taskCompleted = false;

  const shutdownPromise = new Promise<void>((resolve, reject) => {
    adapter.on("log", (entry) => {
      if (entry.level === "stderr" || entry.level === "error") {
        console.warn(`[codex:${entry.level}] ${entry.message}`);
      }
    });

    adapter.on("event", async (event) => {
      const { msg } = event;
      switch (msg.type) {
        case "session_configured": {
          console.info(
            `[codex] session ${msg.session_id} with model ${msg.model} ready`
          );
          break;
        }
        case "agent_message_delta": {
          if (typeof msg.delta === "string") {
            process.stdout.write(msg.delta);
          }
          break;
        }
        case "agent_message": {
          if (typeof msg.message === "string") {
            finalMessage = msg.message;
            console.log("\n[codex] final message received\n");
            console.log(finalMessage);
          }
          break;
        }
        case "task_complete": {
          if (!taskCompleted) {
            taskCompleted = true;
            try {
              await adapter.send({
                op: {
                  type: "shutdown",
                },
              });
            } catch (error) {
              reject(error);
            }
          }
          break;
        }
        case "shutdown_complete": {
          resolve();
          break;
        }
        case "error": {
          reject(new Error(msg.message ?? "Codex reported error"));
          break;
        }
        default:
          break;
      }
    });
  });

  await adapter.send({
    op: {
      type: "user_turn",
      items: [
        {
          type: "text",
          text: [
            "You are a software company planner in a cross-functional agent team.",
            "Draft a concise briefing for a fintech portfolio insights product.",
            "Summarize in JSON with fields briefing (string), risks (string array),",
            "and milestones (string array). Keep each list under 4 entries.",
          ].join(" "),
        },
      ],
      cwd: process.cwd(),
      approval_policy: "never",
      sandbox_policy: {
        mode: "danger-full-access",
      },
      model: process.env.CODEX_MODEL ?? "gpt-5-codex",
      summary: "auto",
    },
  });

  await shutdownPromise;
  adapter.stop();

  if (finalMessage) {
    try {
      const parsed: PlannerResult = JSON.parse(
        finalMessage.replace(/```json|```/g, "").trim()
      );
      console.log("\nCodex briefing", parsed);
    } catch (error) {
      console.warn("Failed to parse Codex output as JSON", error);
    }
  }
}

main().catch((error) => {
  console.error("Codex live planner example failed", error);
  process.exitCode = 1;
});
