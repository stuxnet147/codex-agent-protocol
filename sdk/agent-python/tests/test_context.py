from codex_agent_protocol import InMemoryContextStore, PromptPackOptions, pack_prompt


def test_pack_prompt_with_keys():
    store = InMemoryContextStore()
    store.set("session", "question", "hello")
    store.set("session", "answer", "world")

    package = pack_prompt(store, PromptPackOptions(namespace="session", keys=["question"]))
    assert package.entries == [{"key": "question", "value": "hello"}]


def test_snapshot_copies_values():
    store = InMemoryContextStore()
    store.set("session", "foo", 1)
    snapshot = store.snapshot("session")
    store.set("session", "foo", 2)
    assert snapshot.data["foo"] == 1

