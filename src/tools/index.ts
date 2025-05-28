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

// Individual tools
export { LSTool } from './ls';
export { EchoTool } from './echo';
export { ReadTool } from './read';

import { LSTool } from './ls';
import { EchoTool } from './echo';
import { ReadTool } from './read';

export const tools = [
  new EchoTool(),
  new LSTool(),
  new ReadTool(),
];
