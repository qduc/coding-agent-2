/**
 * ToolExecutionHandler - Manages tool calls and execution
 */

import { BaseTool, ToolResult } from '../tools';
import chalk from 'chalk';
import { configManager } from '../core/config';
import { ToolLogger } from '../utils/toolLogger';
import { logger } from '../utils/logger';

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export class ToolExecutionHandler {
  private tools: Map<string, BaseTool> = new Map();

  constructor(tools: BaseTool[] = []) {
    tools.forEach(tool => {
      this.tools.set(tool.name, tool);
    });
  }

  /**
   * Register a new tool
   */
  registerTool(tool: BaseTool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Get all registered tools
   */
  getRegisteredTools(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool by name
   */
  getTool(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Execute a tool call and return formatted result for conversation
   */
  async executeToolCall(toolCall: ToolCall, verbose: boolean = false): Promise<{
    success: boolean;
    content: string;
    toolCallId: string;
  }> {
    const { function: func } = toolCall;
    const tool = this.tools.get(func.name);
    const startTime = Date.now();

    if (!tool) {
      const errorMessage = `Tool '${func.name}' not found`;
      logger.error('Tool not found', new Error(errorMessage), {
        toolName: func.name,
        availableTools: Array.from(this.tools.keys())
      }, 'TOOL_EXECUTION');

      if (verbose) {
        logger.debug(`❌ ${errorMessage}`, {
          toolName: func.name,
          availableTools: Array.from(this.tools.keys())
        }, 'TOOL_EXECUTION');
      }

      return {
        success: false,
        content: JSON.stringify({
          error: errorMessage,
          available_tools: Array.from(this.tools.keys())
        }),
        toolCallId: toolCall.id
      };
    }

    try {
      const { logToolUsage } = configManager.getConfig();
      if (verbose) {
        logger.debug(`🛠️  Executing tool: ${func.name}`, {
          toolName: func.name,
          arguments: func.arguments
        }, 'TOOL_EXECUTION');
      }

      // Parse arguments
      let args: any;
      try {
        args = JSON.parse(func.arguments);
      } catch (error) {
        const parseError = new Error(`Invalid JSON arguments: ${func.arguments}`);
        logger.error('Tool argument parsing failed', parseError, {
          toolName: func.name,
          arguments: func.arguments
        }, 'TOOL_EXECUTION');
        throw parseError;
      }

      logger.debug('Executing tool', { toolName: func.name, args }, 'TOOL_EXECUTION');

      // Log tool call for UI display
      if (logToolUsage) {
        ToolLogger.logToolCall(func.name, args);
      }

      // Execute the tool
      const result = await tool.execute(args);
      const executionTime = Date.now() - startTime;

      // Log tool execution
      const toolContext = {
        toolName: func.name,
        args,
        result,
        executionTimeMs: executionTime
      };
      logger.debug(`Tool executed: ${func.name}`, toolContext, 'TOOL_EXECUTION');

      if (verbose) {
        if (result.success) {
          logger.debug(`✅ Tool executed successfully`, {
            toolName: func.name,
            executionTime: result.metadata?.executionTime || executionTime
          }, 'TOOL_EXECUTION');
        } else {
          logger.debug(`❌ Tool execution failed: ${result.error}`, {
            toolName: func.name,
            error: result.error,
            executionTime
          }, 'TOOL_EXECUTION');
        }
      }

      if (logToolUsage) {
        // For bash tool, always pass the output (which contains BashResult even on failure)
        // For other tools, pass output on success, error on failure
        const logResult = (func.name.toLowerCase() === 'bash' && result.output) 
          ? result.output 
          : (result.success ? result.output : result.error);
        ToolLogger.logToolResult(func.name, result.success, logResult, args);
      }

      return {
        success: true,
        content: JSON.stringify(this.formatToolResult(result)),
        toolCallId: toolCall.id
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorObj = error instanceof Error ? error : new Error('Unknown error');
      const errorMessage = `Tool execution failed: ${errorObj.message}`;

      // Log tool execution error
      const toolErrorContext = {
        toolName: func.name,
        args: {},
        executionTimeMs: executionTime
      };
      logger.error(`Tool execution failed: ${func.name}`, errorObj, toolErrorContext, 'TOOL_EXECUTION');

      if (verbose) {
        logger.debug(`❌ ${errorMessage}`, {
          toolName: func.name,
          error: errorObj.message,
          executionTime
        }, 'TOOL_EXECUTION');
      }

      return {
        success: false,
        content: JSON.stringify({
          error: errorMessage,
          tool: func.name,
          arguments: func.arguments
        }),
        toolCallId: toolCall.id
      };
    }
  }

  /**
   * Execute a tool call and return raw result (for native tool loops)
   */
  async executeToolCallNative(toolCall: ToolCall, verbose: boolean = false): Promise<any> {
    const { function: func } = toolCall;
    const tool = this.tools.get(func.name);

    if (!tool) {
      const errorResult = {
        error: `Tool '${func.name}' not found`,
        available_tools: Array.from(this.tools.keys())
      };

      if (verbose) {
        logger.debug(`❌ ${errorResult.error}`, {
          toolName: func.name,
          availableTools: Array.from(this.tools.keys())
        }, 'TOOL_EXECUTION');
      }

      return errorResult;
    }

    try {
      if (verbose) {
        logger.debug(`🛠️  Executing: ${func.name}`, {
          toolName: func.name,
          arguments: func.arguments
        }, 'TOOL_EXECUTION');
      }

      // Parse arguments
      let args: any;
      try {
        args = JSON.parse(func.arguments);
      } catch (error) {
        throw new Error(`Invalid JSON arguments: ${func.arguments}`);
      }

      // Log tool call for UI display
      const { logToolUsage } = configManager.getConfig();
      if (logToolUsage) {
        ToolLogger.logToolCall(func.name, args);
      }

      // Execute the tool
      const result = await tool.execute(args);

      // Log tool usage if enabled
      if (logToolUsage) {
        const logResult = (func.name.toLowerCase() === 'bash' && result.output) 
          ? result.output 
          : (result.success ? result.output : result.error);
        ToolLogger.logToolResult(func.name, result.success, logResult, args);
      }

      if (verbose) {
        if (result.success) {
          logger.debug(`✅ Tool executed successfully`, {
            toolName: func.name,
            executionTime: result.metadata?.executionTime
          }, 'TOOL_EXECUTION');
        } else {
          logger.debug(`❌ Tool execution failed: ${result.error}`, {
            toolName: func.name,
            error: result.error
          }, 'TOOL_EXECUTION');
        }
      }

      // Return formatted result for LLM consumption
      return this.formatToolResult(result);
    } catch (error) {
      const errorResult = {
        error: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        tool: func.name,
        arguments: func.arguments
      };

      if (verbose) {
        logger.debug(`❌ ${errorResult.error}`, {
          toolName: func.name,
          error: errorResult.error
        }, 'TOOL_EXECUTION');
      }

      return errorResult;
    }
  }

  /**
   * Format tool result for LLM consumption
   */
  private formatToolResult(result: ToolResult): any {
    if (result.success) {
      return {
        success: true,
        data: result.output,
        metadata: result.metadata
      };
    } else {
      return {
        success: false,
        error: result.error?.toString() || 'Unknown error',
        metadata: result.metadata
      };
    }
  }

  /**
   * Get tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }
}