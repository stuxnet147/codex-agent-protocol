import {
  AgentRegistry,
  SecurityGuard,
  MessageBus,
  WorkflowEngine,
  InMemoryContextStore,
  type Capability,
  type WorkflowContext,
} from "../../src/index.js";

export interface SoftwareAgent {
  id: string;
  name: string;
  capabilities: Capability[];
  description?: string;
  tags?: string[];
}

export interface SoftwareCompanyEnvironment {
  registry: AgentRegistry;
  security: SecurityGuard;
  bus: MessageBus;
  workflows: WorkflowEngine;
  contextStore: InMemoryContextStore;
  registerAgents: (agents?: SoftwareAgent[]) => void;
  createContext: (sessionId?: string) => WorkflowContext;
  monitorTopic: (topic: string, label?: string) => () => void;
  monitorDirect: (agentId: string, label?: string) => () => void;
}

const DEFAULT_AGENTS: SoftwareAgent[] = [
  {
    id: "agent:planner",
    name: "Product Planner",
    capabilities: ["readFs"],
    description: "Synthesises user intent into a product brief.",
    tags: ["discovery"],
  },
  {
    id: "agent:pm",
    name: "Project Manager",
    capabilities: ["readFs"],
    description: "Coordinates timelines and task ownership.",
    tags: ["delivery"],
  },
  {
    id: "agent:architect",
    name: "Systems Architect",
    capabilities: ["readFs", "exec"],
    description: "Sketches systems design and constraints.",
    tags: ["design"],
  },
  {
    id: "agent:engineer",
    name: "Implementation Engineer",
    capabilities: ["readFs", "exec"],
    description: "Builds product increments and automation.",
    tags: ["build"],
  },
  {
    id: "agent:qa",
    name: "QA Analyst",
    capabilities: ["readFs"],
    description: "Validates acceptance criteria and regression risk.",
    tags: ["quality"],
  },
  {
    id: "agent:devops",
    name: "Release Engineer",
    capabilities: ["exec"],
    description: "Prepares environments and release checklists.",
    tags: ["operations"],
  },
  {
    id: "agent:designer",
    name: "UX Designer",
    capabilities: ["readFs"],
    description: "Produces UX narratives and wireframes.",
    tags: ["design"],
  },
  {
    id: "agent:analyst",
    name: "Market Analyst",
    capabilities: ["readFs", "netOutbound"],
    description: "Surfaces market signals and competitor intel.",
    tags: ["research"],
  },
];

export function createSoftwareCompanyEnvironment(): SoftwareCompanyEnvironment {
  const registry = new AgentRegistry();
  const security = new SecurityGuard();
  const bus = new MessageBus();
  const workflows = new WorkflowEngine();
  const contextStore = new InMemoryContextStore();

  const registerAgents = (agents: SoftwareAgent[] = DEFAULT_AGENTS) => {
    agents.forEach((agent) => {
      registry.register({
        id: agent.id,
        name: agent.name,
        capabilities: agent.capabilities,
        metadata: {
          description: agent.description,
          tags: agent.tags,
        },
      });
      security.register({
        agentId: agent.id,
        capabilities: agent.capabilities,
        fsAllowList: [process.cwd()],
        execAllowList: agent.capabilities.includes("exec") ? [] : undefined,
        allowNetworkOutbound: agent.capabilities.includes("netOutbound") ? true : undefined,
        allowNetworkInbound: agent.capabilities.includes("netInbound") ? true : undefined,
      });
      registry.setStatus(agent.id, "idle");
    });
  };

  const monitorTopic = (topic: string, label = topic) => {
    const subscription = bus.subscribe(topic, (message) => {
      console.log(`[topic:${label}]`, JSON.stringify(message.payload));
    });
    return () => bus.unsubscribe(subscription);
  };

  const monitorDirect = (agentId: string, label = agentId) => {
    const subscription = bus.subscribeAgent(agentId, (message) => {
      console.log(`[direct:${label}]`, JSON.stringify(message.payload));
    });
    return () => bus.unsubscribe(subscription);
  };

  const createContext = (sessionId?: string): WorkflowContext => ({
    sessionId,
    metadata: {
      sessionCreatedAt: Date.now(),
      company: "codex-software-studio",
    },
    contextStore,
  });

  return {
    registry,
    security,
    bus,
    workflows,
    contextStore,
    registerAgents,
    createContext,
    monitorTopic,
    monitorDirect,
  };
}

export interface SimulationOptions<T = unknown> {
  env: SoftwareCompanyEnvironment;
  agentId: string;
  detail: string;
  result?: T;
  delayMs?: number;
  topic?: string;
  sessionId?: string;
}

export async function simulateAgentAction<T = unknown>(
  options: SimulationOptions<T>
): Promise<T | { agentId: string; detail: string }> {
  const {
    env,
    agentId,
    detail,
    delayMs = 120,
    result,
    topic = "studio.timeline",
    sessionId,
  } = options;

  env.registry.setStatus(agentId, "running");
  env.bus.publish(topic, { agentId, detail }, sessionId);
  await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
  env.registry.setStatus(agentId, "idle");
  env.bus.sendToAgent(agentId, { acknowledgement: detail, sessionId });
  return result ?? { agentId, detail };
}
