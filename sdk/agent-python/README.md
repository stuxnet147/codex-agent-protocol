# Codex Agent Protocol (Python)

This package provides a Python-native SDK that mirrors the TypeScript Codex agent runtime. It offers in-memory registries, workflow orchestration, process supervision, session management, messaging, telemetry helpers, and security guard rails for building Codex-compatible agents.

## Installation

```bash
pip install .
```

The project requires Python 3.10 or later.

## Quick start

```python
from codex_agent_protocol import (
    AgentDefinition,
    AgentRegistry,
    AgentStatus,
    InMemoryContextStore,
    PromptPackOptions,
    SessionStore,
    WorkflowContext,
    WorkflowEngine,
    WorkflowNodeDefinition,
    pack_prompt,
)

registry = AgentRegistry()
registry.register(
    AgentDefinition(
        id="search-agent",
        name="Search Agent",
        capabilities=[],
    )
)
registry.set_status("search-agent", AgentStatus.RUNNING)

context_store = InMemoryContextStore()
context_store.set("session", "question", "What is the weather today?")
prompt = pack_prompt(context_store, PromptPackOptions(namespace="session"))

session_store = SessionStore()
session = session_store.create()

async def main() -> None:
    engine = WorkflowEngine()
    summary = await engine.run(
        nodes=[
            WorkflowNodeDefinition(
                id="fetch",
                run=lambda ctx: "72F and sunny",
            )
        ],
        context=WorkflowContext(context_store=context_store, session_id=session.id),
    )
    print(summary.completed)
```

## Features

- **Agent lifecycle** – `AgentRegistry` tracks definitions, runtime status, and resource usage.
- **Process supervision** – `ProcessSupervisor` and `CodexClient` manage Codex CLI child processes.
- **Messaging** – `MessageBus` delivers broadcast and direct messages; `SessionStore` maintains per-session context.
- **Workflow engine** – `WorkflowEngine` orchestrates dependent tasks with retries and rollback hooks.
- **Context utilities** – `InMemoryContextStore` snapshots namespace data; `pack_prompt` builds prompt packages.
- **Telemetry** – `Telemetry` produces structured logs and forwards them to custom sinks.
- **Security** – `SecurityGuard` enforces capability and filesystem/network allow lists.
- **Integrations** – `IntegrationHost` registers and invokes capability-constrained adapters.

## Development

Install dependencies and run the test suite:

```bash
pip install -e .[dev]
pip install pytest
pytest
```

