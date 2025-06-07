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
 * - Respects tool console logging setting
 */
export class ToolLogger {
  /**
   * Format arguments for human-readable display
   */
  private static formatArgsForDisplay(toolName: string, args: any): string {
    if (!args || typeof args !== 'object') {
      return String(args);
    }

    const toolLower = toolName.toLowerCase();
    const parts: string[] = [];

    // Tool-specific formatting
    if (toolLower.includes('read')) {
      if (args.path) parts.push(`path: ${args.path}`);
      if (args.startLine) parts.push(`lines: ${args.startLine}-${args.endLine || 'end'}`);
      if (args.maxLines) parts.push(`maxLines: ${args.maxLines}`);
      if (args.encoding && args.encoding !== 'utf8') parts.push(`encoding: ${args.encoding}`);
    } else if (toolLower.includes('write')) {
      if (args.path) parts.push(`path: ${args.path}`);
      if (args.content) {
        const lines = args.content.split('\n').length;
        const chars = args.content.length;
        parts.push(`content: ${lines} lines, ${chars} chars`);
      }
      if (args.diff) parts.push(`diff: ${args.diff.split('\n').length} lines`);
      if (args.encoding && args.encoding !== 'utf8') parts.push(`encoding: ${args.encoding}`);
      if (args.backup === false) parts.push('backup: false');
    } else if (toolLower.includes('ls')) {
      if (args.path) parts.push(`path: ${args.path}`);
      if (args.recursive) parts.push('recursive: true');
      if (args.includeHidden) parts.push('includeHidden: true');
    } else if (toolLower.includes('glob')) {
      if (args.pattern) parts.push(`pattern: ${args.pattern}`);
      if (args.cwd) parts.push(`cwd: ${args.cwd}`);
    } else if (toolLower.includes('grep') || toolLower.includes('search')) {
      if (args.pattern) parts.push(`pattern: ${args.pattern}`);
      if (args.path) parts.push(`path: ${args.path}`);
      if (args.filePattern) parts.push(`files: ${args.filePattern}`);
    } else if (toolLower.includes('bash')) {
      if (args.command) {
        const cmd = args.command.length > 50 ? args.command.substring(0, 50) + '...' : args.command;
        parts.push(`command: ${cmd}`);
      }
      if (args.cwd) parts.push(`cwd: ${args.cwd}`);
    } else {
      // Generic formatting for other tools
      for (const [key, value] of Object.entries(args)) {
        if (typeof value === 'string' && value.length > 100) {
          parts.push(`${key}: [${value.length} chars]`);
        } else if (typeof value === 'object') {
          parts.push(`${key}: [object]`);
        } else {
          parts.push(`${key}: ${value}`);
        }
      }
    }

    return parts.length > 0 ? parts.join(', ') : JSON.stringify(this.filterLongParams(args));
  }

  /**
   * Filter out long parameters that shouldn't be displayed in console
   */
  private static filterLongParams(args: any): any {
    if (!args || typeof args !== 'object') {
      return args;
    }

    const filtered = { ...args };
    const longParamKeys = ['content', 'data', 'text', 'body', 'payload'];

    for (const key of Object.keys(filtered)) {
      const value = filtered[key];

      // Check if it's a long parameter by key name
      if (longParamKeys.some(longKey => key.toLowerCase().includes(longKey))) {
        if (typeof value === 'string' && value.length > 100) {
          filtered[key] = `[${value.length} characters]`;
        }
        continue;
      }

      // Check if it's a long string value
      if (typeof value === 'string' && value.length > 200) {
        filtered[key] = `[${value.length} characters]`;
      }

      // Recursively filter nested objects
      if (typeof value === 'object' && value !== null) {
        filtered[key] = this.filterLongParams(value);
      }
    }

    return filtered;
  }

