import { EventEmitter } from "node:events";
import type {
  WorkflowContext,
  WorkflowExecutionOptions,
  WorkflowNodeDefinition,
  WorkflowRunSummary,
} from "../types/index.js";

export interface WorkflowEngineEvents {
  started: (nodes: WorkflowNodeDefinition[]) => void;
  taskComplete: (nodeId: string, result: unknown) => void;
  taskFailed: (nodeId: string, error: unknown) => void;
  finished: (summary: WorkflowRunSummary) => void;
}

export type WorkflowEngineEvent = keyof WorkflowEngineEvents;

type WorkflowEngineHandler<T extends WorkflowEngineEvent> = WorkflowEngineEvents[T];

export class WorkflowEngine extends EventEmitter {
  async run(
    nodes: WorkflowNodeDefinition[],
    context: WorkflowContext,
    options: WorkflowExecutionOptions = {}
  ): Promise<WorkflowRunSummary> {
    const summary: WorkflowRunSummary = {
      completed: new Set<string>(),
      failed: new Map<string, unknown>(),
      startedAt: Date.now(),
    };

    this.emit("started", nodes);

    const concurrency = options.concurrency ?? 1;
    const remaining = new Map<string, WorkflowNodeDefinition>();
    const dependents = new Map<string, Set<string>>();
    const inFlight = new Set<string>();

    nodes.forEach((node) => {
      remaining.set(node.id, node);
      (node.dependsOn ?? []).forEach((dependency) => {
        const set = dependents.get(dependency) ?? new Set<string>();
        set.add(node.id);
        dependents.set(dependency, set);
      });
    });

    const runQueue: Array<WorkflowNodeDefinition> = [];

    const enqueueReady = () => {
      remaining.forEach((node) => {
        if (inFlight.has(node.id)) {
          return;
        }
        if (summary.completed.has(node.id) || summary.failed.has(node.id)) {
          return;
        }
        const dependencies = node.dependsOn ?? [];
        const satisfied = dependencies.every((dep) => summary.completed.has(dep));
        if (satisfied && !runQueue.includes(node)) {
          runQueue.push(node);
        }
      });
    };

    const attemptNode = async (node: WorkflowNodeDefinition): Promise<void> => {
      inFlight.add(node.id);
      let attempts = 0;
      const maxAttempts = node.retry ? Math.max(1, node.retry.attempts) : 1;
      const delayMs = node.retry?.delayMs ?? 0;

      while (attempts < maxAttempts) {
        attempts += 1;
        try {
          const result = await node.run(context);
          summary.completed.add(node.id);
          inFlight.delete(node.id);
          options.onTaskComplete?.(node.id, result);
          this.emit("taskComplete", node.id, result);
          remaining.delete(node.id);
          enqueueReady();
          return;
        } catch (error) {
          if (attempts >= maxAttempts) {
            summary.failed.set(node.id, error);
            inFlight.delete(node.id);
            options.onTaskError?.(node.id, error);
            this.emit("taskFailed", node.id, error);
            remaining.delete(node.id);
            await this.rollbackCompleted(nodes, summary.completed, context);
            return;
          }
          if (delayMs > 0) {
            await new Promise<void>((resolve) => {
              setTimeout(resolve, delayMs);
            });
          }
        }
      }
    };

    enqueueReady();

    await new Promise<void>((resolve) => {
      const schedule = () => {
        if (summary.failed.size > 0) {
          resolve();
          return;
        }

        if (summary.completed.size === nodes.length) {
          resolve();
          return;
        }

        while (inFlight.size < concurrency && runQueue.length > 0) {
          const node = runQueue.shift();
          if (!node) {
            break;
          }
          attemptNode(node).then(schedule).catch((error) => {
            summary.failed.set(node.id, error);
            schedule();
          });
        }
      };

      schedule();
    });

    summary.finishedAt = Date.now();
    this.emit("finished", summary);
    return summary;
  }

  on<T extends WorkflowEngineEvent>(event: T, handler: WorkflowEngineHandler<T>): this {
    return super.on(event, handler as never);
  }

  private async rollbackCompleted(
    nodes: WorkflowNodeDefinition[],
    completed: Set<string>,
    context: WorkflowContext
  ): Promise<void> {
    const reversed = nodes
      .filter((node) => completed.has(node.id) && typeof node.rollback === "function")
      .reverse();

    for (const node of reversed) {
      try {
        await node.rollback?.(context);
      } catch (error) {
        // Rollback failures are logged but do not halt error propagation.
        this.emit("taskFailed", node.id, error);
      }
    }
  }
}
