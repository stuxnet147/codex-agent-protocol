"""Agent registration and lifecycle tracking."""

from __future__ import annotations

import threading
import time
from collections import defaultdict
from typing import Callable, Dict, List, MutableMapping

from .types import AgentDefinition, AgentId, AgentRegistryEntry, AgentRuntimeState, AgentStatus

EventHandler = Callable[..., None]


class AgentRegistry:
    """In-memory registry mirroring the TypeScript implementation."""

    def __init__(self) -> None:
        self._entries: MutableMapping[AgentId, AgentRegistryEntry] = {}
        self._handlers: Dict[str, List[EventHandler]] = defaultdict(list)
        self._lock = threading.RLock()

    def register(self, definition: AgentDefinition) -> AgentRegistryEntry:
        with self._lock:
            existing = self._entries.get(definition.id)
            if existing and definition.singleton:
                raise ValueError(f"Agent {definition.id} already registered as singleton.")

            state = existing.state if existing else AgentRuntimeState(
                status=AgentStatus.OFFLINE,
                updated_at=time.time() * 1000,
            )
            entry = AgentRegistryEntry(definition=definition, state=state)
            self._entries[definition.id] = entry
            self._emit("registered", entry)
            return entry

    def unregister(self, agent_id: AgentId) -> bool:
        with self._lock:
            deleted = self._entries.pop(agent_id, None)
            if deleted:
                self._emit("unregistered", agent_id)
                return True
            return False

    def update_state(self, agent_id: AgentId, **state: object) -> AgentRuntimeState:
        with self._lock:
            entry = self._entries.get(agent_id)
            if not entry:
                raise KeyError(f"Agent {agent_id} is not registered.")
            merged = AgentRuntimeState(
                status=state.get("status", entry.state.status),
                updated_at=time.time() * 1000,
                error=state.get("error", entry.state.error),
                resource_usage=state.get("resource_usage", entry.state.resource_usage),
            )
            entry.state = merged
            self._emit("stateChanged", agent_id, merged)
            return merged

    def set_status(self, agent_id: AgentId, status: AgentStatus, error: str | None = None) -> AgentRuntimeState:
        return self.update_state(agent_id, status=status, error=error)

    def update_resources(self, agent_id: AgentId, usage: Dict[str, object]) -> AgentRuntimeState:
        return self.update_state(agent_id, resource_usage=usage)

    def get(self, agent_id: AgentId) -> AgentRegistryEntry | None:
        with self._lock:
            return self._entries.get(agent_id)

    def list(self) -> List[AgentRegistryEntry]:
        with self._lock:
            return list(self._entries.values())

    def has(self, agent_id: AgentId) -> bool:
        with self._lock:
            return agent_id in self._entries

    def on(self, event: str, handler: EventHandler) -> None:
        self._handlers[event].append(handler)

    def _emit(self, event: str, *args: object) -> None:
        for handler in list(self._handlers.get(event, [])):
            handler(*args)

