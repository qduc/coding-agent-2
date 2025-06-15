import chalk from 'chalk';
import { logger } from './logger';
import { toolEventEmitter } from './toolEvents';
import { configManager } from '../core/config';
import {
  formatArgsForDisplay,
  filterLongParams
} from './toolLogger/formatters';
import {
  getMinimalContext,
  getMinimalOutcome
} from './toolLogger/displayFormatters';
import { getResultMetrics } from './toolLogger/metricsExtractor';

/**
 * Tool Logger - Utility for logging tool usage by the LLM
 *
 * Provides standardized logging for tool calls and results with:
 * - Visual indicators for tool usage
 * - Argument formatting
 * - Result truncation for readability
 * - Colorized output
 * - Respects tool console logging setting
 */
export class ToolLogger {
  /**
   * Log when a tool is being called by the LLM
   */
  static logToolCall(toolName: string, args: any): void {
    // Emit tool event for UI components (like Ink) to handle
    toolEventEmitter.emitToolCall(toolName, args);

    // Always log to structured logger for debugging (goes to file)
    logger.debug(`Tool called: ${toolName}`, { toolName, args }, 'TOOL');
  }

  /**
   * Log the result of a tool execution
   */
  static logToolResult(toolName: string, success: boolean, result?: any, args?: any): void {
    // Emit tool event for UI components (like Ink) to handle
    toolEventEmitter.emitToolResult(toolName, success, result, args);

    // Always log to structured logger for debugging (goes to file)
    if (success) {
      logger.debug(`Tool completed: ${toolName}`, { toolName, success, result }, 'TOOL');
    } else {
      const error = result instanceof Error ? result : undefined;

      // Enhanced logging for failed write operations
      if (toolName.toLowerCase().includes('write')) {
        // Log with full context including arguments for write failures
        logger.error(`Write tool failed: ${toolName}`, error, {
          toolName,
          success,
          result,
          args: filterLongParams(args),
          errorDetails: {
            message: error?.message || (typeof result === 'string' ? result : 'Unknown error'),
            arguments: args,
            timestamp: new Date().toISOString()
          }
        }, 'TOOL');

        // For write tool failures, the error information is already logged above
        // The UI layer (Ink) will handle displaying critical errors through events
        // No additional console output needed here to avoid interfering with Ink
      } else {
        // Standard logging for other tool failures
        logger.error(`Tool failed: ${toolName}`, error, { toolName, success, result }, 'TOOL');
      }
    }
  }

  /**
   * Format tool call for UI display with full details
   */
  static formatToolCallForUI(toolName: string, args: any): string {
    return this.formatToolOperationFull(toolName, args);
  }

  /**
   * Format tool result for UI display with full details
   */
  static formatToolResultForUI(toolName: string, success: boolean, result?: any, args?: any): string {
    return this.formatToolOperationFull(toolName, args, success, result);
  }

  /**
   * Format tool operation with modern minimalistic design
   */
  static formatToolOperationFull(toolName: string, args: any, success?: boolean, result?: any): string {
    if (success === undefined) {
      // Tool call in progress - clean, minimal format
      const context = getMinimalContext(toolName, args);
      return `▶ ${toolName}${context}`;
    } else {
      // Complete operation with modern design
      const status = success ? '✓' : '✗';
      const context = getMinimalContext(toolName, args);
      const outcome = getMinimalOutcome(toolName, success, result, args);
      
      return `${status} ${toolName}${context}${outcome}`;
    }
  }
}
