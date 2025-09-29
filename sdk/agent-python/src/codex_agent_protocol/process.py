"""Process management utilities."""

from __future__ import annotations

import json
import os
import queue
import signal
import subprocess
import threading
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from .types import CodexCommand, CodexResult, ProcessLaunchOptions

SupervisorHandler = Callable[..., None]


class ProcessSupervisor:
    """Supervises a child process with optional restart semantics."""

    def __init__(self, options: ProcessLaunchOptions) -> None:
        self._options = options
        self._child: Optional[subprocess.Popen[str]] = None
        self._lock = threading.RLock()
        self._restarts = 0
        self._shutting_down = False
        self._handlers: Dict[str, List[SupervisorHandler]] = {
            "started": [],
            "exited": [],
            "failed": [],
            "restarted": [],
        }

    def is_running(self) -> bool:
        with self._lock:
            return bool(self._child and self._child.poll() is None)

    def get_child(self) -> subprocess.Popen[str] | None:
        with self._lock:
            return self._child

    def start(self) -> None:
        with self._lock:
            if self.is_running():
                return
            try:
                self._child = subprocess.Popen(
                    [self._options.command, *(self._options.args or [])],
                    cwd=self._options.cwd,
                    env={**os.environ, **(self._options.env or {})},
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                )
            except Exception as exc:  # noqa: BLE001
                self._emit("failed", exc)
                if self._options.auto_restart:
                    self._schedule_restart()
                return

            self._shutting_down = False
            threading.Thread(target=self._watch_child, daemon=True).start()
            self._emit("started", self._child)

    def stop(self, sig: int = signal.SIGTERM) -> None:
        with self._lock:
            if not self._child or self._child.poll() is not None:
                return
            self._shutting_down = True
            try:
                self._child.send_signal(sig)
            except Exception:
                self._child.terminate()

    def on(self, event: str, handler: SupervisorHandler) -> None:
        self._handlers[event].append(handler)

    def _watch_child(self) -> None:
        child = self.get_child()
        if not child:
            return
        code = child.wait()
        self._emit("exited", code, None)
        with self._lock:
            self._child = None
        if not self._shutting_down and self._options.auto_restart:
            self._schedule_restart()

    def _schedule_restart(self) -> None:
        if not self._options.auto_restart:
            return
        if self._options.max_restarts is not None and self._restarts >= self._options.max_restarts:
            self._emit("failed", RuntimeError("Maximum restart attempts exceeded."))
            return
        self._restarts += 1
        delay = (self._options.backoff_ms or 1000) / 1000
        def _restart() -> None:
            self._emit("restarted", self._restarts)
            self.start()
        timer = threading.Timer(delay, _restart)
        timer.daemon = True
        timer.start()

    def _emit(self, event: str, *args: object) -> None:
        for handler in list(self._handlers.get(event, [])):
            handler(*args)


@dataclass
class CodexClientOptions:
    cli_path: Optional[str] = None
    node_path: Optional[str] = None
    command_path: Optional[str] = None
    command_args: Optional[List[str]] = None
    cwd: Optional[str] = None
    env: Optional[Dict[str, str]] = None
    auto_restart: bool = True
    max_restarts: int = 5
    backoff_ms: int = 1000
    response_timeout_ms: int = 30_000


