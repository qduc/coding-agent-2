/**
 * Type definitions for the tools system
 */

/**
 * JSON Schema definition for tool parameters
 */
export interface ToolSchema {
  type: 'object';
  properties: Record<string, PropertySchema>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface PropertySchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: string[];
  default?: any;
  items?: PropertySchema;
  properties?: Record<string, PropertySchema>;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  pattern?: string;
}

/**
 * Result of tool execution
 */
export interface ToolResult {
  success: boolean;
  output?: any;
  error?: ToolError | string;
  metadata?: {
    executionTime?: number;
    errorCode?: string;
  };
}

/**
 * Tool execution error with context
 */
export class ToolError extends Error {
  code: ToolErrorCode;
  suggestions?: string[];

  constructor(message: string, code: ToolErrorCode, suggestions?: string[]) {
    super(message);
    this.name = 'ToolError';
    this.code = code;
    this.suggestions = suggestions;

    // Set the prototype explicitly to ensure instanceof works correctly
    Object.setPrototypeOf(this, ToolError.prototype);
  }
}

/**
 * Standard error codes for tool operations
 */
export type ToolErrorCode =
  | 'FILE_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'INVALID_PATH'
  | 'INVALID_PARAMS'
  | 'VALIDATION_ERROR'
  | 'FILE_TOO_LARGE'
  | 'OPERATION_TIMEOUT'
  | 'DIRECTORY_ERROR'
  | 'UNKNOWN_ERROR'
  | 'INVALID_PATTERN'
  | 'INVALID_FILE_TYPE'
  | 'BINARY_FILE'
  | 'INVALID_COMMAND'
  | 'DANGEROUS_COMMAND'
  | 'UNSAFE_COMMAND'
  | 'COMMAND_FAILED'
  | 'EXECUTION_ERROR'
  | 'TIMEOUT'
  | 'SPAWN_ERROR'
  | 'SUB_AGENT_TASK_FAILED'
  | 'DELEGATION_ERROR'
  | 'SUB_AGENT_CREATION_FAILED';

/**
 * Tool execution context for security and limits
 */
export interface ToolContext {
  /** Working directory for relative paths */
  workingDirectory: string;
  /** Maximum file size to read (in bytes) */
  maxFileSize: number;
  /** Maximum execution time (in milliseconds) */
  timeout: number;
  /** Whether to allow access to hidden files/directories */
  allowHidden: boolean;
  /** Allowed file extensions (empty = all allowed) */
  allowedExtensions: string[];
  /** Blocked directories (for security) */
  blockedPaths: string[];
}

/**
 * Default tool context with sensible security limits
 */
export const DEFAULT_TOOL_CONTEXT: ToolContext = {
  workingDirectory: process.cwd(),
  maxFileSize: 10 * 1024 * 1024, // 10MB
  timeout: 30000, // 30 seconds
  allowHidden: false,
  allowedExtensions: [], // All extensions allowed by default
  blockedPaths: [
    'node_modules',
    '.git',
    '.env',
    '.env.*',
    '*.log',
    'dist',
    'build',
    'coverage'
  ]
};

/**
 * Function calling schema for OpenAI
 */
export interface FunctionCallSchema {
  name: string;
  description: string;
  parameters: ToolSchema;
}
