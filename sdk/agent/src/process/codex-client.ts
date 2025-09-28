import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createInterface, type Interface } from "node:readline";

import type { ChildProcessWithoutNullStreams } from "node:child_process";

import type { CodexCommand, CodexResult } from "../types/index.js";
import { ProcessSupervisor } from "./process-supervisor.js";

const DEFAULT_RELATIVE_CLI_PATH = "ref/codex-src/codex-cli/bin/codex.js";
const requireFromModule = createRequire(import.meta.url);

interface PendingRequest {
  resolve: (value: CodexResult) => void;
  reject: (error: unknown) => void;
  timeout?: NodeJS.Timeout;
}

export interface CodexClientOptions {
  cliPath?: string;
  nodePath?: string;
  commandPath?: string;
  commandArgs?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  autoRestart?: boolean;
  maxRestarts?: number;
  backoffMs?: number;
  responseTimeoutMs?: number;
}

export interface CodexClientEvents {
  notification: (payload: Record<string, unknown>) => void;
  protocolError: (error: Error) => void;
  restarted: (attempt: number) => void;
}

export type CodexClientEventName = keyof CodexClientEvents;

type CodexClientEventHandler<T extends CodexClientEventName> = CodexClientEvents[T];

export class CodexClient extends EventEmitter {
  private readonly supervisor: ProcessSupervisor;
  private readonly pending = new Map<string, PendingRequest>();
  private reader?: Interface;
  private readonly responseTimeoutMs: number;

  constructor(private readonly options: CodexClientOptions = {}) {
    super();

    const cliAbsolute = resolveCodexCliPath(options);
    const command = options.commandPath ?? options.nodePath ?? process.execPath;
    const args = options.commandArgs ?? [cliAbsolute];

    this.supervisor = new ProcessSupervisor({
      command,
      args,
      cwd: options.cwd,
      env: options.env,
      autoRestart: options.autoRestart ?? true,
      maxRestarts: options.maxRestarts ?? 5,
      backoffMs: options.backoffMs ?? 1000,
    });

    this.responseTimeoutMs = options.responseTimeoutMs ?? 30_000;
    this.supervisor.on("started", (child) => {
      this.attachChild(child);
    });
    this.supervisor.on("exited", () => {
      this.detachChild();
      this.failInflight(new Error("Codex CLI process exited."));
    });
    this.supervisor.on("failed", (error) => {
      const wrapped = this.coerceError(error);
      this.emit("protocolError", wrapped);
      this.failInflight(wrapped);
    });
    this.supervisor.on("restarted", (attempt) => {
      this.emit("restarted", attempt);
    });
  }

  async start(): Promise<void> {
    if (this.supervisor.isRunning()) {
      return;
    }

    await new Promise<void>((resolvePromise, rejectPromise) => {
      const handleStarted = () => {
        this.supervisor.off("failed", handleFailed);
        resolvePromise();
      };
      const handleFailed = (error: unknown) => {
        this.supervisor.off("started", handleStarted);
        rejectPromise(this.coerceError(error));
      };

      this.supervisor.once("started", handleStarted);
      this.supervisor.once("failed", handleFailed);
      this.supervisor.start();
    });
  }

  stop(): void {
    this.supervisor.stop();
    this.detachChild();
    this.failInflight(new Error("Codex CLI client stopped."));
  }

  async exec<T = unknown>(command: CodexCommand): Promise<CodexResult<T>> {
    if (!this.supervisor.isRunning()) {
      await this.start();
    }

    const child = this.supervisor.getChild();
    if (!child) {
      throw new Error("Codex CLI process is not available.");
    }

    const id = randomUUID();
    const payload = JSON.stringify({ id, ...command });

    return new Promise<CodexResult<T>>((resolvePromise, rejectPromise) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        rejectPromise(new Error("Codex CLI response timed out."));
      }, command.timeoutMs ?? this.responseTimeoutMs);

      this.pending.set(id, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolvePromise(result as CodexResult<T>);
        },
        reject: (error) => {
          clearTimeout(timeout);
          rejectPromise(error);
        },
        timeout,
      });

      child.stdin.write(payload + "\n", (error) => {
        if (!error) {
          return;
        }
        this.pending.delete(id);
        rejectPromise(error);
      });
    });
  }

  private attachChild(child: ChildProcessWithoutNullStreams): void {
    this.detachChild();
    this.reader = createInterface({ input: child.stdout });
    this.reader.on("line", (line) => {
      this.handleLine(line);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString("utf-8");
      const error = new Error(text.trim() || "Codex CLI stderr output.");
      this.emit("protocolError", error);
      this.failInflight(error);
    });
    child.stdin.on("error", (error) => {
      const wrapped = this.coerceError(error);
      this.emit("protocolError", wrapped);
      this.failInflight(wrapped);
    });
  }

  private detachChild(): void {
    if (this.reader) {
      this.reader.removeAllListeners();
      this.reader.close();
      this.reader = undefined;
    }
  }

  private handleLine(line: string): void {
    if (line.trim().length === 0) {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      const wrapped = new Error(
        "Failed to parse Codex CLI response: " + String(error)
      );
      this.emit("protocolError", wrapped);
      this.failInflight(wrapped);
      return;
    }

    if (!parsed || typeof parsed !== "object") {
      const wrapped = new Error("Codex CLI emitted non-object payload.");
      this.emit("protocolError", wrapped);
      this.failInflight(wrapped);
      return;
    }

    const message = parsed as { id?: string } & CodexResult & Record<string, unknown>;

    if (!message.id) {
      this.emit("notification", message);
      return;
    }

    const pendingRequest = this.pending.get(message.id);
    if (!pendingRequest) {
      return;
    }

    this.pending.delete(message.id);

    if (typeof message.ok !== "boolean") {
      const protocolError = new Error(
        "Codex CLI response missing ok flag for id " + message.id
      );
      this.emit("protocolError", protocolError);
      pendingRequest.reject(protocolError);
      return;
    }

    if (message.ok === false) {
      const error = new Error(message.error ?? "Codex CLI command failed.");
      pendingRequest.reject(error);
      return;
    }
    pendingRequest.resolve(message);
  }

  private failInflight(error: unknown): void {
    const iterator = this.pending.entries();
    let current = iterator.next();
    while (!current.done) {
      const [, request] = current.value;
      request.reject(this.coerceError(error));
      current = iterator.next();
    }
    this.pending.clear();
  }

  private coerceError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    return new Error(typeof error === "string" ? error : JSON.stringify(error));
  }

  on<T extends CodexClientEventName>(
    event: T,
    handler: CodexClientEventHandler<T>
  ): this {
    return super.on(event, handler as never);
  }
}

function resolveCodexCliPath(options: CodexClientOptions): string {
  const baseDir = options.cwd ?? process.cwd();

  if (options.cliPath) {
    return resolve(baseDir, options.cliPath);
  }

  try {
    return requireFromModule.resolve("@openai/codex/bin/codex.js");
  } catch {
    // Fall back to legacy relative path for environments without npm-installed Codex.
  }

  return resolve(baseDir, DEFAULT_RELATIVE_CLI_PATH);
}
