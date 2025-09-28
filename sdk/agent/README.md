# Codex Agent SDK / 코덱스 에이전트 SDK

> Build resilient, policy-aware automation agents that speak to the Codex CLI. / 코덱스 CLI와 연동되는 탄탄한 자동화 에이전트를 구축하세요.

## Contents / 목차
- [Overview / 개요](#overview--개요)
- [Features / 주요 기능](#features--주요-기능)
- [Quick Start / 빠른 시작](#quick-start--빠른-시작)
- [Key Components / 핵심 컴포넌트](#key-components--핵심-컴포넌트)
- [Development Workflow / 개발 워크플로](#development-workflow--개발-워크플로)
- [Documents / 문서](#documents--문서)
- [License / 라이선스](#license--라이선스)

## Overview / 개요
**EN** — `@codex/agent-sdk` is a TypeScript toolkit that wraps the Codex CLI so you can register agents, orchestrate workflows, and enforce security policies from a single runtime.

**KO** — `@codex/agent-sdk`는 Codex CLI를 감싸는 TypeScript 툴킷으로, 하나의 런타임에서 에이전트 등록, 워크플로 오케스트레이션, 보안 정책을 손쉽게 제어할 수 있습니다.

## Features / 주요 기능
- **Lifecycle Management / 라이프사이클 관리** — EventEmitter 기반 레지스트리로 에이전트 등록·상태 추적.
- **Workflow Orchestration / 워크플로 제어** — DAG 실행, 동시성, 재시도, 롤백 지원.
- **Secure Messaging / 안전한 메시징** — 브로드캐스트/직접 메시지, 세션별 컨텍스트 유지.
- **Context & Memory / 컨텍스트 관리** — 네임스페이스 기반 스냅샷과 프롬프트 패킹.
- **Telemetry / 텔레메트리** — Pino 로거에 이벤트 훅을 제공해 운영 가시성 확보.
- **Security Guardrails / 보안 가드레일** — Capability·파일시스템·실행·네트워크 권한 검증.
- **Codex CLI Integration / Codex CLI 연동** — npm으로 설치한 `@openai/codex`를 자동 탐지하거나 레거시 경로로 폴백.

## Quick Start / 빠른 시작
```bash
# 1. Install dependencies / 의존성 설치
npm install

# 2. Build (optional during dev) / 빌드 (선택 사항)
npm run build

# 3. Run tests / 테스트 실행
npm test
```

```ts
import {
  AgentRegistry,
  CodexClient,
  MessageBus,
  SecurityGuard,
  WorkflowEngine,
  type WorkflowContext,
} from "@codex/agent-sdk";

const registry = new AgentRegistry();
const security = new SecurityGuard();
const bus = new MessageBus();
const workflows = new WorkflowEngine();

const codex = new CodexClient({
  cwd: process.cwd(),
  commandPath: process.env.CODEX_COMMAND_PATH,
  commandArgs: process.env.CODEX_COMMAND_ARGS?.split(/\s+/).filter(Boolean),
});

registry.register({
  id: "example:planner",
  name: "Planning Agent",
  capabilities: ["readFs", "exec"],
});

security.register({
  agentId: "example:planner",
  capabilities: ["readFs", "exec"],
  fsAllowList: [process.cwd()],
});

type Store = WorkflowContext["contextStore"];
const context: WorkflowContext = {
  contextStore: {
    set() {},
    get() {
      return undefined;
    },
    delete() {},
    snapshot(namespace) {
      return { id: namespace, createdAt: Date.now(), data: {} };
    },
  } satisfies Store,
};

await codex.start();

await workflows.run(
  [
    {
      id: "codex-status",
      async run() {
        const result = await codex.exec<{ status: string }>({ op: "status" });
        if (!result.ok) {
          throw new Error(result.error ?? "Unknown Codex error");
        }
        bus.publish("codex/events", result.data);
        return result.data;
      },
    },
  ],
  context,
  {
    onTaskComplete(id, payload) {
      console.info(`[workflow] ${id} complete`, payload);
    },
    onTaskError(id, error) {
      console.error(`[workflow] ${id} failed`, error);
    },
  }
);

await codex.exec({ op: "shutdown" }).catch(() => codex.stop());
```

> ℹ️ **Tip / 참고** — When `@openai/codex` is installed, the CLI path is auto-resolved. On Windows you can still override `commandPath` to target a native `codex.exe` binary.

## Key Components / 핵심 컴포넌트
| Module | Summary (EN) | 요약 (KO) |
| --- | --- | --- |
| `AgentRegistry` | Register, list, and monitor agent state with event hooks. | 이벤트 훅을 통해 에이전트를 등록·조회·상태 추적합니다. |
| `ProcessSupervisor` | Spawns Codex CLI, handles backoff restarts and failures. | Codex CLI 프로세스 생성, 재시도 백오프, 실패 전파를 담당합니다. |
| `CodexClient` | JSON line protocol client over Codex CLI stdio. | Codex CLI 표준 입출력을 통한 JSON 라인 프로토콜 클라이언트입니다. |
| `MessageBus` | Topic + direct routing with session awareness. | 토픽/직접 라우팅과 세션 정보를 함께 처리합니다. |
| `SessionStore` | TTL-aware context bag for conversations. | 세션별 TTL 컨텍스트 저장소입니다. |
| `WorkflowEngine` | DAG executor with retry, rollback, telemetry hooks. | 재시도·롤백·텔레메트리 훅을 갖춘 DAG 실행기입니다. |
| `ContextStore` | Namespaced KV storage with snapshot support. | 스냅샷을 지원하는 네임스페이스 KV 저장소입니다. |
| `PromptPacker` | Bundles context keys & attachments for LLM prompts. | LLM 프롬프트용 컨텍스트와 첨부를 패키징합니다. |
| `Telemetry` | Pino-backed logger fan-out to custom sinks. | Pino 기반 로깅 및 커스텀 싱크 전달을 지원합니다. |
| `SecurityGuard` | Capability + allowlist validation for fs/exec/net. | 파일/실행/네트워크 접근을 위해 권한·허용목록을 검증합니다. |
| `IntegrationHost` | Registers tool adapters and invokes by name. | 툴 어댑터를 등록하고 이름으로 호출합니다. |

## Development Workflow / 개발 워크플로
1. **Install** — `npm install`
2. **Typecheck** — `npm run typecheck`
3. **Test** — `npm test`
4. **Lint** — `npm run lint`
5. **Build** — `npm run build`

각 단계는 Vitest, TypeScript, ESLint, tsup을 이용하며 `docs/operations.md`에 상세 가이드가 있습니다.

## Documents / 문서
- [`docs/getting-started.md`](../docs/getting-started.md) — Environment setup & first workflow. / 환경 설정과 첫 워크플로 실행.
- [`docs/architecture.md`](../docs/architecture.md) — Module deep dive & data flows. / 모듈 심층 설명과 데이터 플로우.
- [`docs/operations.md`](../docs/operations.md) — Testing, troubleshooting, and observability. / 테스트·트러블슈팅·관측성.
- [`docs/integration-guide.md`](../docs/integration-guide.md) — Extending agents & external tools. / 에이전트 확장과 외부 연동.

## License / 라이선스
Apache License 2.0 — see [`LICENSE`](./LICENSE).

Apache License 2.0 — 자세한 내용은 [`LICENSE`](./LICENSE)를 참고하세요.
