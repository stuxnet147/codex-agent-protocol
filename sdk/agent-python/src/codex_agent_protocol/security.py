"""Capability enforcement helpers."""

from __future__ import annotations

import os
from typing import Dict, Iterable

from .types import Capability, SecurityDescriptor


class SecurityGuard:
    """Applies declarative security descriptors at runtime."""

    def __init__(self) -> None:
        self._descriptors: Dict[str, SecurityDescriptor] = {}

    def register(self, descriptor: SecurityDescriptor) -> None:
        self._descriptors[descriptor.agent_id] = descriptor

    def unregister(self, agent_id: str) -> None:
        self._descriptors.pop(agent_id, None)

    def assert_capability(self, agent_id: str, capability: Capability) -> None:
        descriptor = self._require(agent_id)
        if capability not in descriptor.capabilities:
            raise PermissionError(f"Agent {agent_id} lacks capability {capability}.")

    def assert_fs_access(self, agent_id: str, target_path: str) -> None:
        descriptor = self._require(agent_id)
        self.assert_capability(agent_id, Capability.READ_FS)
        allow_list = descriptor.fs_allow_list or []
        if not allow_list:
            return
        normalized_target = os.path.realpath(target_path)
        for allowed in allow_list:
            if normalized_target.startswith(os.path.realpath(allowed)):
                return
        raise PermissionError(f"Path {target_path} is not permitted for agent {agent_id}.")

    def assert_exec(self, agent_id: str, binary_path: str) -> None:
        descriptor = self._require(agent_id)
        self.assert_capability(agent_id, Capability.EXEC)
        allow_list = descriptor.exec_allow_list or []
        if not allow_list:
            return
        normalized_binary = os.path.realpath(binary_path)
        if any(normalized_binary == os.path.realpath(path) for path in allow_list):
            return
        raise PermissionError(f"Binary {binary_path} is not permitted for agent {agent_id}.")

    def assert_network_outbound(self, agent_id: str) -> None:
        descriptor = self._require(agent_id)
        self.assert_capability(agent_id, Capability.NET_OUTBOUND)
        if descriptor.allow_network_outbound is False:
            raise PermissionError(f"Outbound network access disabled for agent {agent_id}.")

    def assert_network_inbound(self, agent_id: str) -> None:
        descriptor = self._require(agent_id)
        self.assert_capability(agent_id, Capability.NET_INBOUND)
        if descriptor.allow_network_inbound is False:
            raise PermissionError(f"Inbound network access disabled for agent {agent_id}.")

    def _require(self, agent_id: str) -> SecurityDescriptor:
        descriptor = self._descriptors.get(agent_id)
        if not descriptor:
            raise KeyError(f"Security descriptor missing for agent {agent_id}.")
        return descriptor

