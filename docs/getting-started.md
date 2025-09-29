# Getting Started / 시작하기

## English
### Prerequisites
- **Node.js 20+** (matching the TypeScript SDK requirement)
- **npm 9+** or **pnpm** if you prefer a workspace manager
- **Python 3.10+** for the Python SDK
- **WSL2** (Ubuntu or Debian recommended) for a consistent dev shell
- Optional: `direnv` or `asdf` for environment pinning

### 1. Clone & Install
```bash
# Inside WSL
cd /mnt/d/Project/codex-agent-protocol
npm install
```

### 2. Install Codex CLI via npm
The SDK auto-resolves the CLI from `@openai/codex`.
```bash
npm install @openai/codex --save
```
If you need a fixed version across agents, set it in `package.json`.

### 3. Verify the Toolchain
```bash
npm run typecheck
npm test
```

### 4. First Workflow (TypeScript)
```bash
npm run build
node examples/basic-workflow.js
```
Provide environment overrides when necessary:
```bash
export CODEX_COMMAND_ARGS="exec --experimental-json"
```

### 5. Python SDK Setup
The Python implementation lives in `sdk/agent-python` and mirrors the TypeScript APIs.

```bash
cd sdk/agent-python
python -m venv .venv
source .venv/bin/activate
pip install -e .
pytest
```

### 6. Troubleshooting
- `MODULE_NOT_FOUND`: reinstall dependencies (`rm -rf node_modules package-lock.json && npm install`).
- Node engine mismatch: upgrade your WSL Node version (use `nvm install 20`).
- Missing Python modules: ensure the virtual environment is activated before running tests.

## 한국어
### 준비 사항
- **Node.js 20 이상** (TypeScript SDK 요구사항)
- **npm 9 이상** 또는 선호하는 패키지 매니저(pnpm 등)
- **Python 3.10 이상** (Python SDK용)
- 일관된 개발 환경을 위한 **WSL2** (Ubuntu 또는 Debian 권장)
- 선택 사항: 환경 관리를 위한 `direnv`, `asdf`

### 1. 클론 및 설치
```bash
# WSL 내부에서
cd /mnt/d/Project/codex-agent-protocol
npm install
```

### 2. npm 으로 Codex CLI 설치
SDK는 `@openai/codex` 패키지에서 CLI 경로를 자동으로 찾습니다.
```bash
npm install @openai/codex --save
```
여러 에이전트가 동일 버전을 사용해야 한다면 `package.json`에 버전을 고정하세요.

### 3. 도구체인 확인
```bash
npm run typecheck
npm test
```

### 4. 첫 워크플로 실행 (TypeScript)
```bash
npm run build
node examples/basic-workflow.js
```
환경별 옵션이 필요하면 다음과 같이 설정합니다.
```bash
export CODEX_COMMAND_ARGS="exec --experimental-json"
```

### 5. Python SDK 사용
`sdk/agent-python` 디렉터리에서 Python 구현을 사용할 수 있습니다.

```bash
cd sdk/agent-python
python -m venv .venv
source .venv/bin/activate
pip install -e .
pytest
```

### 6. 문제 해결
- `MODULE_NOT_FOUND`: `node_modules`와 `package-lock.json`을 삭제 후 재설치하세요.
- Node 엔진 경고: `nvm install 20`과 같이 WSL Node 버전을 업그레이드하세요.
- Python 의존성 누락: 가상 환경을 활성화했는지 확인하세요.
