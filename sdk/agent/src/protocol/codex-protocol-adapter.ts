import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import type { CodexClientOptions } from "../process/codex-client.js";
import { CodexClient } from "../process/codex-client.js";
import { AgentProtocolAdapterBase, type AgentProtocolLog } from "./agent-protocol-adapter.js";

export interface CodexSubmission {
  id?: string;
  op: { type: string; [key: string]: unknown };
}

export interface CodexProtocolEvent {
  id: string;
  msg: { type: string; [key: string]: unknown };
}

export interface CodexProtocolAdapterOptions {
  client?: CodexClient;
  clientOptions?: CodexClientOptions;
  configOverrides?: Record<string, unknown>;
  extraArgs?: string[];
}

interface NormalizedNotification {
  type?: string;
  message?: string;
  [key: string]: unknown;
}

function formatOverride(key: string, value: unknown): string {
  if (typeof value === "string") {
    return `${key}=${JSON.stringify(value)}`;
  }
  return `${key}=${JSON.stringify(value)}`;
}

const requireForResolver = createRequire(import.meta.url);

function resolveCodexCliScript(): string {
  try {
    return requireForResolver.resolve("@openai/codex/bin/codex.js");
  } catch (error) {
    throw new Error(
      "Unable to resolve @openai/codex CLI script. Install @openai/codex or provide clientOptions.commandArgs explicitly.",
      { cause: error }
    );
  }
}

function buildDefaultArgs(
  overrides: Record<string, unknown>,
  extraArgs: string[]
): string[] {
  const entries = Object.entries(overrides);
  const args: string[] = [resolveCodexCliScript(), "proto"];
  for (const [key, value] of entries) {
    args.push("-c", formatOverride(key, value));
  }
  args.push(...extraArgs);
  return args;
}

export class CodexProtocolAdapter extends AgentProtocolAdapterBase<
  CodexSubmission,
  CodexProtocolEvent
> {
  private readonly client: CodexClient;
  private started = false;

  constructor(options: CodexProtocolAdapterOptions = {}) {
    super();

    const defaultOverrides: Record<string, unknown> = {
      sandbox_mode: "danger-full-access",
      approval_policy: "never",
      "shell_environment_policy.inherit": "all",
      "shell_environment_policy.ignore_default_excludes": true,
    };

    const mergedOverrides = {
      ...defaultOverrides,
      ...(options.configOverrides ?? {}),
    };

    const extraArgs = options.extraArgs ?? [];

    if (options.client) {
      this.client = options.client;
    } else {
      const existingArgs = options.clientOptions?.commandArgs;
      const commandArgs =
        existingArgs && existingArgs.length > 0
          ? existingArgs
          : buildDefaultArgs(mergedOverrides, extraArgs);
      const clientOptions: CodexClientOptions = {
        ...(options.clientOptions ?? {}),
        commandArgs,
      };
      this.client = new CodexClient(clientOptions);
    }

    this.client.on("notification", (payload: unknown) => {
      this.handleNotification(payload as NormalizedNotification);
    });

    this.client.on("protocolError", (error) => {
      this.emitLog({ level: "error", message: error.message, metadata: { error } });
    });
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    await this.client.start();
    this.started = true;
  }

  stop(): void {
    this.client.stop();
    this.started = false;
  }

  async send(submission: CodexSubmission): Promise<string> {
    const id = submission.id ?? randomUUID();
    const payload = {
      id,
      op: submission.op,
    };
    await this.client.send(payload);
    return id;
  }

  protected override emitLog(entry: AgentProtocolLog): void {
    super.emitLog(entry);
  }

  private handleNotification(payload: NormalizedNotification): void {
    if (payload && typeof payload === "object") {
      if (typeof payload.message === "string" && payload.type) {
        const level =
          payload.type === "stderr"
            ? "stderr"
            : (payload.type as AgentProtocolLog["level"] | undefined) ?? "info";
        this.emitLog({
          level,
          message: payload.message,
        });
        return;
      }

      if (
        typeof (payload as { id?: unknown }).id === "string" &&
        payload.msg &&
        typeof payload.msg === "object" &&
        typeof (payload.msg as { type?: unknown }).type === "string"
      ) {
        const event: CodexProtocolEvent = {
          id: payload.id as string,
          msg: payload.msg as { type: string; [key: string]: unknown },
        };
        this.emitEvent(event);
        return;
      }
    }

    this.emitLog({
      level: "debug",
      message: "codex-notification",
      metadata: { payload },
    });
  }
}
