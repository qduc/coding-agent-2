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
  data?: any;
  error?: ToolError;
  metadata?: {
    executionTime?: number;
    size?: number;
    type?: string;
    [key: string]: any;
  };
}

/**
 * Tool execution error with context
 */
export class ToolError extends Error {
  constructor(
    message: string,
    public code: ToolErrorCode,
    public suggestions?: string[]
  ) {
    super(message);
    this.name = 'ToolError';
  }

  /**
   * Convert to user-friendly error message
   */
  toUserMessage(): string {
    const baseMessage = this.message;

    if (this.suggestions && this.suggestions.length > 0) {
      return `${baseMessage}\n\nSuggestions:\n${this.suggestions.map(s => `  • ${s}`).join('\n')}`;
    }

    return baseMessage;
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
  | 'UNKNOWN_ERROR';

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
