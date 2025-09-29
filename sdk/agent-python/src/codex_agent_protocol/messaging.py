"""Messaging primitives used by the agent runtime."""

from __future__ import annotations

import threading
import time
import uuid
from collections import defaultdict
from typing import Callable, Dict, Iterable, List, MutableMapping, Optional, Set

from .types import AgentId, MessageEnvelope, SessionRecord

MessageHandler = Callable[[MessageEnvelope], None]


class MessageBus:
    """Simple in-memory pub/sub message bus."""

    def __init__(self) -> None:
        self._topics: MutableMapping[str, Set[MessageHandler]] = defaultdict(set)
        self._direct: MutableMapping[AgentId, Set[MessageHandler]] = defaultdict(set)
        self._lock = threading.RLock()

    def publish(self, topic: str, payload: object, session_id: str | None = None) -> MessageEnvelope:
        envelope = MessageEnvelope(
            id=str(uuid.uuid4()),
            topic=topic,
            payload=payload,
            session_id=session_id,
            type="broadcast",
            timestamp=time.time() * 1000,
        )
        self._dispatch(topic, envelope)
        return envelope

    def send_to_agent(self, agent_id: AgentId, payload: object, session_id: str | None = None) -> MessageEnvelope:
        envelope = MessageEnvelope(
            id=str(uuid.uuid4()),
            topic=agent_id,
            payload=payload,
            session_id=session_id,
            type="direct",
            timestamp=time.time() * 1000,
        )
        self._dispatch_direct(agent_id, envelope)
        return envelope

    def subscribe(self, topic: str, handler: MessageHandler) -> None:
        with self._lock:
            self._topics[topic].add(handler)

    def subscribe_agent(self, agent_id: AgentId, handler: MessageHandler) -> None:
        with self._lock:
            self._direct[agent_id].add(handler)

    def unsubscribe(self, topic: str, handler: MessageHandler) -> None:
        with self._lock:
            handlers = self._topics.get(topic)
            if handlers:
                handlers.discard(handler)
                if not handlers:
                    self._topics.pop(topic, None)
            direct = self._direct.get(topic)
            if direct:
                direct.discard(handler)
                if not direct:
                    self._direct.pop(topic, None)

    def _dispatch(self, topic: str, message: MessageEnvelope) -> None:
        for handler in list(self._topics.get(topic, set())):
            handler(message)

    def _dispatch_direct(self, agent_id: AgentId, message: MessageEnvelope) -> None:
        for handler in list(self._direct.get(agent_id, set())):
            handler(message)


class SessionStore:
    """Session metadata and context storage."""

    def __init__(self) -> None:
        self._sessions: Dict[str, SessionRecord] = {}
        self._lock = threading.RLock()

    def create(self, ttl_ms: Optional[int] = None, seed_context: Optional[Dict[str, object]] = None) -> SessionRecord:
        session_id = str(uuid.uuid4())
        now = time.time() * 1000
        session = SessionRecord(
            id=session_id,
            created_at=now,
            expires_at=(now + ttl_ms) if ttl_ms else None,
            ttl_ms=ttl_ms,
            context=dict(seed_context or {}),
            agents=set(),
        )
        with self._lock:
            self._sessions[session_id] = session
        return session

    def attach_agent(self, session_id: str, agent_id: AgentId) -> None:
        self._require(session_id).agents.add(agent_id)

    def detach_agent(self, session_id: str, agent_id: AgentId) -> None:
        self._require(session_id).agents.discard(agent_id)

    def get(self, session_id: str) -> SessionRecord | None:
        with self._lock:
            session = self._sessions.get(session_id)
        if not session:
            return None
        if self._is_expired(session):
            self.delete(session_id)
            return None
        return session

    def set_context(self, session_id: str, key: str, value: object) -> None:
        self._require(session_id).context[key] = value

    def get_context(self, session_id: str, key: str) -> object | None:
        return self._require(session_id).context.get(key)

    def extend(self, session_id: str, ttl_ms: int) -> None:
        session = self._require(session_id)
        session.ttl_ms = ttl_ms
        session.expires_at = time.time() * 1000 + ttl_ms

    def delete(self, session_id: str) -> None:
        with self._lock:
            self._sessions.pop(session_id, None)

    def sweep(self) -> None:
        with self._lock:
            expired = [sid for sid, session in self._sessions.items() if self._is_expired(session)]
            for sid in expired:
                self._sessions.pop(sid, None)

    def list(self) -> List[SessionRecord]:
        self.sweep()
        with self._lock:
            return list(self._sessions.values())

    def _require(self, session_id: str) -> SessionRecord:
        session = self.get(session_id)
        if not session:
            raise KeyError(f"Unknown or expired session {session_id}")
        return session

    @staticmethod
    def _is_expired(session: SessionRecord) -> bool:
        return bool(session.expires_at and session.expires_at <= time.time() * 1000)

