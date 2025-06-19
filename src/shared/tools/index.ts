/**
 * Tools module exports
 *
 * This module provides the foundation for all tools in the coding agent,
 * including the base class, type definitions, validation, and error handling.
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
export * from './write';
export * from './ripgrep';
export * from './bash';
export * from './todo';
export * from './subAgent';
export * from './webSearch';
export * from './astGrep';

// Tool registry for dynamic tool loading
import { BaseTool } from './base';
import { LSTool } from './ls';
import { GlobTool } from './glob';
import { ReadTool } from './read';
import { WriteTool } from './write';
import { RipgrepTool } from './ripgrep';
import { BashTool } from './bash';
import { TodoTool } from './todo';
import { SubAgentTool } from './subAgent';
import { WebSearchTool } from './webSearch';
import { AstGrepTool } from './astGrep';

/**
 * Registry of all available tools
 */
export const tools: Record<string, new (...args: any[]) => BaseTool> = {
  ls: LSTool,
  glob: GlobTool,
  read: ReadTool,
  write: WriteTool,
  ripgrep: RipgrepTool,
  bash: BashTool,
  todo: TodoTool,
  sub_agent: SubAgentTool,
  web_search: WebSearchTool,
  ast_grep: AstGrepTool,
  ping: PingTool
};

// Default tools array - can be used to create orchestrator with common tools
export const defaultTools = [
  // Tools will be instantiated when needed
];
