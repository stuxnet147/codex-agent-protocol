import os
import tempfile

import pytest

from codex_agent_protocol import Capability, SecurityDescriptor, SecurityGuard


def test_security_guard_enforces_fs_allowlist():
    guard = SecurityGuard()
    with tempfile.TemporaryDirectory() as tempdir:
        guard.register(
            SecurityDescriptor(
                agent_id="agent",
                capabilities=[Capability.READ_FS],
                fs_allow_list=[tempdir],
            )
        )
        allowed_file = os.path.join(tempdir, "file.txt")
        guard.assert_fs_access("agent", allowed_file)
        with pytest.raises(PermissionError):
            guard.assert_fs_access("agent", "/etc/passwd")

