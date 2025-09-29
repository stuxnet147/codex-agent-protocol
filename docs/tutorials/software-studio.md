# Software Studio Tutorial / 소프트웨어 스튜디오 튜토리얼

## 목표 / Goals
- 고객 의뢰를 바탕으로 플래너, PM, 아키텍트, 구현자, QA 등 역할 에이전트를 병렬로 작동시키는 방법을 익힙니다.
- Codex Agent SDK의 `AgentRegistry`, `SecurityGuard`, `MessageBus`, `WorkflowEngine`, `ContextStore`, `IntegrationHost`를 실전 워크플로에 적용합니다.
- 12개의 단계별 예제를 통해 요구 수집부터 출시 브리핑, 피드백 반영까지 전 과정을 자동화합니다.

## 준비 사항 / Prerequisites
1. 저장소 루트에서 의존성 설치
   ```bash
   npm install
   ```
2. SDK를 빌드하거나 타입 검증 (선택)
   ```bash
   npm run build
   # or
   npm run typecheck
   ```
3. 예제 실행 시 `tsx`를 사용합니다. 각 스크립트는 Codex CLI가 없어도 동작하며, 직접/브로드캐스트 메시지와 워크플로 상태를 콘솔로 출력합니다.

## 예제 사용법 / How to Run
each command below 실행 전 현재 디렉터리가 저장소 루트인지 확인하세요.
```bash
npx tsx sdk/agent/examples/software-studio/01-requirement-intake.ts
```
숫자를 바꿔가며 12개 전체를 순차 실행할 수 있습니다.

## 단계별 예제 / Step-by-step Examples
### 1. Requirement Intake — `01-requirement-intake.ts`
- 고객 브리프를 PM이 Intake 보드에 등록하고 Planner·Designer가 브리프와 스토리보드를 작성합니다.
- `ContextStore`에 클라이언트 요구/브리프가 저장되고 `MessageBus`를 통해 타임라인이 방송됩니다.
- 명령어: `npx tsx sdk/agent/examples/software-studio/01-requirement-intake.ts`

### 2. Persona Mapping — `02-persona-mapping.ts`
- Analyst가 시장 신호를 수집하고 Planner가 페르소나를 설계, PM이 성공 기준을 정의합니다.
- 멀티 에이전트 의사결정을 컨텍스트 스토어에 캡쳐합니다.

### 3. Architecture Sketch — `03-architecture-sketch.ts`
- Planner가 범위를 정리하면 Architect와 DevOps가 병렬로 청사진과 운영 준비도를 산출합니다.
- Engineer가 반복 작업 의존성을 해결하며 `concurrency` 옵션 사용 예시를 보여줍니다.

### 4. Product Plan — `04-product-plan.ts`
- Planner가 에픽을 구성하고 Engineer가 스토리로 분해, PM이 분기별 로드맵을 완성합니다.
- `ContextStore.snapshot()`으로 전달물 스냅샷을 생성합니다.

### 5. Backlog Grooming — `05-backlog-grooming.ts`
- PM 우선순위 → Planner의 수용 기준 → QA의 재시도(Retry) 검증 흐름을 구현합니다.
- `retry` 구성을 통해 QA가 첫 시도에서 실패 후 재시도하는 패턴을 확인할 수 있습니다.

### 6. Sprint Scheduler — `06-sprint-scheduler.ts`
- Engineer 용량과 QA 슬롯을 동시에 수집한 뒤 PM이 스프린트 일정을 배정합니다.
- 커스텀 토픽(`sprint.assignments`) 브로드캐스트로 일정 결과를 공유합니다.

### 7. Implementation Sync — `07-implementation-sync.ts`
- Architect 안내 → Engineer 구현 단계 → DevOps 파이프라인 업데이트로 이어지는 체계를 다룹니다.
- 저장된 계약, 기초 구현, 경보 모듈, CI 상태를 최종 요약합니다.

### 8. Code Review Loop — `08-code-review-loop.ts`
- `IntegrationHost`를 활용해 Lint 자동화를 끼워 넣고 Architect·QA 리뷰를 직렬화합니다.
- 자동화 리포트는 `automation.reports` 토픽으로 방송됩니다.

### 9. QA Validation — `09-qa-validation.ts`
- QA 스모크 테스트, Engineer 핫픽스, DevOps 환경 준비 후 QA 총평을 생성합니다.
- `retry`와 병렬 실행을 조합해 안정화 시나리오를 재현합니다.

### 10. Release Brief — `10-release-brief.ts`
- PM 릴리즈 노트, DevOps 코드 프리즈, Planner GTM 메시지를 통합한 뒤 브로드캐스트합니다.
- `release.broadcast` 토픽을 구독하여 출시 패키지를 확인합니다.

### 11. Feedback Integration — `11-feedback-integration.ts`
- Planner가 고객 피드백을 수집하고 Engineer가 영향도를 산정, PM이 백로그를 재배치합니다.
- 피드백 이벤트 스트림(`feedback.events`)과 재정렬 결과를 비교할 수 있습니다.

### 12. End-to-End Delivery — `12-end-to-end-delivery.ts`
- 요구 수집부터 로드맵, 설계, 구현, QA, 릴리즈 브리핑까지 전체 파이프라인을 하나의 워크플로로 묶습니다.
- `concurrency: 3` 구성으로 설계·운영 준비가 동시에 진행되고, 최종 `release.broadcast`에 통합 산출물이 담깁니다.

### 13. Codex Live Planner — `13-codex-live-planner.ts`
- `CodexProtocolAdapter`를 이용해 실제 Codex CLI(`proto` 모드)와 대화하며 플래너 브리프를 JSON으로 받아옵니다.
- `@openai/codex`가 설치되어 있어야 하며, 실행 시 Codex가 출력하는 스트리밍 델타와 최종 결과를 콘솔에서 확인할 수 있습니다.
- 명령어: `npx tsx sdk/agent/examples/software-studio/13-codex-live-planner.ts`
- 필요시 환경변수 `CODEX_MODEL`로 사용할 모델을 오버라이드할 수 있습니다.
- Codex 종료 시 stderr에 `internal error; agent loop died unexpectedly` 로그가 남을 수 있으나 정상적인 셧다운입니다.

## 확장 아이디어 / Next Ideas
- Codex CLI 연동: `shared.ts`의 `simulateAgentAction` 대신 `CodexClient.exec` 호출을 넣어 실제 CLI 응답을 활용하세요.
- 툴 어댑터 확장: `IntegrationHost`에 이슈 트래커, 데이터 카탈로그, 번역 시스템 등을 추가할 수 있습니다.
- 장기 세션 관리: `SessionStore`를 구현해 다중 세션 간 컨텍스트와 히스토리를 분리 저장할 수 있습니다.
- 테스트 자동화: Vitest로 각 예제의 컨텍스트 결과를 검증하는 테스트를 추가해 회귀를 방지하세요.

## 관련 문서 / References
- `sdk/agent/README.md` — SDK 개요와 핵심 모듈 설명
- `docs/architecture.md` — 모듈 간 데이터 플로우와 이벤트 구조
- `docs/integration-guide.md` — Capability 설계와 통합 어댑터 모범 사례
