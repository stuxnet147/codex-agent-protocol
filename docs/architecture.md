# Architecture / 아키텍처

## English
### High-Level Diagram
```
┌────────────┐     publish     ┌──────────────┐
│ Workflow   │ ──────────────▶ │ Message Bus  │
│ Engine     │ ◀────────────── │ (topics,     │
└─────▲──────┘     subscribe   │  direct)     │
      │                       └─────┬────────┘
      │ complete/error               │ envelopes
      │                               ▼
┌─────┴────────┐   exec()   ┌──────────────┐   stdio JSON   ┌───────────┐
│ Agent Logic  │ ─────────▶ │ CodexClient  │ ─────────────▶ │ Codex CLI │
│ (user code)  │            │ + Supervisor │ ◀───────────── │ (bin)     │
└──────────────┘            └──────────────┘    responses    └───────────┘
```

### Core Responsibilities
- **AgentRegistry** — Stores `AgentDefinition` + `AgentRuntimeState`, emits lifecycle events.
- **ProcessSupervisor** — Owns the Codex child process, restarts with backoff, surfaces `started`, `exited`, `failed`, `restarted` events.
- **CodexClient** — JSON-lines protocol adapter. Resolves CLI path via npm, tracks inflight requests, auto-starts the supervisor.
- **MessageBus / SessionStore** — In-memory pub/sub with optional session-awareness for conversation context.
- **WorkflowEngine** — Executes DAGs with concurrency control, retry policies, rollback hooks.
- **ContextStore / PromptPacker** — Namespaced KV with snapshot diffing, packs payloads for LLM prompts.
- **Telemetry** — Fan-out of Pino logs and custom sinks for metrics/alerts.
- **SecurityGuard** — Enforces capability model and allowlists (fs, exec, network).
- **IntegrationHost** — Registers pluggable adapters for external systems.

### Data Contracts
- **MessageEnvelope** — `{ id, type, topic, payload, sessionId?, timestamp }`
- **WorkflowNodeDefinition** — Contains `run`, optional `dependsOn`, `retry`, `rollback`.
- **CodexCommand** — `{ op: string, args?, timeoutMs? }`; responses include `{ ok, data?, error? }`.

### Error Surfaces
- Codex process exit ⇒ `ProcessSupervisor` emits `exited`; inflight requests receive propagated failures.
- JSON parse failure ⇒ `CodexClient` emits `protocolError` and rejects pending promises.
- Workflow node failure ⇒ `WorkflowEngine` optionally retries; on terminal failure rolls back completed nodes.

### Extensibility Hooks
- `AgentRegistry.on(event, handler)` for lifecycle automation.
- `WorkflowEngine.on("taskComplete" | "taskFailed" | "finished")` for metrics.
- `Telemetry.addSink` to push logs to external collectors.
- `IntegrationHost.register({ name, invoke })` to expose custom tools.

## 한국어
### 상위 다이어그램
```
┌────────────┐     publish     ┌──────────────┐
│ Workflow   │ ──────────────▶ │ Message Bus  │
│ Engine     │ ◀────────────── │ (topics,     │
└─────▲──────┘     subscribe   │  direct)     │
      │                       └─────┬────────┘
      │ complete/error               │ envelopes
      │                               ▼
┌─────┴────────┐   exec()   ┌──────────────┐   stdio JSON   ┌───────────┐
│ Agent Logic  │ ─────────▶ │ CodexClient  │ ─────────────▶ │ Codex CLI │
│ (user code)  │            │ + Supervisor │ ◀───────────── │ (bin)     │
└──────────────┘            └──────────────┘    responses    └───────────┘
```

### 핵심 역할
- **AgentRegistry** — `AgentDefinition`, `AgentRuntimeState`를 저장하고 라이프사이클 이벤트를 발생시킵니다.
- **ProcessSupervisor** — Codex 자식 프로세스를 관리하며 백오프 재시작과 `started/exited/failed/restarted` 이벤트를 제공합니다.
- **CodexClient** — JSON 라인 프로토콜 어댑터로 npm에서 CLI 경로를 찾고, 진행 중 요청을 추적하며 필요 시 supervise를 자동 시작합니다.
- **MessageBus / SessionStore** — 대화형 세션 정보를 유지하는 인메모리 pub/sub입니다.
- **WorkflowEngine** — 동시성 제어, 재시도, 롤백을 지원하는 DAG 실행기입니다.
- **ContextStore / PromptPacker** — 네임스페이스 기반 KV 저장소와 LLM 프롬프트 패킹 도구입니다.
- **Telemetry** — Pino 로그를 외부 싱크로 전달하여 모니터링 가시성을 확보합니다.
- **SecurityGuard** — 파일/실행/네트워크 허용 목록과 권한 모델을 검증합니다.
- **IntegrationHost** — 외부 시스템 연동을 위한 플러그형 어댑터를 등록합니다.

### 데이터 계약
- **MessageEnvelope** — `{ id, type, topic, payload, sessionId?, timestamp }`
- **WorkflowNodeDefinition** — `run`, 선택적 `dependsOn`, `retry`, `rollback`을 포함합니다.
- **CodexCommand** — `{ op: string, args?, timeoutMs? }`; 응답은 `{ ok, data?, error? }` 구조입니다.

### 오류 발생 지점
- Codex 프로세스 종료 ⇒ `ProcessSupervisor`가 `exited` 이벤트를 발생시키고 진행 중 요청은 실패로 전파됩니다.
- JSON 파싱 실패 ⇒ `CodexClient`가 `protocolError` 이벤트를 발생시키고 대기 중 프라미스를 거부합니다.
- 워크플로 노드 실패 ⇒ `WorkflowEngine`이 재시도를 수행하고, 최종 실패 시 완료된 노드를 롤백합니다.

### 확장 포인트
- `AgentRegistry.on(event, handler)` — 라이프사이클 자동화.
- `WorkflowEngine.on("taskComplete" | "taskFailed" | "finished")` — 메트릭 연동.
- `Telemetry.addSink` — 외부 로그 수집기로 전달.
- `IntegrationHost.register({ name, invoke })` — 커스텀 툴 제공.
