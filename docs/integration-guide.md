# Integration Guide / 통합 가이드

## English
### Agent Capability Design
1. Define agent intent (`readFs`, `writeFs`, `exec`, `netOutbound`, `netInbound`).
2. Register descriptor via `SecurityGuard.register({ agentId, capabilities, fsAllowList, execAllowList, allowNetworkOutbound, allowNetworkInbound })`.
3. Update `AgentRegistry` with metadata (`singleton`, `tags`, custom `resourceLimits`).

### Tool Adapters
```ts
import { IntegrationHost } from "@codex/agent-sdk";

const host = new IntegrationHost();

host.register({
  name: "github",
  capabilities: ["netOutbound"],
  async invoke(args: { repo: string; issue: number }) {
    // call external API here
    return { url: `https://github.com/${args.repo}/issues/${args.issue}` };
  },
});

const result = await host.invoke("github", { repo: "openai/codex", issue: 42 });
```

### Message Routing Patterns
- **Broadcast** — use `bus.publish("topic", payload)` for fan-out updates.
- **Direct** — use `bus.sendToAgent(agentId, payload)` for private coordination.
- **Session Mirroring** — attach `sessionId` to envelopes; hydrate via `SessionStore` for continuity.

### Workflow Composition Tips
- Keep nodes side-effect free and idempotent when possible.
- Use `retry` with exponential backoff in unstable integrations.
- Provide `rollback` handlers for compensating actions (e.g., revert Codex edits).

### Change Log Template
```
## [x.y.z] - YYYY-MM-DD
### Added
- 
### Changed
- 
### Fixed
- 
```

## 한국어
### 에이전트 권한 설계
1. 에이전트 목적에 맞는 capability (`readFs`, `writeFs`, `exec`, `netOutbound`, `netInbound`)를 정의합니다.
2. `SecurityGuard.register({ agentId, capabilities, fsAllowList, execAllowList, allowNetworkOutbound, allowNetworkInbound })`로 디스크립터를 등록합니다.
3. `AgentRegistry`에 `singleton`, `tags`, `resourceLimits` 등 메타데이터를 업데이트합니다.

### 툴 어댑터
```ts
import { IntegrationHost } from "@codex/agent-sdk";

const host = new IntegrationHost();

host.register({
  name: "github",
  capabilities: ["netOutbound"],
  async invoke(args: { repo: string; issue: number }) {
    // 외부 API 호출
    return { url: `https://github.com/${args.repo}/issues/${args.issue}` };
  },
});

const result = await host.invoke("github", { repo: "openai/codex", issue: 42 });
```

### 메시지 라우팅 패턴
- **브로드캐스트** — `bus.publish("topic", payload)`로 다수 에이전트에게 알림을 보냅니다.
- **직접 메시지** — `bus.sendToAgent(agentId, payload)`로 개별 에이전트와 조율합니다.
- **세션 미러링** — `sessionId`를 함께 전달하고 `SessionStore`로 컨텍스트를 복원하세요.

### 워크플로 구성 팁
- 노드는 가능한 한 부작용 없이, 멱등성 있게 유지하세요.
- 불안정한 연동에는 지수 백오프(`retry`) 정책을 활용하세요.
- `rollback` 핸들러를 제공하여 Codex 편집 등을 되돌릴 수 있게 합니다.

### 변경 로그 템플릿
```
## [x.y.z] - YYYY-MM-DD
### 추가됨
- 
### 변경됨
- 
### 수정됨
- 
```
