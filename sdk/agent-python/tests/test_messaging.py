import time

from codex_agent_protocol import MessageBus, SessionStore


def test_message_bus_delivers_messages():
    bus = MessageBus()
    received = []

    bus.subscribe("topic", lambda envelope: received.append(envelope.payload))
    bus.publish("topic", {"value": 1})

    assert received == [{"value": 1}]


def test_session_store_expiration():
    store = SessionStore()
    session = store.create(ttl_ms=10)
    assert store.get(session.id)
    time.sleep(0.02)
    assert store.get(session.id) is None

