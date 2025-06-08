/**
 * Type definitions for the sub-agent system
 */

import { AgentOptions } from '../core/agent';
import { ToolContext } from '../tools/types';

/**
 * Sub-agent specializations for different task types
 */
export type SubAgentSpecialization = 
  | 'code'       // Code generation, refactoring, simple edits
  | 'test'       // Test generation, runner execution, coverage
  | 'debug'      // Error analysis, stack traces, root cause analysis
  | 'docs'       // Documentation generation, comments, README
  | 'search'     // Code discovery, pattern matching, dependency analysis
  | 'validation' // Linting, type checking, build validation
  | 'general';   // General purpose with full tool access

/**
 * Model configuration for sub-agents
 */
export interface SubAgentModelConfig {
  /** Provider to use (anthropic, gemini, openai) */
  provider: string;
  /** Model name/variant */
  model: string;
  /** Model performance profile */
  profile: 'fast' | 'balanced' | 'reasoning';
  /** Temperature for creativity vs consistency */
  temperature?: number;
  /** Maximum tokens for responses */
  maxTokens?: number;
}

/**
 * Communication message between parent and sub-agents
 */
export interface SubAgentMessage {
  /** Unique message ID */
  id: string;
  /** Message type */
  type: 'task_delegation' | 'progress_update' | 'result' | 'error' | 'status';
  /** Source agent ID */
  from: string;
  /** Target agent ID */
  to: string;
  /** Message payload */
  payload: any;
  /** Timestamp */
  timestamp: number;
}

/**
 * Task delegation request from parent to sub-agent
 */
export interface TaskDelegation {
  /** Unique task ID */
  taskId: string;
  /** Task description */
  description: string;
  /** User input/instructions */
  userInput: string;
  /** Required tools for the task */
  requiredTools?: string[];
  /** Task priority */
  priority: 'low' | 'medium' | 'high';
  /** Maximum execution time */
  timeout?: number;
  /** Additional context */
  context?: Record<string, any>;
}

/**
 * Task result from sub-agent to parent
 */
export interface TaskResult {
  /** Task ID this result corresponds to */
  taskId: string;
  /** Execution success status */
  success: boolean;
  /** Result content */
  result?: string;
  /** Error information if failed */
  error?: {
    message: string;
    code: string;
    details?: any;
  };
  /** Tool execution metadata */
  metadata?: {
    toolsUsed: string[];
    executionTime: number;
    tokensUsed?: number;
  };
}

/**
 * Sub-agent status information
 */
export interface SubAgentStatus {
  /** Agent ID */
  id: string;
  /** Current state */
  state: 'idle' | 'busy' | 'error' | 'stopped';
  /** Specialization */
  specialization: SubAgentSpecialization;
  /** Current task ID if busy */
  currentTaskId?: string;
  /** Last activity timestamp */
  lastActivity: number;
  /** Resource usage */
  resources?: {
    memoryUsage: number;
    cpuUsage: number;
  };
}

/**
 * Specialization configuration defining tools and behavior
 */
export interface SpecializationConfig {
  /** Allowed tools for this specialization */
  allowedTools: string[];
  /** Model configuration */
  modelConfig: SubAgentModelConfig;
  /** System prompt additions */
  systemPromptAddition?: string;
  /** Maximum concurrent tasks */
  maxConcurrentTasks?: number;
}

/**
 * Extended agent options for sub-agents
 */
export interface SubAgentOptions extends Omit<AgentOptions, 'inputHandler'> {
  /** Parent agent reference */
  parentAgent?: any; // Will be Agent type but avoiding circular imports
  /** Sub-agent specialization */
  specialization: SubAgentSpecialization;
  /** Unique agent ID */
  agentId?: string;
  /** Allowed tools (if different from specialization default) */
  allowedTools?: string[];
  /** Model configuration override */
  modelConfig?: SubAgentModelConfig;
  /** Communication channel for parent-child messaging */
  communicationChannel?: ISubAgentCommunication;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Communication interface for parent-child messaging
 */
export interface ISubAgentCommunication {
  /** Send message to parent agent */
  sendToParent(message: SubAgentMessage): Promise<void>;
  
  /** Receive message from parent agent */
  receiveFromParent(): Promise<SubAgentMessage | null>;
  
  /** Send message to specific sub-agent */
  sendToSubAgent(agentId: string, message: SubAgentMessage): Promise<void>;
  
  /** Subscribe to messages from sub-agents */
  subscribeToSubAgent(agentId: string, callback: (message: SubAgentMessage) => void): void;
  
  /** Unsubscribe from sub-agent messages */
  unsubscribeFromSubAgent(agentId: string): void;
  
  /** Check if communication channel is active */
  isActive(): boolean;
  
  /** Close communication channel */
  close(): Promise<void>;
}

/**
 * Sub-agent factory configuration
 */
export interface SubAgentFactoryConfig {
  /** Default model configurations by specialization */
  defaultModelConfigs: Record<SubAgentSpecialization, SubAgentModelConfig>;
  
  /** Default tool configurations by specialization */
  specializationConfigs: Record<SubAgentSpecialization, SpecializationConfig>;
  
  /** Global sub-agent settings */
  globalSettings: {
    maxSubAgents: number;
    defaultTimeout: number;
    enableTelemetry: boolean;
  };
}

/**
 * Default model configurations for different specializations
 */
export const DEFAULT_MODEL_CONFIGS: Record<SubAgentSpecialization, SubAgentModelConfig> = {
  code: {
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    profile: 'fast',
    temperature: 0.1,
    maxTokens: 4096
  },
  test: {
    provider: 'anthropic', 
    model: 'claude-3-haiku-20240307',
    profile: 'fast',
    temperature: 0.1,
    maxTokens: 4096
  },
  debug: {
    provider: 'anthropic',
    model: 'claude-3-sonnet-20240229',
    profile: 'reasoning',
    temperature: 0.0,
    maxTokens: 8192
  },
  docs: {
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307', 
    profile: 'fast',
    temperature: 0.3,
    maxTokens: 4096
  },
  search: {
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    profile: 'fast',
    temperature: 0.0,
    maxTokens: 2048
  },
  validation: {
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    profile: 'fast',
    temperature: 0.0,
    maxTokens: 2048
  },
  general: {
    provider: 'anthropic',
    model: 'claude-3-sonnet-20240229',
    profile: 'balanced',
    temperature: 0.2,
    maxTokens: 8192
  }
};