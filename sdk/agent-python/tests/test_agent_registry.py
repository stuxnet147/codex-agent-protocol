from codex_agent_protocol import (
    AgentDefinition,
    AgentRegistry,
    AgentStatus,
    Capability,
)


def test_register_and_update_state():
    registry = AgentRegistry()
    definition = AgentDefinition(
        id="assistant",
        name="Assistant",
        capabilities=[Capability.READ_FS],
    )
    events: list[str] = []
    registry.on("registered", lambda entry: events.append(entry.definition.id))
    registry.register(definition)

    state = registry.set_status("assistant", AgentStatus.RUNNING)
    assert state.status is AgentStatus.RUNNING
    assert registry.get("assistant").state.status is AgentStatus.RUNNING
    assert events == ["assistant"]


