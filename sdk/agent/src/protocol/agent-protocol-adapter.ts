import { EventEmitter } from "node:events";

export interface AgentProtocolLog {
  level: "debug" | "info" | "warn" | "error" | "stderr" | "stdout" | "log";
  message: string;
  metadata?: Record<string, unknown>;
}

export abstract class AgentProtocolAdapterBase<
  TSubmission,
  TEvent
> extends EventEmitter {
  abstract start(): Promise<void>;
  abstract stop(): void;
  abstract send(submission: TSubmission): Promise<string>;

  protected emitLog(entry: AgentProtocolLog): void {
    this.emit("log", entry);
  }

  protected emitEvent(event: TEvent): void {
    this.emit("event", event);
  }
}

export type AgentProtocolAdapterEvents<TSubmission, TEvent> = {
  event: (event: TEvent) => void;
  log: (entry: AgentProtocolLog) => void;
  send: (submission: TSubmission) => void;
};
