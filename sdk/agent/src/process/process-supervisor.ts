import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import type { ProcessLaunchOptions } from "../types/index.js";

export interface SupervisorEvents {
  started: (child: ChildProcessWithoutNullStreams) => void;
  exited: (code: number | null, signal: NodeJS.Signals | null) => void;
  failed: (error: unknown) => void;
  restarted: (attempt: number) => void;
}

export type SupervisorEventName = keyof SupervisorEvents;

type SupervisorHandler<T extends SupervisorEventName> = SupervisorEvents[T];

export class ProcessSupervisor extends EventEmitter {
  private child?: ChildProcessWithoutNullStreams;
  private restarts = 0;
  private shuttingDown = false;

  constructor(private readonly options: ProcessLaunchOptions) {
    super();
  }

  isRunning(): boolean {
    return Boolean(this.child && !this.child.killed);
  }

  getChild(): ChildProcessWithoutNullStreams | undefined {
    return this.child;
  }

  start(): void {
    if (this.isRunning()) {
      return;
    }

    try {
      this.child = spawn(this.options.command, this.options.args ?? [], {
        cwd: this.options.cwd,
        env: { ...process.env, ...(this.options.env ?? {}) },
        stdio: "pipe",
      });
    } catch (error) {
      this.emit("failed", error);
      if (this.options.autoRestart) {
        this.scheduleRestart();
      }
      return;
    }

    this.shuttingDown = false;
    this.child.once("exit", (code, signal) => {
      this.child = undefined;
      this.emit("exited", code, signal);
      if (!this.shuttingDown && this.options.autoRestart) {
        this.scheduleRestart();
      }
    });

    this.child.once("error", (error) => {
      this.emit("failed", error);
    });

    this.emit("started", this.child);
  }

  stop(signal: NodeJS.Signals = "SIGTERM"): void {
    if (!this.child || this.child.killed) {
      return;
    }
    this.shuttingDown = true;
    this.child.kill(signal);
  }

  on<T extends SupervisorEventName>(event: T, handler: SupervisorHandler<T>): this {
    return super.on(event, handler as never);
  }

  private scheduleRestart(): void {
    if (!this.options.autoRestart) {
      return;
    }
    if (
      typeof this.options.maxRestarts === "number" &&
      this.restarts >= this.options.maxRestarts
    ) {
      this.emit("failed", new Error("Maximum restart attempts exceeded."));
      return;
    }

    this.restarts += 1;
    const delay = this.options.backoffMs ?? 1000;
    setTimeout(() => {
      this.emit("restarted", this.restarts);
      this.start();
    }, delay);
  }
}
