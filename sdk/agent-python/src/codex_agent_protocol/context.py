"""Context storage helpers."""

from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional

from .types import ContextSnapshot, ContextStoreProtocol, PromptPackage


class InMemoryContextStore(ContextStoreProtocol):
    """Thread-safe namespace-aware context store."""

    def __init__(self) -> None:
        self._namespaces: Dict[str, Dict[str, object]] = {}
        self._lock = threading.RLock()

    def set(self, namespace: str, key: str, value: object) -> None:  # type: ignore[override]
        with self._lock:
            store = self._namespaces.setdefault(namespace, {})
            store[key] = value

    def get(self, namespace: str, key: str) -> object | None:  # type: ignore[override]
        with self._lock:
            store = self._namespaces.get(namespace)
            if not store:
                return None
            return store.get(key)

    def delete(self, namespace: str, key: str) -> None:  # type: ignore[override]
        with self._lock:
            store = self._namespaces.get(namespace)
            if not store:
                return
            store.pop(key, None)
            if not store:
                self._namespaces.pop(namespace, None)

    def snapshot(self, namespace: str) -> ContextSnapshot:  # type: ignore[override]
        with self._lock:
            store = dict(self._namespaces.get(namespace, {}))
        return ContextSnapshot(id=str(uuid.uuid4()), created_at=time.time() * 1000, data=store)

    def list_namespaces(self) -> List[str]:
        with self._lock:
            return list(self._namespaces.keys())

    def clear(self) -> None:
        with self._lock:
            self._namespaces.clear()


@dataclass
class PromptPackOptions:
    namespace: str
    keys: Optional[Iterable[str]] = None
    session_id: Optional[str] = None
    attachments: Optional[List[Dict[str, object]]] = None


def pack_prompt(store: ContextStoreProtocol, options: PromptPackOptions) -> PromptPackage:
    """Collects stored context data into a prompt package."""

    entries: List[Dict[str, object]] = []
    if not options.keys:
        snapshot = store.snapshot(options.namespace)
        for key, value in snapshot.data.items():
            entries.append({"key": key, "value": value})
    else:
        for key in options.keys:
            value = store.get(options.namespace, key)
            if value is not None:
                entries.append({"key": key, "value": value})
    return PromptPackage(
        session_id=options.session_id,
        entries=entries,
        attachments=options.attachments,
    )

