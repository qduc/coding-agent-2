import chalk from 'chalk';
import { logger } from './logger';

/**
 * Tool Logger - Utility for logging tool usage by the LLM
 *
 * Provides standardized logging for tool calls and results with:
 * - Visual indicators for tool usage
 * - Argument formatting
 * - Result truncation for readability
 * - Colorized output
 */
export class ToolLogger {
  /**
   * Log when a tool is being called by the LLM
   */
  static logToolCall(toolName: string, args: any): void {
    console.log(chalk.blue('🔧 Tool Usage:'), chalk.cyan(toolName));
    if (args && Object.keys(args).length > 0) {
      console.log(chalk.gray('   Arguments:'), JSON.stringify(args, null, 2));
    }

    // Also log to structured logger for debugging
    logger.debug(`Tool called: ${toolName}`, { toolName, args }, 'TOOL');
  }

  /**
   * Log the result of a tool execution
   */
  static logToolResult(toolName: string, success: boolean, result?: any): void {
    const status = success ? chalk.green('✅') : chalk.red('❌');
    console.log(status, chalk.cyan(toolName), success ? 'completed' : 'failed');

    // Log to structured logger
    if (success) {
      logger.debug(`Tool completed: ${toolName}`, { toolName, success, result }, 'TOOL');
    } else {
      const error = result instanceof Error ? result : undefined;
      logger.error(`Tool failed: ${toolName}`, error, { toolName, success, result }, 'TOOL');
    }

    if (result) {
      // Special handling for Read tool - don't output file content
      if (toolName.toLowerCase().includes('read')) {
        if (typeof result === 'string' && result.length > 0) {
          const lineCount = result.split('\n').length;
          console.log(chalk.gray('   Result:'), `[File content loaded successfully, ${lineCount} lines]`);
        } else {
          console.log(chalk.gray('   Result:'), result);
        }
        return;
      }

      // Format different result types appropriately
      if (typeof result === 'string') {
        const lines = result.split('\n');
        if (lines.length > 4 || result.length > 300) {
          const preview = lines.slice(0, 4).join('\n');
          const truncatedInfo = lines.length > 4 ? `... (+${lines.length - 4} more lines)` : '...';
          console.log(chalk.gray('   Result: [truncated]'));
          console.log(preview + '\n' + chalk.gray(truncatedInfo));
        } else {
          console.log(chalk.gray('   Result:'), result);
        }
      } else if (result instanceof Error) {
        console.log(chalk.gray('   Error:'), chalk.red(result.message));
      } else if (typeof result === 'object') {
        try {
          const formatted = JSON.stringify(result, null, 2);
          const lines = formatted.split('\n');
          if (lines.length > 8 || formatted.length > 400) {
            const preview = lines.slice(0, 8).join('\n');
            const truncatedInfo = `... (+${lines.length - 8} more lines)`;
            console.log(chalk.gray('   Result: [truncated object]'));
            console.log(preview + '\n' + chalk.gray(truncatedInfo));
          } else {
            console.log(chalk.gray('   Result:'), formatted);
          }
        } catch (e) {
          console.log(chalk.gray('   Result:'), '[Complex object]');
        }
      } else {
        console.log(chalk.gray('   Result:'), result);
      }
    }
  }
}
