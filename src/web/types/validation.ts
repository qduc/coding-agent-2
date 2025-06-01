import { z } from 'zod';
import type { WebConfiguration, ToolConfig, ChatMessage, ToolCall } from './api';

/**
 * Validation Schemas for API Requests
 */

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string().min(1).max(10000),
  metadata: z.object({
    model: z.string().optional(),
    tokens: z.number().int().positive().optional(),
    tools: z.array(z.any()).optional(),
  }).optional(),
});

export const ToolCallSchema = z.object({
  name: z.string().min(1),
  arguments: z.record(z.any()),
});

export const SessionCreateSchema = z.object({
  projectPath: z.string().optional(),
  initialMessage: ChatMessageSchema.optional(),
});

export const WebConfigurationSchema = z.object({
  llm: z.object({
    provider: z.enum(['openai', 'anthropic', 'gemini']),
    model: z.string(),
    apiKey: z.string().optional(),
    baseUrl: z.string().url().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().optional(),
  }),
  tools: z.object({
    enabled: z.boolean(),
    list: z.array(z.any()), // More specific validation per tool
  }),
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug', 'trace']),
    persist: z.boolean(),
  }),
  features: z.object({
    streaming: z.boolean(),
    sessions: z.boolean(),
    fileAccess: z.boolean(),
  }),
});

export const ToolConfigSchema = z.object({
  name: z.string(),
  enabled: z.boolean(),
  permissions: z.object({
    fileSystem: z.boolean(),
    network: z.boolean(),
    shell: z.boolean(),
  }),
});

export const ProjectMetadataSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  description: z.string().optional(),
  mainFile: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
});

/**
 * Common Validation Types
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: z.ZodIssue[] };

/**
 * Validation Helper Functions
 */

export const configSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  apiKey: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  features: z.object({
    streaming: z.boolean().default(true),
    sessions: z.boolean().default(true),
    fileAccess: z.boolean().default(true),
    toolExecution: z.boolean().default(true)
  }).optional()
});

export const providerConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'local']),
  model: z.string().min(1),
  apiKey: z.string().min(1),
  endpoint: z.string().url().optional()
});

export function validateConfig(data: unknown): ValidationResult<any> {
  const result = configSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}

export function validateProviderConfig(data: unknown): ValidationResult<any> {
  const result = providerConfigSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}
