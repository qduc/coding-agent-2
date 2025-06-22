/**
 * SubAgentTool - Context Finder Tool
 *
 * Helps the main agent understand the codebase by finding and summarizing context
 * that cannot be provided by simple search tools.
 */

import { BaseTool } from './base';
import { ToolSchema, ToolResult } from './types';
import { logger } from '../utils/logger';
import { ToolOrchestrator } from '../core/orchestrator';
import { llmService } from '../services/llm';
import { LSTool } from './ls';
import { GlobTool } from './glob';
import { ReadTool } from './read';
import { RipgrepTool } from './ripgrep';
import { AstGrepTool } from './astGrep';

export class SubAgentTool extends BaseTool {
  readonly name = 'sub_agent';
  readonly description = 'Finds and summarizes codebase context for the main agent.';

  readonly schema: ToolSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'What context or explanation is needed from the codebase?',
        minLength: 5,
        maxLength: 2000
      }
    },
    required: ['query'],
    additionalProperties: false
  };

  /**
   * Find and summarize codebase context for the given query using LLM and read-only tools
   */
  protected async executeImpl(params: any, abortSignal?: AbortSignal): Promise<ToolResult> {
    const { query } = params;
    try {
      logger.info(`SubAgentTool: Finding context for query using LLM: ${query}`);

      // Ensure LLM service is ready
      if (!llmService.isReady()) {
        await llmService.initialize();
        if (!llmService.isReady()) {
          throw new Error('LLM service not initialized');
        }
      }

      // Instantiate only read-only tools
      const toolContext = {
        workingDirectory: process.cwd(),
        maxFileSize: 1024 * 1024 * 5, // 5MB
        timeout: 30000,
        allowHidden: false,
        allowedExtensions: [],
        blockedPaths: ['node_modules', '.git', 'dist', 'build', 'coverage']
      };
      const tools = [
        new LSTool(toolContext),
        new GlobTool(toolContext),
        new ReadTool(toolContext),
        new RipgrepTool(toolContext),
        new AstGrepTool(toolContext)
      ];

      // Create a new orchestrator for this single-shot context finding
      const orchestrator = new ToolOrchestrator(llmService, tools);

      // Compose a system prompt for one-shot context finding
      const systemPrompt = [
        'You are a codebase context sub-agent. You are invoked in a one-shot, non-interactive mode.',
        'You cannot ask clarifying questions or request more information from the caller.',
        'Your job is to provide the most comprehensive, self-contained answer possible to the following query, using only the tools provided (ls, glob, read, ripgrep, ast_grep) as needed.',
        'Be thorough, concise, and do not assume you will get a follow-up.',
        '',
        `QUERY: ${query}`
      ].join('\n');

      // Single prompt, not interactive: just one processMessage call
      const context = await orchestrator.processMessage(systemPrompt, undefined, false, abortSignal);

      return this.createSuccessResult(context);
    } catch (error) {
      return this.createErrorResult(
        `Failed to find context: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNKNOWN_ERROR',
        [
          'Ensure the codebase is accessible',
          'Check if the query is clear and specific',
          'Try focusing on a simpler query'
        ]
      );
    }
  }
}