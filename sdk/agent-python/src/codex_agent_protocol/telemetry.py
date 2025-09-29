"""Structured telemetry helpers."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Dict, List, Optional

from .types import TelemetryEvent, TelemetrySink


@dataclass
class TelemetryOptions:
    level: str = "INFO"
    bindings: Optional[Dict[str, object]] = None
    sinks: Optional[List[TelemetrySink]] = None
    logger: Optional[logging.Logger] = None


class Telemetry:
    """Lightweight logger-compatible telemetry pipeline."""

    def __init__(self, options: Optional[TelemetryOptions] = None) -> None:
        options = options or TelemetryOptions()
        self._logger = options.logger or logging.getLogger("codex.agent")
        self._logger.setLevel(options.level.upper())
        if not self._logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter("%(asctime)s %(name)s %(levelname)s %(message)s")
            handler.setFormatter(formatter)
            self._logger.addHandler(handler)
        self._bindings = options.bindings or {}
        self._sinks: List[TelemetrySink] = list(options.sinks or [])

    def child(self, bindings: Dict[str, object]) -> "Telemetry":
        child_bindings = {**self._bindings, **bindings}
        child_logger = self._logger.getChild(".".join(map(str, bindings.values())))
        return Telemetry(TelemetryOptions(logger=child_logger, sinks=self._sinks, bindings=child_bindings))

    def debug(self, name: str, payload: Optional[Dict[str, object]] = None) -> None:
        self._emit("debug", name, payload)

    def info(self, name: str, payload: Optional[Dict[str, object]] = None) -> None:
        self._emit("info", name, payload)

    def warn(self, name: str, payload: Optional[Dict[str, object]] = None) -> None:
        self._emit("warn", name, payload)

    def error(self, name: str, payload: Optional[Dict[str, object]] = None) -> None:
        self._emit("error", name, payload)

    def add_sink(self, sink: TelemetrySink) -> None:
        self._sinks.append(sink)

    def _emit(self, level: str, name: str, payload: Optional[Dict[str, object]]) -> None:
        timestamp = time.time() * 1000
        event = TelemetryEvent(name=name, level=level, timestamp=timestamp, payload=payload)
        log_method = getattr(self._logger, level.lower(), self._logger.info)
        log_method("%s | %s", name, payload)
        for sink in self._sinks:
            sink.handle(event)

