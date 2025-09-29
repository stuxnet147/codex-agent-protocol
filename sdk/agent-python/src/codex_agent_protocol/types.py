"""Shared type definitions for the Python Codex agent SDK."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Awaitable, Callable, Dict, Iterable, List, MutableMapping, Optional, Protocol, Set, Tuple, TypeVar, Union

AgentId = str


class AgentStatus(str, Enum):
    """Runtime states for a registered agent."""

    IDLE = "idle"
    RUNNING = "running"
    ERROR = "error"
    STOPPED = "stopped"
    OFFLINE = "offline"


class Capability(str, Enum):
    READ_FS = "readFs"
    WRITE_FS = "writeFs"
    EXEC = "exec"
    NET_OUTBOUND = "netOutbound"
    NET_INBOUND = "netInbound"


@dataclass
class AgentDefinition:
    id: AgentId
    name: str
    capabilities: List[Capability]
    metadata: Optional[Dict[str, Any]] = None
    singleton: bool = False
    max_instances: Optional[int] = None
    resource_limits: Optional[Dict[str, Union[int, float]]] = None


@dataclass
class AgentRuntimeState:
    status: AgentStatus
    updated_at: float
    error: Optional[str] = None
    resource_usage: Optional[Dict[str, Union[int, float]]] = None


@dataclass
class AgentRegistryEntry:
    definition: AgentDefinition
    state: AgentRuntimeState


@dataclass
class ProcessLaunchOptions:
    command: str
    args: Optional[List[str]] = None
    cwd: Optional[str] = None
    env: Optional[Dict[str, str]] = None
    auto_restart: bool = False
    max_restarts: Optional[int] = None
    backoff_ms: int = 1000


@dataclass
class CodexCommand:
    op: str
    args: Optional[Dict[str, Any]] = None
    timeout_ms: Optional[int] = None


@dataclass
class CodexResult:
    ok: bool
    data: Any = None
    error: Optional[str] = None


@dataclass
class MessageEnvelope:
    id: str
    session_id: Optional[str]
    type: str
    topic: str
    payload: Any
    timestamp: float
    headers: Optional[Dict[str, Any]] = None


@dataclass
class SessionRecord:
    id: str
    created_at: float
    expires_at: Optional[float]
    ttl_ms: Optional[int]
    context: Dict[str, Any]
    agents: Set[AgentId]


RetryConfig = Tuple[int, Optional[int]]


class ContextStoreProtocol(Protocol):
    def set(self, namespace: str, key: str, value: Any) -> None:
        ...

    def get(self, namespace: str, key: str) -> Any:
        ...

    def delete(self, namespace: str, key: str) -> None:
        ...

    def snapshot(self, namespace: str) -> "ContextSnapshot":
        ...


@dataclass
class WorkflowNodeDefinition:
    id: str
    run: "WorkflowTaskHandler"
    rollback: Optional["WorkflowTaskHandler"] = None
    depends_on: Optional[List[str]] = None
    retry: Optional[Dict[str, Union[int, float]]] = None


@dataclass
class WorkflowExecutionOptions:
    concurrency: int = 1
    on_task_complete: Optional[Callable[[str, Any], None]] = None
    on_task_error: Optional[Callable[[str, Any], None]] = None


@dataclass
class WorkflowRunSummary:
    completed: Set[str] = field(default_factory=set)
    completed_order: List[str] = field(default_factory=list)
    failed: MutableMapping[str, Any] = field(default_factory=dict)
    started_at: float = 0.0
    finished_at: Optional[float] = None


@dataclass
class WorkflowContext:
    context_store: ContextStoreProtocol
    session_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


WorkflowTaskHandler = Callable[[WorkflowContext], Union[Any, Awaitable[Any]]]


@dataclass
class ContextSnapshot:
    id: str
    created_at: float
    data: Dict[str, Any]


@dataclass
class PromptPackage:
    session_id: Optional[str]
    entries: List[Dict[str, Any]]
    attachments: Optional[List[Dict[str, Any]]] = None


@dataclass
class TelemetryEvent:
    name: str
    timestamp: float
    level: str
    payload: Optional[Dict[str, Any]] = None


class TelemetrySink(Protocol):
    def handle(self, event: TelemetryEvent) -> None:
        ...


@dataclass
class SecurityDescriptor:
    agent_id: AgentId
    capabilities: Iterable[Capability]
    fs_allow_list: Optional[List[str]] = None
    exec_allow_list: Optional[List[str]] = None
    allow_network_outbound: bool = True
    allow_network_inbound: bool = True


@dataclass
class IntegrationAdapter:
    name: str
    capabilities: Iterable[Capability]
    invoke: Callable[[Any], Union[Any, Awaitable[Any]]]


@dataclass
class IntegrationInvocation:
    adapter: IntegrationAdapter
    args: Any


T = TypeVar("T")