class CodexClient:
    """Manages the Codex CLI child process."""

    DEFAULT_RELATIVE_CLI_PATH = "ref/codex-src/codex-cli/bin/codex.js"

    def __init__(self, options: Optional[CodexClientOptions] = None) -> None:
        self._options = options or CodexClientOptions()
        launch = self._resolve_launch_options(self._options)
        self._supervisor = ProcessSupervisor(launch)
        self._pending: Dict[str, queue.Queue[CodexResult]] = {}
        self._response_timeout = self._options.response_timeout_ms
        self._stopping = False
        self._handlers: Dict[str, List[Callable[..., None]]] = {
            "notification": [],
            "protocolError": [],
            "restarted": [],
        }
        self._reader_thread: Optional[threading.Thread] = None
        self._reader_lock = threading.RLock()

        self._supervisor.on("started", self._attach_child)
        self._supervisor.on(
            "exited", lambda *_: self._handle_failure(RuntimeError("Codex CLI process exited."))
        )
        self._supervisor.on(
            "failed", lambda error: self._handle_failure(self._coerce_error(error))
        )
        self._supervisor.on("restarted", lambda attempt: self._emit("restarted", attempt))

    def start(self) -> None:
        if self._supervisor.is_running():
            return
        self._supervisor.start()

    def stop(self) -> None:
        self._stopping = True
        self._supervisor.stop()
        self._detach_child()
        self._fail_inflight(RuntimeError("Codex CLI client stopped."))
        self._stopping = False

    def exec(self, command: CodexCommand) -> CodexResult:
        if not self._supervisor.is_running():
            self.start()
        child = self._supervisor.get_child()
        if not child or not child.stdin:
            raise RuntimeError("Codex CLI process is not available.")
        request_id = str(uuid.uuid4())
        payload = json.dumps({"id": request_id, **command.__dict__})
        result_queue: queue.Queue[CodexResult] = queue.Queue(maxsize=1)
        self._pending[request_id] = result_queue
        child.stdin.write(payload + "\n")
        child.stdin.flush()
        try:
            return result_queue.get(timeout=(command.timeout_ms or self._response_timeout) / 1000)
        except queue.Empty as exc:
            self._pending.pop(request_id, None)
            raise TimeoutError("Codex CLI response timed out.") from exc

    def on(self, event: str, handler: Callable[..., None]) -> None:
        self._handlers[event].append(handler)

    def _attach_child(self, child: subprocess.Popen[str]) -> None:
        with self._reader_lock:
            self._detach_child()
            if not child.stdout or not child.stderr:
                return
            self._reader_thread = threading.Thread(
                target=self._read_stdout, args=(child,), daemon=True
            )
            self._reader_thread.start()
            threading.Thread(target=self._read_stderr, args=(child,), daemon=True).start()

    def _detach_child(self) -> None:
        with self._reader_lock:
            self._reader_thread = None

    def _read_stdout(self, child: subprocess.Popen[str]) -> None:
        assert child.stdout is not None
        for line in child.stdout:
            self._handle_line(line.strip())

    def _read_stderr(self, child: subprocess.Popen[str]) -> None:
        assert child.stderr is not None
        for line in child.stderr:
            if not line.strip():
                continue
            error = self._coerce_error(line.strip())
            self._emit("protocolError", error)
            self._fail_inflight(error)

    def _handle_line(self, line: str) -> None:
        if not line:
            return
        try:
            message = json.loads(line)
        except json.JSONDecodeError as exc:
            error = self._coerce_error(f"Failed to parse Codex CLI response: {exc}")
            self._emit("protocolError", error)
            self._fail_inflight(error)
            return
        if not isinstance(message, dict):
            error = self._coerce_error("Codex CLI emitted non-object payload.")
            self._emit("protocolError", error)
            self._fail_inflight(error)
            return
        request_id = message.get("id")
        if not request_id:
            self._emit("notification", message)
            return
        pending = self._pending.pop(request_id, None)
        if not pending:
            return
        if not isinstance(message.get("ok"), bool):
            error = self._coerce_error(
                f"Codex CLI response missing ok flag for id {request_id}"
            )
            pending.put(CodexResult(ok=False, error=str(error)))
            return
        if message["ok"] is False:
            pending.put(CodexResult(ok=False, error=message.get("error")))
            return
        pending.put(CodexResult(ok=True, data=message.get("data")))

    def _fail_inflight(self, error: Exception) -> None:
        for request_id, pending in list(self._pending.items()):
            pending.put(CodexResult(ok=False, error=str(error)))
            self._pending.pop(request_id, None)

    def _handle_failure(self, error: Exception) -> None:
        if not self._stopping:
            self._emit("protocolError", error)
        self._fail_inflight(error)

    def _emit(self, event: str, *args: object) -> None:
        for handler in list(self._handlers.get(event, [])):
            handler(*args)

    def _coerce_error(self, error: Any) -> Exception:
        if isinstance(error, Exception):
            return error
        return RuntimeError(str(error))

    @classmethod
    def _resolve_launch_options(cls, options: CodexClientOptions) -> ProcessLaunchOptions:
        base_dir = Path(options.cwd or os.getcwd())
        if options.cli_path:
            cli_path = base_dir / options.cli_path
        else:
            cli_path = cls._try_resolve_cli(base_dir)
        command = options.command_path or options.node_path or os.environ.get("NODE_PATH") or "node"
        args = options.command_args or [str(cli_path)]
        return ProcessLaunchOptions(
            command=command,
            args=args,
            cwd=options.cwd,
            env=options.env,
            auto_restart=options.auto_restart,
            max_restarts=options.max_restarts,
            backoff_ms=options.backoff_ms,
        )

    @classmethod
    def _try_resolve_cli(cls, base_dir: Path) -> Path:
        package_path = os.environ.get("CODEX_CLI_PATH")
        if package_path:
            return Path(package_path)
        node_modules = base_dir / "node_modules" / "@openai" / "codex" / "bin" / "codex.js"
        if node_modules.exists():
            return node_modules
        return base_dir / cls.DEFAULT_RELATIVE_CLI_PATH