  /**
   * Log when a tool is being called by the LLM
   */
  static logToolCall(toolName: string, args: any): void {
    // Only show tool messages in console if tool console logging is enabled
    if (logger.isToolConsoleEnabled()) {
      console.log(chalk.blue('🔧 Tool Usage:'), chalk.cyan(toolName));
      if (args && Object.keys(args).length > 0) {
        const humanReadableArgs = this.formatArgsForDisplay(toolName, args);
        console.log(chalk.gray('   Arguments:'), humanReadableArgs);
      }
    }

    // Always log to structured logger for debugging (goes to file)
    logger.debug(`Tool called: ${toolName}`, { toolName, args }, 'TOOL');
  }

  /**
   * Log the result of a tool execution
   */
  static logToolResult(toolName: string, success: boolean, result?: any, args?: any): void {
    // Only show tool messages in console if tool console logging is enabled
    if (logger.isToolConsoleEnabled()) {
      const status = success ? chalk.green('✅') : chalk.red('❌');
      console.log(status, chalk.cyan(toolName), success ? 'completed' : 'failed');
    }

    // Always log to structured logger for debugging (goes to file)
    if (success) {
      logger.debug(`Tool completed: ${toolName}`, { toolName, success, result }, 'TOOL');
    } else {
      const error = result instanceof Error ? result : undefined;
      logger.error(`Tool failed: ${toolName}`, error, { toolName, success, result }, 'TOOL');
    }

    // Only show result metrics in console if tool console logging is enabled
    if (result && logger.isToolConsoleEnabled()) {
      const metrics = this.getResultMetrics(toolName, result, args);
      if (metrics) {
        console.log(chalk.gray('   Result:'), metrics);
      }
    }
  }

