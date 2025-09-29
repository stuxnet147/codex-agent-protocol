"""Workflow orchestration engine."""

from __future__ import annotations

import asyncio
import time
from collections import defaultdict
from typing import Any, Awaitable, Callable, Dict, Iterable, List, Optional, Set

from .types import (
    WorkflowContext,
    WorkflowExecutionOptions,
    WorkflowNodeDefinition,
    WorkflowRunSummary,
)

EventHandler = Callable[..., None]


class WorkflowEngine:
    """Async workflow executor with dependency tracking and rollback."""

    def __init__(self) -> None:
        self._handlers: Dict[str, List[EventHandler]] = defaultdict(list)

    async def run(
        self,
        nodes: Iterable[WorkflowNodeDefinition],
        context: WorkflowContext,
        options: Optional[WorkflowExecutionOptions] = None,
    ) -> WorkflowRunSummary:
        options = options or WorkflowExecutionOptions()
        node_list = list(nodes)
        definition_map = {node.id: node for node in node_list}
        summary = WorkflowRunSummary(started_at=time.time() * 1000)
        remaining: Dict[str, WorkflowNodeDefinition] = dict(definition_map)

        in_flight: Set[str] = set()
        queued: Set[str] = set()
        ready: asyncio.Queue[WorkflowNodeDefinition] = asyncio.Queue()

        def dependencies_satisfied(node: WorkflowNodeDefinition) -> bool:
            deps = node.depends_on or []
            return all(dep in summary.completed for dep in deps)

        def enqueue_ready_nodes() -> None:
            for node in list(remaining.values()):
                if node.id in in_flight or node.id in queued:
                    continue
                if node.id in summary.completed or node.id in summary.failed:
                    continue
                if dependencies_satisfied(node):
                    ready.put_nowait(node)
                    queued.add(node.id)

        self._emit("started", node_list)
        enqueue_ready_nodes()

        async def worker() -> None:
            while True:
                if summary.failed:
                    return
                if len(summary.completed) == len(definition_map):
                    return
                try:
                    node = await asyncio.wait_for(ready.get(), timeout=0.1)
                except asyncio.TimeoutError:
                    enqueue_ready_nodes()
                    continue
                if node.id in summary.completed or node.id in summary.failed:
                    continue
                in_flight.add(node.id)
                try:
                    await self._execute_node(node, context, summary, options, definition_map)
                finally:
                    in_flight.discard(node.id)
                    remaining.pop(node.id, None)
                    queued.discard(node.id)
                    enqueue_ready_nodes()

        workers = [asyncio.create_task(worker()) for _ in range(max(1, options.concurrency))]
        await asyncio.gather(*workers)

        summary.finished_at = time.time() * 1000
        self._emit("finished", summary)
        return summary

    async def _execute_node(
        self,
        node: WorkflowNodeDefinition,
        context: WorkflowContext,
        summary: WorkflowRunSummary,
        options: WorkflowExecutionOptions,
        definition_map: Dict[str, WorkflowNodeDefinition],
    ) -> None:
        attempts = 0
        retry = node.retry or {}
        max_attempts = max(1, int(retry.get("attempts", 1)))
        delay_ms = float(retry.get("delayMs", 0))

        while attempts < max_attempts:
            attempts += 1
            try:
                result = await _maybe_await(node.run(context))
                summary.completed.add(node.id)
                summary.completed_order.append(node.id)
                if options.on_task_complete:
                    options.on_task_complete(node.id, result)
                self._emit("taskComplete", node.id, result)
                return
            except Exception as exc:  # noqa: BLE001
                if attempts >= max_attempts:
                    summary.failed[node.id] = exc
                    if options.on_task_error:
                        options.on_task_error(node.id, exc)
                    self._emit("taskFailed", node.id, exc)
                    await self._rollback_completed(context, summary, definition_map)
                    return
                if delay_ms > 0:
                    await asyncio.sleep(delay_ms / 1000)

    async def _rollback_completed(
        self,
        context: WorkflowContext,
        summary: WorkflowRunSummary,
        definition_map: Dict[str, WorkflowNodeDefinition],
    ) -> None:
        for node_id in reversed(summary.completed_order):
            node = definition_map.get(node_id)
            if not node or not node.rollback:
                continue
            try:
                await _maybe_await(node.rollback(context))
            except Exception as exc:  # noqa: BLE001
                self._emit("taskFailed", node.id, exc)

    def on(self, event: str, handler: EventHandler) -> None:
        self._handlers[event].append(handler)

    def _emit(self, event: str, *args: object) -> None:
        for handler in list(self._handlers.get(event, [])):
            handler(*args)


async def _maybe_await(value: Any) -> Any:
    if asyncio.iscoroutine(value) or isinstance(value, Awaitable):
        return await value  # type: ignore[return-value]
    return value

