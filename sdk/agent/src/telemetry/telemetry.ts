import pino, { type Logger, type LoggerOptions } from "pino";
import type { TelemetryEvent, TelemetrySink } from "../types/index.js";

export interface TelemetryOptions {
  level?: LoggerOptions["level"];
  bindings?: Record<string, unknown>;
  sinks?: TelemetrySink[];
  logger?: Logger;
}

export class Telemetry {
  private readonly logger: Logger;
  private readonly sinks: TelemetrySink[];

  constructor(options: TelemetryOptions = {}) {
    this.logger =
      options.logger ??
      pino({
        level: options.level ?? "info",
        base: options.bindings,
      });
    this.sinks = options.sinks ?? [];
  }

  child(bindings: Record<string, unknown>): Telemetry {
    const childLogger = this.logger.child(bindings);
    return new Telemetry({ logger: childLogger, sinks: this.sinks });
  }

  debug(name: string, payload?: Record<string, unknown>): void {
    this.emit({ name, level: "debug", payload });
  }

  info(name: string, payload?: Record<string, unknown>): void {
    this.emit({ name, level: "info", payload });
  }

  warn(name: string, payload?: Record<string, unknown>): void {
    this.emit({ name, level: "warn", payload });
  }

  error(name: string, payload?: Record<string, unknown>): void {
    this.emit({ name, level: "error", payload });
  }

  addSink(sink: TelemetrySink): void {
    this.sinks.push(sink);
  }

  private emit(event: Omit<TelemetryEvent, "timestamp">): void {
    const timestamp = Date.now();
    const fullEvent: TelemetryEvent = {
      ...event,
      timestamp,
    };

    const method = levelToMethod(event.level);
    this.logger[method]({ payload: event.payload, timestamp }, event.name);
    this.sinks.forEach((sink) => sink.handle(fullEvent));
  }
}

function levelToMethod(level: TelemetryEvent["level"]): "debug" | "info" | "warn" | "error" {
  if (level === "debug") {
    return "debug";
  }
  if (level === "warn") {
    return "warn";
  }
  if (level === "error") {
    return "error";
  }
  return "info";
}
