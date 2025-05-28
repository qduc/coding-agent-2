/**
 * Tools module exports
 *
 * This module provides the foundation for all tools in the coding agent,
 * including the base class, type definitions, validation, and error handling.
 */

// Core base class
export { BaseTool } from './base';

// Type definitions
export type {
  ToolSchema,
  PropertySchema,
  ToolResult,
  ToolContext,
  FunctionCallSchema,
  ToolErrorCode
} from './types';

export { ToolError, DEFAULT_TOOL_CONTEXT } from './types';

// Validation utilities
export { validateParams, validatePath, validateFileExtension } from './validation';

// Retry utilities
export type { RetryOptions } from './retry';
export { executeWithRetry, executeWithTimeout, DEFAULT_RETRY_OPTIONS } from './retry';
