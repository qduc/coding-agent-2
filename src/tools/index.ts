/**
 * Tools module exports
 *
 * This module provides the foundation for all tools in the coding agent,
 * including the base class, type definitions, validation, and error handling.
 */

// Core base class
export { BaseTool } from './base';

// Tools
export { LSTool } from './ls';
export type { LSParams, FileEntry, LSResult } from './ls';

export { ReadTool } from './read';
export type { ReadParams, ReadResult } from './read';
/**
 * Tools module index
 *
 * Exports all available tools to simplify imports
 */

// Base tool functionality
export * from './types';
export * from './base';
export * from './validation';
export * from './retry';

// Tool implementations
export * from './ls';
export * from './glob';
export * from './read';

// Tool registry for dynamic tool loading
import { BaseTool } from './base';
import { LSTool } from './ls';
import { GlobTool } from './glob';
import { ReadTool } from './read';

/**
 * Registry of all available tools
 */
export const tools: Record<string, new (...args: any[]) => BaseTool> = {
  ls: LSTool,
  glob: GlobTool,
  read: ReadTool
};
export { GlobTool } from './glob';
export type { GlobParams, GlobMatch, GlobResult } from './glob';

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

// Default tools array - can be used to create orchestrator with common tools
export const defaultTools = [
  // LSTool will be instantiated when needed
];