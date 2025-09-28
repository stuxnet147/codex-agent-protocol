import { describe, expect, it, vi } from "vitest";
import { WorkflowEngine } from "../src/workflow/workflow-engine.js";
import type { WorkflowContext } from "../src/types/index.js";

const createContext = (): WorkflowContext => ({
  contextStore: {
    set() {
      /* no-op for tests */
    },
    get() {
      return undefined;
    },
    delete() {
      /* no-op for tests */
    },
    snapshot() {
      return { id: "snapshot", createdAt: Date.now(), data: {} };
    },
  },
});

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

describe("WorkflowEngine", () => {
  it("executes dependent nodes and reports completion", async () => {
    const engine = new WorkflowEngine();
    const executionOrder: string[] = [];
    const results: string[] = [];

    const summary = await engine.run(
      [
        {
          id: "prepare",
          async run() {
            executionOrder.push("prepare");
            await sleep(5);
            return "ready";
          },
        },
        {
          id: "execute",
          dependsOn: ["prepare"],
          run() {
            executionOrder.push("execute");
            return "done";
          },
        },
      ],
      createContext(),
      {
        concurrency: 2,
        onTaskComplete(nodeId, result) {
          results.push(nodeId + ":" + String(result));
        },
      }
    );

    expect(executionOrder).toEqual(["prepare", "execute"]);
    expect(Array.from(summary.completed)).toEqual(["prepare", "execute"]);
    expect(summary.failed.size).toBe(0);
    expect(summary.finishedAt).toBeGreaterThanOrEqual(summary.startedAt);
    expect(results).toEqual(["prepare:ready", "execute:done"]);
  });

  it("rolls back completed steps when a dependent fails", async () => {
    const engine = new WorkflowEngine();
    const rollback = vi.fn();
    const context = createContext();

    const summary = await engine.run(
      [
        {
          id: "stage",
          async run() {
            return "ok";
          },
          rollback,
        },
        {
          id: "explode",
          dependsOn: ["stage"],
          async run() {
            throw new Error("boom");
          },
        },
      ],
      context
    );

    expect(Array.from(summary.completed)).toEqual(["stage"]);
    expect(summary.failed.has("explode")).toBe(true);
    expect(rollback).toHaveBeenCalledTimes(1);
  });

  it("retries failed nodes according to policy", async () => {
    vi.useFakeTimers();
    const engine = new WorkflowEngine();
    let attempts = 0;

    const summaryPromise = engine.run(
      [
        {
          id: "retryable",
          async run() {
            attempts += 1;
            if (attempts === 1) {
              throw new Error("first failure");
            }
            return "success";
          },
          retry: {
            attempts: 2,
            delayMs: 10,
          },
        },
      ],
      createContext()
    );

    await vi.runAllTimersAsync();
    const summary = await summaryPromise;
    expect(attempts).toBe(2);
    expect(Array.from(summary.completed)).toEqual(["retryable"]);
    vi.useRealTimers();
  });
});
