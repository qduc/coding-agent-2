import type { ToolErrorCode, ToolSchema } from '../../shared/tools/types';
import type { ProjectDiscoveryResult } from '../../shared/utils/projectDiscovery';
import type { LogLevel } from '../../shared/utils/logger';

/**
 * Core API Response Types
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError | string;
  timestamp: Date;
  metadata?: {
    page?: number;
    pageSize?: number;
    total?: number;
  };
}

export interface ErrorResponse extends ApiResponse<never> {
  success: false;
  error: ApiError | string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  stack?: string;
  validationErrors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  metadata: {
    page: number;
    pageSize: number;
    total: number;
    hasNext: boolean;
  };
}

export interface StreamingResponse<T = any> {
  event: 'data' | 'error' | 'complete';
  data?: T;
  error?: ApiError;
}

/**
 * Message Types
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  metadata?: {
    model?: string;
    tokens?: number;
    tools?: ToolCall[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: any;
  timestamp: Date;
}

export interface ToolExecutionResult {
  id: string;
  toolCallId: string;
  name: string;
  output: any;
  success: boolean;
  error?: {
    code: ToolErrorCode;
    message: string;
    details?: any;
  };
  timestamp: Date;
  durationMs: number;
}

/**
 * Session Management
 */
export interface WebSessionState {
  id: string;
  createdAt: Date;
  lastActive: Date;
  messages: ChatMessage[];
  projectContext?: ProjectContext;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    location?: string;
  };
}

export interface SessionInfo {
  id: string;
  createdAt: Date;
  lastActive: Date;
  messageCount: number;
  title?: string;
  projectPath?: string;
}

// Re-export the ChatSession type from websocket.ts
export type { ChatSession } from './websocket';

export type ConversationHistory = ChatMessage[];

/**
 * Configuration Types
 */
export interface WebConfiguration {
  llm: {
    provider: 'openai' | 'anthropic' | 'gemini';
    model: string;
    apiKey?: string;
    baseUrl?: string;
    temperature?: number;
    maxTokens?: number;
  };
  tools: {
    enabled: boolean;
    list: ToolConfig[];
    maxFileSize: number;
    timeout: number;
    logUsage: boolean;
  };
  logging: {
    level: LogLevel;
    persist: boolean;
    maxLogSize: number;
    maxLogFiles: number;
  };
  features: {
    streaming: boolean;
    sessions: boolean;
    fileAccess: boolean;
    codeAnalysis: boolean;
    autoSave: boolean;
  };
  ui?: {
    theme?: 'light' | 'dark' | 'system';
    fontSize?: number;
    lineHeight?: number;
  };
}

export interface ToolConfig {
  name: string;
  enabled: boolean;
  permissions: {
    fileSystem: boolean;
    network: boolean;
    shell: boolean;
  };
  schema: ToolSchema;
}

export interface ConfigValidationResult {
  isValid: boolean;
  errors?: ValidationError[];
}

export interface ConfigProviderSettings {
  provider: string;
  model: string;
  apiKey?: string;
  endpoint?: string;
}

export interface ConfigToolSettings {
  enabled: boolean;
  whitelist?: string[];
  blacklist?: string[];
}

export interface ConfigFeatureFlags {
  streaming: boolean;
  sessions: boolean;
  fileAccess: boolean;
  toolExecution: boolean;
}

/**
 * Project Types
 */
export interface ProjectContext {
  discovery: ProjectDiscoveryResult;
  fileTree: FileSystemNode[];
  metadata: ProjectMetadata;
}

export interface FileSystemNode {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: Date;
  children?: FileSystemNode[];
}

export interface ProjectMetadata {
  name: string;
  version?: string;
  description?: string;
  mainFile?: string;
  dependencies?: string[];
}

/**
 * Health & Status Types
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  services: {
    llm: 'connected' | 'disconnected' | 'error';
    database?: 'connected' | 'disconnected' | 'error';
    fileSystem?: 'connected' | 'disconnected' | 'error';
  };
}

export interface ConfigResponse {
  availableModels: string[];
  currentModel: string;
  features: {
    toolExecution: boolean;
    streaming: boolean;
    sessions: boolean;
    fileAccess: boolean;
  };
  limits: {
    maxMessageLength: number;
    maxFileSize: number;
    maxToolExecutionTime: number;
  };
}
