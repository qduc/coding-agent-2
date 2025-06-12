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

        // Output detailed failure information to console for immediate visibility
        const config = configManager.getConfig();
        if (config.enableToolConsoleLogging) {
          console.error(chalk.red('\n━━━ WRITE TOOL FAILURE ━━━'));
          console.error(chalk.red(`Tool: ${toolName}`));
          console.error(chalk.red(`Error: ${error?.message || (typeof result === 'string' ? result : 'Unknown error')}`));

          if (args) {
            console.error(chalk.yellow('Arguments passed to tool:'));
            const formattedArgs = formatArgsForDisplay(toolName, args);
            console.error(chalk.gray(`  ${formattedArgs}`));

            // Show specific write parameters
            if (args.path) {
              console.error(chalk.gray(`  Target file: ${args.path}`));
            }
            if (args.content !== undefined) {
              const contentInfo = typeof args.content === 'string'
                ? `${args.content.split('\n').length} lines, ${args.content.length} chars`
                : 'non-string content';
              console.error(chalk.gray(`  Content: ${contentInfo}`));
            }
            if (args.diff !== undefined) {
              const diffInfo = typeof args.diff === 'string'
                ? `${args.diff.split('\n').length} lines`
                : 'non-string diff';
              console.error(chalk.gray(`  Diff: ${diffInfo}`));
            }
          }
          console.error(chalk.red('━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
        }
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
