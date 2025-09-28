# Operations & Maintenance / 운영 및 유지보수

## English
### Testing Matrix
| Command | Purpose | Notes |
| --- | --- | --- |
| `npm test` | Run Vitest suites (Node environment) | Uses ESM loader; ensure Node 20+ |
| `npm run typecheck` | Strict TypeScript validation | Mirrors CI gate |
| `npm run lint` | ESLint over `src/**/*.ts` | Aligns with Prettier config |
| `npm run build` | Bundle via tsup | Outputs ESM with d.ts |

### Logging & Telemetry
- Use `Telemetry.child({ agentId, sessionId })` to scope logs.
- Custom sinks implement `TelemetrySink#handle(event)`.
- Integrate with OpenTelemetry exporters by adapting a sink.

### Upgrading Codex CLI
1. Update `@openai/codex` version in `package.json`.
2. Run `npm install` to refresh `package-lock.json`.
3. Verify CLI resolution via `node -e "console.log(require.resolve('@openai/codex/bin/codex.js'))"`.
4. Execute regression tests (`npm test`).

### Troubleshooting Checklist
- **Process stalls** — call `codex.stop()`; supervisor auto-restarts on next `exec`.
- **Timeouts** — adjust `CodexClientOptions.responseTimeoutMs` or per-command `timeoutMs`.
- **Permission errors** — ensure `SecurityGuard` descriptors include required capabilities and allowlists.
- **Workflow deadlock** — inspect dependencies to avoid cyclic DAG definitions.

### Release Checklist
- Bump version in `package.json`.
- Update changelog (see `docs/integration-guide.md` for template references).
- Run full test + lint + build suite.
- Tag release and publish to internal registry if applicable.

## 한국어
### 테스트 매트릭스
| 명령어 | 목적 | 비고 |
| --- | --- | --- |
| `npm test` | Vitest 스위트를 실행합니다. | ESM 로더 사용, Node 20 이상 필요 |
| `npm run typecheck` | 엄격한 TypeScript 검증 | CI 게이트와 동일 |
| `npm run lint` | `src/**/*.ts` 경로 ESLint 검사 | Prettier 설정과 일치 |
| `npm run build` | tsup 번들링 | ESM + d.ts 생성 |

### 로깅 & 텔레메트리
- `Telemetry.child({ agentId, sessionId })`로 로그 범위를 지정하세요.
- 커스텀 싱크는 `TelemetrySink#handle(event)`를 구현합니다.
- OpenTelemetry와 연동하려면 싱크에서 exporter를 호출하면 됩니다.

### Codex CLI 업그레이드
1. `package.json`에서 `@openai/codex` 버전을 업데이트합니다.
2. `npm install`로 `package-lock.json`을 갱신합니다.
3. `node -e "console.log(require.resolve('@openai/codex/bin/codex.js'))"`로 CLI 경로를 확인합니다.
4. 회귀 테스트(`npm test`)를 실행합니다.

### 트러블슈팅 체크리스트
- **프로세스 멈춤** — `codex.stop()` 호출; 다음 `exec`에서 자동 재시작됩니다.
- **타임아웃** — `CodexClientOptions.responseTimeoutMs` 또는 커맨드별 `timeoutMs`를 조정하세요.
- **권한 오류** — `SecurityGuard`에 필요한 capability 및 허용 목록이 있는지 확인하세요.
- **워크플로 데드락** — 순환 의존성이 없는지 DAG 정의를 점검하세요.

### 릴리스 체크리스트
- `package.json` 버전을 증가시킵니다.
- 변경 로그는 `docs/integration-guide.md`의 템플릿을 참고해 작성합니다.
- 테스트 + 린트 + 빌드를 모두 통과시킵니다.
- 필요한 경우 태그를 생성하고 내부 레지스트리에 배포합니다.