  /**
   * Extract meaningful metrics from tool results
   */
  private static getResultMetrics(toolName: string, result: any, args?: any): string | null {
    if (result instanceof Error) {
      return chalk.red(result.message);
    }

    // Handle file operation tools specifically
    const toolLower = toolName.toLowerCase();
    
    // Write tool - show bytes written and lines
    if (toolLower.includes('write')) {
      // Handle WriteResult object
      if (typeof result === 'object' && result !== null && 'bytesWritten' in result) {
        const bytes = result.bytesWritten || 0;
        const created = result.created ? 'created' : 'modified';
        const mode = result.mode || 'write';
        const lines = args?.content ? args.content.split('\n').length : 0;
        
        if (lines > 0) {
          return `✏️ File ${created}: ${lines} lines, ${bytes} bytes (${mode})`;
        } else {
          return `✏️ File ${created}: ${bytes} bytes (${mode})`;
        }
      }
      
      // Fallback for string results
      if (typeof result === 'string' && result.includes('successfully')) {
        const content = args?.content || '';
        const lines = content.split('\n').length;
        return `✏️ File written: ${lines} lines`;
      }
      return `✏️ File written`;
    }

    // Edit tool - show lines affected
    if (toolLower.includes('edit')) {
      if (typeof result === 'string') {
        // Try to extract lines affected from edit result
        const linesMatch = result.match(/(\d+)\s+lines?\s+(changed|modified|affected)/i);
        if (linesMatch) {
          return `✏️ File edited: ${linesMatch[1]} lines affected`;
        }
        // Check for specific edit operations
        if (result.includes('replaced') || result.includes('modified')) {
          const oldString = args?.old_string || args?.oldString || '';
          const newString = args?.new_string || args?.newString || '';
          const oldLines = oldString.split('\n').length;
          const newLines = newString.split('\n').length;
          const delta = newLines - oldLines;
          const deltaStr = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '±0';
          return `✏️ File edited: ${Math.max(oldLines, newLines)} lines affected (${deltaStr})`;
        }
      }
      return `✏️ File edited`;
    }

    // Bash tool - show command execution results
    if (toolLower.includes('bash')) {
      // Handle BashResult object (direct result)
      if (typeof result === 'object' && result !== null && 'exitCode' in result) {
        const exitCode = result.exitCode;
        const executionTime = result.executionTime || 0;
        const stdout = result.stdout || '';
        const stderr = result.stderr || '';
        
        const status = exitCode === 0 ? 'success' : 'failed';
        const outputLines = stdout ? stdout.split('\n').filter((line: string) => line.trim()).length : 0;
        const errorLines = stderr ? stderr.split('\n').filter((line: string) => line.trim()).length : 0;
        
        let details = `exit ${exitCode}`;
        if (outputLines > 0) details += `, ${outputLines} lines output`;
        if (errorLines > 0) details += `, ${errorLines} lines stderr`;
        if (executionTime > 0) details += `, ${executionTime}ms`;
        
        return `⚡ Command ${status}: ${details}`;
      }
      
      // Handle ToolError case - try to get command from args
      if (typeof result === 'object' && result !== null && 'name' in result && result.name === 'ToolError') {
        const command = args?.command || 'unknown';
        const shortCmd = command.length > 30 ? command.substring(0, 30) + '...' : command;
        return `⚡ Command failed: ${shortCmd}`;
      }
      
      // Fallback for string results
      if (typeof result === 'string') {
        const lines = result.split('\n').length;
        return `⚡ Command output: ${lines} lines`;
      }
      return `⚡ Command executed`;
    }

    // Handle object results from read tool specifically
    if (typeof result === 'object' && result !== null && toolLower.includes('read')) {
      // Check if it's a ReadResult object with lineCount
      if ('lineCount' in result && typeof result.lineCount === 'number') {
        const chars = result.content ? result.content.length : 0;
        const partialInfo = result.partialRead ? ' (partial)' : '';
        return `📄 File loaded: ${result.lineCount} lines, ${chars} characters${partialInfo}`;
      }
    }

    // Handle string results (file content, command output, etc.)
    if (typeof result === 'string') {
      const lines = result.split('\n');
      const chars = result.length;

      if (toolLower.includes('read')) {
        return `📄 File loaded: ${lines.length} lines, ${chars} characters`;
      } else if (toolLower.includes('ls') || toolLower.includes('list')) {
        // Try to count files and directories from ls-style output
        const items = lines.filter(line => line.trim().length > 0);
        const dirs = items.filter(line => line.includes('/') || line.endsWith('/')).length;
        const files = items.length - dirs;
        return `📁 Listed: ${files} files, ${dirs} directories`;
      } else if (toolLower.includes('grep') || toolLower.includes('search')) {
        const matches = lines.filter(line => line.trim().length > 0).length;
        return `🔍 Found: ${matches} matches`;
      } else {
        return `📝 Output: ${lines.length} lines, ${chars} characters`;
      }
    }

    // Handle array results
    if (Array.isArray(result)) {
      if (toolName.toLowerCase().includes('glob') || toolName.toLowerCase().includes('find')) {
        const files = result.filter(item => !item.endsWith('/')).length;
        const dirs = result.length - files;
        return `🔍 Found: ${files} files, ${dirs} directories`;
      }
      return `📋 Items: ${result.length} entries`;
    }

    // Handle object results
    if (typeof result === 'object') {
      const keys = Object.keys(result);
      if (keys.length === 0) {
        return `📦 Empty object`;
      }

      // Check for common object patterns
      if (result.files && Array.isArray(result.files)) {
        return `📁 Found: ${result.files.length} files`;
      }
      if (result.directories && Array.isArray(result.directories)) {
        return `📁 Found: ${result.directories.length} directories`;
      }
      if (result.matches && Array.isArray(result.matches)) {
        return `🔍 Found: ${result.matches.length} matches`;
      }

      return `📦 Object: ${keys.length} properties`;
    }

    // Handle boolean results
    if (typeof result === 'boolean') {
      return result ? '✓ Success' : '✗ Failed';
    }

    // Handle number results
    if (typeof result === 'number') {
      return `🔢 Result: ${result}`;
    }

    return null;
  }
}
