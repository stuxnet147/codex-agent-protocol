# Examples

This directory contains runnable walk-throughs that compose the SDK building blocks into end-to-end flows. Use [`tsx`](https://github.com/esbuild-kit/tsx) or `node --loader=ts-node/esm` to execute the TypeScript files directly during development.

## Basic Workflow Orchestration

`basic-workflow.ts` shows how to:

- register an agent and security descriptor,
- trigger the Codex CLI through `CodexClient`,
- publish results on the in-memory `MessageBus`, and
- coordinate the steps with `WorkflowEngine`.

Run it after installing dependencies:

```
npm install
npm run build
npx tsx examples/basic-workflow.ts
```

The script auto-detects when the Codex CLI binary is unavailable, logs a warning, and exits without throwing. Use `CODEX_CLI_PATH` to point at a custom CLI build if your environment differs from the default `ref/codex-src/codex-cli/bin/codex.js`.
