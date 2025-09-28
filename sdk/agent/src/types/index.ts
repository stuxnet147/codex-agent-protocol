export type AgentId = string;

export type AgentStatus = "idle" | "running" | "error" | "stopped" | "offline";

export type Capability =
  | "readFs"
  | "writeFs"
  | "exec"
  | "netOutbound"
  | "netInbound";

export interface AgentDefinition {
  id: AgentId;
  name: string;
  capabilities: Capability[];
  metadata?: Record<string, unknown>;
  singleton?: boolean;
  maxInstances?: number;
  resourceLimits?: {
    cpu?: number;
    memory?: number;
    networkIn?: number;
    networkOut?: number;
  };
}

export interface AgentRuntimeState {
  status: AgentStatus;
  updatedAt: number;
  error?: string;
  resourceUsage?: {
    cpu?: number;
    memory?: number;
    networkIn?: number;
    networkOut?: number;
  };
}

export interface AgentRegistryEntry {
  definition: AgentDefinition;
  state: AgentRuntimeState;
}

export interface ProcessLaunchOptions {
  command: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  autoRestart?: boolean;
  maxRestarts?: number;
  backoffMs?: number;
}

export interface CodexCommand {
  op: string;
  args?: Record<string, unknown>;
  timeoutMs?: number;
}

export interface CodexResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface MessageEnvelope<T = unknown> {
  id: string;
  sessionId?: string;
  type: string;
  topic: string;
  payload: T;
  timestamp: number;
  headers?: Record<string, unknown>;
}

export interface SessionRecord {
  id: string;
  createdAt: number;
  expiresAt?: number;
  ttlMs?: number;
  context: Record<string, unknown>;
  agents: Set<AgentId>;
}

export interface WorkflowNodeDefinition {
  id: string;
  run: WorkflowTaskHandler;
  rollback?: WorkflowTaskHandler;
  dependsOn?: string[];
  retry?: {
    attempts: number;
    delayMs?: number;
  };
}

export interface WorkflowExecutionOptions {
  concurrency?: number;
  onTaskComplete?: (nodeId: string, result: unknown) => void;
  onTaskError?: (nodeId: string, error: unknown) => void;
}

export interface WorkflowRunSummary {
  completed: Set<string>;
  failed: Map<string, unknown>;
  startedAt: number;
  finishedAt?: number;
}

export type WorkflowTaskHandler = (context: WorkflowContext) => Promise<unknown> | unknown;

export interface WorkflowContext {
  sessionId?: string;
  metadata?: Record<string, unknown>;
  contextStore: ContextStore;
}

export interface ContextSnapshot {
  id: string;
  createdAt: number;
  data: Record<string, unknown>;
}

export interface PromptPackage {
  sessionId?: string;
  entries: Array<{ key: string; value: unknown }>;
  attachments?: Array<{ path: string; content: Buffer | string }>;
}

export interface TelemetryEvent {
  name: string;
  timestamp: number;
  level: "debug" | "info" | "warn" | "error";
  payload?: Record<string, unknown>;
}

export interface TelemetrySink {
  handle: (event: TelemetryEvent) => void;
}

export interface SecurityDescriptor {
  agentId: AgentId;
  capabilities: Capability[];
  fsAllowList?: string[];
  execAllowList?: string[];
  allowNetworkOutbound?: boolean;
  allowNetworkInbound?: boolean;
}

export interface IntegrationAdapter<TArgs = unknown, TResult = unknown> {
  name: string;
  capabilities: Capability[];
  invoke: (args: TArgs) => Promise<TResult> | TResult;
}

export interface IntegrationInvocation<TArgs, TResult> {
  adapter: IntegrationAdapter<TArgs, TResult>;
  args: TArgs;
}

export interface ContextStore {
  set(namespace: string, key: string, value: unknown): void;
  get<T = unknown>(namespace: string, key: string): T | undefined;
  delete(namespace: string, key: string): void;
  snapshot(namespace: string): ContextSnapshot;
}
