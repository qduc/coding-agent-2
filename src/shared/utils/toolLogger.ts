import chalk from 'chalk';
import { logger } from './logger';
import { toolEventEmitter } from './toolEvents';
import { configManager } from '../core/config';

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
        // Don't truncate bash commands - they are important for debugging
        parts.push(`command: ${args.command}`);
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
      logger.error(`Tool failed: ${toolName}`, error, { toolName, success, result }, 'TOOL');
    }
  }

  /**
   * Format tool call for UI display
   */
  static formatToolCallForUI(toolName: string, args: any): string {
    return this.formatToolOperationCondensed(toolName, args);
  }

  /**
   * Format tool result for UI display
   */
  static formatToolResultForUI(toolName: string, success: boolean, result?: any, args?: any): string {
    return this.formatToolOperationCondensed(toolName, args, success, result);
  }

  /**
   * Format tool operation as a single condensed line
   */
  static formatToolOperationCondensed(toolName: string, args: any, success?: boolean, result?: any): string {
    const essentialContext = this.getEssentialContext(toolName, args);
    const outcome = success !== undefined ? this.getCondensedOutcome(toolName, success, result, args) : '';

    if (success === undefined) {
      // Tool call only
      return `${toolName}${essentialContext}`;
    } else {
      // Complete operation
      const status = success ? '✓' : '✗';
      return `${status} ${toolName}${essentialContext}${outcome}`;
    }
  }

  /**
   * Get essential context for a tool call (most important args only)
   */
  private static getEssentialContext(toolName: string, args: any): string {
    if (!args || typeof args !== 'object') {
      return '';
    }

    const toolLower = toolName.toLowerCase();

    // Show only the most essential parameter for each tool type
    if (toolLower.includes('read') && args.path) {
      return ` ${args.path}`;
    } else if (toolLower.includes('write') && args.path) {
      return ` ${args.path}`;
    } else if (toolLower.includes('bash') && args.command) {
      // Don't truncate bash commands - they are important for debugging
      return ` "${args.command}"`;
    } else if ((toolLower.includes('glob') || toolLower.includes('grep')) && args.pattern) {
      return ` "${args.pattern}"`;
    } else if (toolLower.includes('ls') && args.path) {
      return ` ${args.path}`;
    }

    // For other tools, try to find the most important parameter
    const importantKeys = ['path', 'file', 'command', 'pattern', 'query', 'name'];
    for (const key of importantKeys) {
      if (args[key]) {
        const value = typeof args[key] === 'string' ? args[key] : String(args[key]);
        // Don't truncate bash commands
        if (key === 'command' && toolLower.includes('bash')) {
          return ` ${value}`;
        }
        const truncated = value.length > 30 ? value.substring(0, 30) + '…' : value;
        return ` ${truncated}`;
      }
    }

    return '';
  }

  /**
   * Get condensed outcome for tool result (most important info only)
   */
  private static getCondensedOutcome(toolName: string, success: boolean, result?: any, args?: any): string {
    if (!success) {
      // Show the actual error for failed tools
      if (result instanceof Error) {
        return ` failed: ${result.message}`;
      }
      if (typeof result === 'string' && result.trim()) {
        const errorMsg = result.length > 50 ? result.substring(0, 50) + '…' : result;
        return ` failed: ${errorMsg}`;
      }
      return ' failed';
    }

    const toolLower = toolName.toLowerCase();

    // Return meaningful outcome with detailed information
    if (toolLower.includes('write')) {
      if (typeof result === 'object' && result?.linesChanged) {
        const action = result.created ? 'created' : 'modified';
        let outcome = ` (${action}, ${result.linesChanged} lines changed`;
        
        // Show preview of what was written
        if (args?.content && typeof args.content === 'string') {
          const preview = args.content.split('\n')
            .slice(0, 3)
            .map((line: string) => line.trim())
            .filter((line: string) => line.length > 0);
          if (preview.length > 0) {
            const previewText = preview.join('\n');
            const truncated = previewText.length > 80 ? previewText.substring(0, 80) + '…' : previewText;
            outcome += `:\n${truncated}`;
          }
        }
        
        return outcome + ')';
      }
      
      const lines = args?.content ? args.content.split('\n').length : 0;
      let outcome = lines > 0 ? ` (written, ${lines} lines` : ' (written';
      
      // Show preview of what was written
      if (args?.content && typeof args.content === 'string') {
        const preview = args.content.split('\n')
          .slice(0, 3)
          .map((line: string) => line.trim())
          .filter((line: string) => line.length > 0);
        if (preview.length > 0) {
          const previewText = preview.join('\n');
          const truncated = previewText.length > 80 ? previewText.substring(0, 80) + '…' : previewText;
          outcome += `:\n${truncated}`;
        }
      }
      
      return outcome + ')';
    } else if (toolLower.includes('read')) {
      if (typeof result === 'object' && result?.lineCount) {
        const partial = result.partialRead ? ', truncated' : '';
        return ` (${result.lineCount} lines${partial})`;
      } else if (typeof result === 'string') {
        const lines = result.split('\n').length;
        const chars = result.length;
        return ` (${lines} lines, ${chars} chars)`;
      }
    } else if (toolLower.includes('bash')) {
      if (typeof result === 'object' && result?.exitCode !== undefined) {
        const stdout = result.stdout || '';
        const stderr = result.stderr || '';
        const outputLines = stdout ? stdout.split('\n').filter((line: string) => line.trim()).length : 0;
        const hasStderr = stderr && stderr.trim();
        
        let outcome = `exit ${result.exitCode}`;
        if (outputLines > 0) {
          outcome += `, ${outputLines} lines output`;
          // Show first 5 lines of output for user awareness
          const firstLines = stdout.split('\n')
            .filter((line: string) => line.trim())
            .slice(0, 5)
            .map((line: string) => line.trim());
          if (firstLines.length > 0) {
            const preview = firstLines.join('\n');
            const truncated = preview.length > 100 ? preview.substring(0, 100) + '…' : preview;
            outcome += `:\n${truncated}`;
          }
        }
        if (hasStderr) outcome += ', warnings';
        if (result.executionTime > 1000) outcome += `, ${Math.round(result.executionTime)}ms`;
        
        return ` (${outcome})`;
      }
      return ' (executed)';
    } else if (toolLower.includes('glob') || toolLower.includes('ls')) {
      if (Array.isArray(result)) {
        const files = result.filter(item => !item.endsWith('/')).length;
        const dirs = result.length - files;
        if (dirs > 0) {
          return ` (${files} files, ${dirs} dirs)`;
        }
        return ` (${result.length} items)`;
      }
    } else if (toolLower.includes('grep')) {
      // Handle RipgrepResult object format
      if (typeof result === 'object' && result !== null && 'matches' in result && Array.isArray(result.matches)) {
        const matches = result.matches.length;
        const files = new Set(result.matches.map((match: any) => match.file)).size;
        if (files > 1) {
          return ` (${matches} matches in ${files} files)`;
        }
        return ` (${matches} matches)`;
      }
      // Handle string format (for other grep tools)
      if (typeof result === 'string') {
        const matches = result.trim() ? result.split('\n').filter(line => line.trim()).length : 0;
        const files = result.trim() ? new Set(result.split('\n').map(line => line.split(':')[0])).size : 0;
        if (files > 1) {
          return ` (${matches} matches in ${files} files)`;
        }
        return ` (${matches} matches)`;
      }
      return ' (0 matches)';
    }

    return '';
  }

  /**
   * Extract meaningful metrics from tool results
   */
  private static getResultMetrics(toolName: string, result: any, args?: any): string | null {
    if (result instanceof Error) {
      return result.message;
    }

    // Handle file operation tools specifically
    const toolLower = toolName.toLowerCase();

    // Write tool - show lines changed
    if (toolLower.includes('write')) {
      // Handle WriteResult object
      if (typeof result === 'object' && result !== null && 'linesChanged' in result) {
        const linesChanged = result.linesChanged || 0;
        const created = result.created ? 'created' : 'modified';
        const mode = result.mode || 'write';

        return `✏️ File ${created}: ${linesChanged} lines changed (${mode})`;
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
        // Don't truncate bash commands in error messages
        return `⚡ Command failed: ${command}`;
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
