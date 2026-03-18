import { z } from 'zod';

import type { AgentMessage } from '../core/types.js';

export const AGENT_IDS = ['research-analyst', 'strategist', 'risk-manager', 'trader'] as const;
export const AgentIdSchema = z.enum(AGENT_IDS);
export type AgentId = z.infer<typeof AgentIdSchema>;

export const AgentProfileSchema = z.object({
  id: AgentIdSchema,
  name: z.string(),
  description: z.string(),
  systemPrompt: z.string(),
  tools: z.array(z.string()),
  allowedActions: z.array(z.string()),
  provider: z.string().optional(),
  model: z.string().optional(),
});
export type AgentProfile = z.infer<typeof AgentProfileSchema>;

export interface AgentStepResult {
  agentId: AgentId;
  text: string;
  messages: AgentMessage[];
  iterations: number;
  usage: { inputTokens: number; outputTokens: number };
  compactions: number;
}

export interface WorkflowStep {
  agentId: AgentId;
  buildMessage: (previousOutputs: Map<AgentId, AgentStepResult>, triggerMessage?: string) => string;
}

export type WorkflowStage = WorkflowStep | WorkflowStep[];

export interface Workflow {
  id: string;
  name: string;
  stages: WorkflowStage[];
}

// Legacy types (kept for backward compat until Gateway migration)
export interface AgentContext {
  providerId: string;
  model: string;
  channelId: string;
  threadId?: string;
  userId: string;
}

export interface Agent {
  id: string;
  name: string;
  systemPrompt?: string;
  process(context: AgentContext, history: AgentMessage[], userMessage: string): Promise<string>;
}
