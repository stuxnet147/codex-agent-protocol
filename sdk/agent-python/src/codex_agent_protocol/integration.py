"""Integration adapter registry."""

from __future__ import annotations

from typing import Any, Dict, Iterable, List

from .types import IntegrationAdapter


class IntegrationHost:
    def __init__(self) -> None:
        self._adapters: Dict[str, IntegrationAdapter] = {}

    def register(self, adapter: IntegrationAdapter) -> None:
        if adapter.name in self._adapters:
            raise ValueError(f"Adapter {adapter.name} already registered.")
        self._adapters[adapter.name] = adapter

    def unregister(self, name: str) -> None:
        self._adapters.pop(name, None)

    def list(self) -> List[IntegrationAdapter]:
        return list(self._adapters.values())

    async def invoke(self, name: str, args: Any) -> Any:
        adapter = self._adapters.get(name)
        if not adapter:
            raise KeyError(f"Unknown adapter {name}.")
        result = adapter.invoke(args)
        if hasattr(result, "__await__"):
            return await result  # type: ignore[return-value]
        return result

