import chalk from 'chalk';

/**
 * Display formatters for UI and terminal output
 */

/**
 * Helper to truncate file paths for display
 */
export function truncatePath(path: string): string {
  if (path.length <= 40) return path;
  
  const parts = path.split('/');
  if (parts.length <= 2) {
    return path.substring(0, 40) + '…';
  }
  
  // Show first and last parts with … in middle
  const first = parts[0] || '';
  const last = parts[parts.length - 1];
  const middle = parts.length > 3 ? '/…/' : '/';
  
  const truncated = `${first}${middle}${last}`;
  return truncated.length > 40 ? path.substring(0, 40) + '…' : truncated;
}

/**
 * Get minimal context for modern display
 */
export function getMinimalContext(toolName: string, args: any): string {
  if (!args || typeof args !== 'object') {
    return '';
  }

  const toolLower = toolName.toLowerCase();
  
  // Clean, minimal context - show only the most essential info
  if (toolLower.includes('read') && args.path) {
    return ` ${truncatePath(args.path)}`;
  } else if (toolLower.includes('write') && args.path) {
    return ` ${truncatePath(args.path)}\n${formatDiff(args.diff)}`;
  } else if (toolLower.includes('bash') && args.command) {
    const cmd = args.command.length > 40 ? args.command.substring(0, 40) + '…' : args.command;
    return ` "${cmd}"`;
  } else if ((toolLower.includes('glob') || toolLower.includes('grep')) && args.pattern) {
    const pattern = args.pattern.length > 30 ? args.pattern.substring(0, 30) + '…' : args.pattern;
    return ` "${pattern}"`;
  } else if (toolLower.includes('ls') && args.path) {
    return ` ${truncatePath(args.path)}`;
  }

  return '';
}

function formatDiff(diff: string): string {
  if (!diff) return '';

  return diff.split('\n')
      .map(line => {
        if (line.startsWith('+')) {
          return chalk.green(line);
        } else if (line.startsWith('-')) {
          return chalk.red(line);
        }
        return line;
      })
      .join('\n');
}

/**
 * Get minimal outcome for modern display
 */
export function getMinimalOutcome(toolName: string, success: boolean, result?: any, args?: any): string {
  const toolLower = toolName.toLowerCase();
  let errorMsg = 'Unknown error';

  if (!success) {
    if (toolLower.includes('bash')) {
      // For bash errors, result is a BashResult object
      if (result?.stderr) {
        errorMsg = `Command failed (exit ${result.exitCode || 'unknown'}): ${result.stderr}`;
      } else if (result?.error?.message) {
        errorMsg = result.error.message;
      } else if (result?.message) {
        errorMsg = result.message;
      } else if (result instanceof Error) {
        errorMsg = result.message;
      } else if (result?.exitCode !== 0) {
        errorMsg = `Command failed with exit code ${result.exitCode}`;
      }
    } else if (result instanceof Error) {
      errorMsg = result.message;
    } else if (typeof result === 'string' && result.trim()) {
      errorMsg = result;
    } else if (typeof result === 'object' && result !== null && result.message) {
      errorMsg = result.message;
    }
    
    return `\n${errorMsg}`;
  }

  if (toolLower.includes('write')) {
    if (typeof result === 'object' && result?.linesChanged) {
      return ` • ${result.linesChanged}L changed`;
    } else if (args?.content) {
      const lines = args.content.split('\n').length;
      return ` • ${lines}L written`;
    }
    return ` • saved`;
  } else if (toolLower.includes('read')) {
    if (typeof result === 'object' && result?.lineCount) {
      return ` • ${result.lineCount}L read`;
    } else if (typeof result === 'string') {
      const lines = result.split('\n').length;
      return ` • ${lines}L read`;
    }
    return ` • loaded`;
  } else if (toolLower.includes('bash')) {
    if (typeof result === 'object' && result?.exitCode !== undefined) {
      const time = result.executionTime ? ` ${result.executionTime}ms` : '';
      return result.exitCode === 0 ? ` • ok${time}` : ` • exit ${result.exitCode}${time}`;
    }
    return ` • executed`;
  } else if (toolLower.includes('glob') || toolLower.includes('ls')) {
    if (typeof result === 'object' && result?.matches) {
      const files = result.matches.filter((item: any) => item.type === 'file').length;
      const dirs = result.matches.filter((item: any) => item.type === 'directory').length;
      return ` • ${files}F ${dirs}D`;
    } else if (Array.isArray(result)) {
      const files = result.filter(item => !item.endsWith('/')).length;
      const dirs = result.length - files;
      return ` • ${files}F ${dirs}D`;
    }
    return ` • listed`;
  } else if (toolLower.includes('grep')) {
    if (typeof result === 'object' && result?.matches) {
      const matches = result.matches.length;
      const files = new Set(result.matches.map((match: any) => match.file)).size;
      return ` • ${matches} matches in ${files} files`;
    } else if (typeof result === 'string') {
      const lines = result.trim() ? result.split('\n').filter(line => line.trim()).length : 0;
      return ` • ${lines} matches`;
    }
    return ` • searched`;
  }

  return ` • completed`;
}