import chalk from 'chalk';

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
  }

  /**
   * Log the result of a tool execution
   */
  static logToolResult(toolName: string, success: boolean, result?: any): void {
    const status = success ? chalk.green('✅') : chalk.red('❌');
    console.log(status, chalk.cyan(toolName), success ? 'completed' : 'failed');

    if (result) {
      // Format different result types appropriately
      if (typeof result === 'string') {
        if (result.length > 100) {
          console.log(chalk.gray('   Result: [truncated]'), result.substring(0, 100) + '...');
        } else {
          console.log(chalk.gray('   Result:'), result);
        }
      } else if (result instanceof Error) {
        console.log(chalk.gray('   Error:'), chalk.red(result.message));
      } else if (typeof result === 'object') {
        try {
          const formatted = JSON.stringify(result, null, 2);
          if (formatted.length > 200) {
            console.log(chalk.gray('   Result: [truncated object]'));
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
