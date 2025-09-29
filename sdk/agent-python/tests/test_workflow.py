import asyncio

from codex_agent_protocol import (
    InMemoryContextStore,
    WorkflowContext,
    WorkflowEngine,
    WorkflowExecutionOptions,
    WorkflowNodeDefinition,
)


def test_workflow_runs_in_order():
    store = InMemoryContextStore()
    engine = WorkflowEngine()
    order: list[str] = []

    async def task_a(context: WorkflowContext) -> str:
        order.append("a")
        return "a"

    async def task_b(context: WorkflowContext) -> str:
        order.append("b")
        return "b"

    summary = asyncio.run(
        engine.run(
            nodes=[
                WorkflowNodeDefinition(id="a", run=task_a),
                WorkflowNodeDefinition(id="b", run=task_b, depends_on=["a"]),
            ],
            context=WorkflowContext(context_store=store),
            options=WorkflowExecutionOptions(concurrency=2),
        )
    )

    assert summary.completed == {"a", "b"}
    assert order == ["a", "b"]


def test_workflow_rolls_back_on_failure():
    store = InMemoryContextStore()
    engine = WorkflowEngine()
    rollback_called = []

    async def task(context: WorkflowContext) -> None:
        rollback_called.append("run")
        raise RuntimeError("boom")

    async def rollback(context: WorkflowContext) -> None:
        rollback_called.append("rollback")

    summary = asyncio.run(
        engine.run(
            nodes=[
                WorkflowNodeDefinition(
                    id="task", run=task, rollback=rollback, retry={"attempts": 1}
                ),
            ],
            context=WorkflowContext(context_store=store),
        )
    )

    assert "task" in summary.failed
    assert rollback_called == ["run"]

