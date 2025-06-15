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
  
  // Show full context with all arguments (except file content which is too long)
  if (toolLower.includes('read') && (args.path || args.file_path)) {
    const path = args.path || args.file_path;
    let params = [];
    if (args.offset) params.push(`offset: ${args.offset}`);
    if (args.limit) params.push(`limit: ${args.limit}`);
    const paramStr = params.length > 0 ? ` (${params.join(', ')})` : '';
    return ` ${path}${paramStr}`;
  } else if (toolLower.includes('write') && args.path) {
    const mode = args.search ? 'search-replace' : args.diff ? 'diff' : 'content';
    if (mode === 'search-replace') {
      const regexFlag = args.regex ? ' (regex)' : '';
      return ` ${args.path} • "${args.search}" → "${args.replace}"${regexFlag}`;
    } else if (mode === 'diff') {
      return ` ${args.path}\n${formatDiff(args.diff)}`;
    } else {
      return ` ${args.path}`;
    }
  } else if (toolLower.includes('bash') && args.command) {
    let params = [];
    if (args.timeout) params.push(`timeout: ${args.timeout}ms`);
    if (args.description) params.push(`desc: "${args.description}"`);
    const paramStr = params.length > 0 ? ` (${params.join(', ')})` : '';
    return ` "${args.command}"${paramStr}`;
  } else if (toolLower.includes('glob') && args.pattern) {
    let params = [];
    if (args.path) params.push(`path: ${args.path}`);
    const paramStr = params.length > 0 ? ` (${params.join(', ')})` : '';
    return ` "${args.pattern}"${paramStr}`;
  } else if (toolLower.includes('grep') && args.pattern) {
    let params = [];
    if (args.path) params.push(`path: ${args.path}`);
    if (args.include) params.push(`include: ${args.include}`);
    const paramStr = params.length > 0 ? ` (${params.join(', ')})` : '';
    return ` "${args.pattern}"${paramStr}`;
  } else if (toolLower.includes('ls') && args.path) {
    let params = [];
    if (args.ignore && args.ignore.length > 0) params.push(`ignore: [${args.ignore.join(', ')}]`);
    const paramStr = params.length > 0 ? ` (${params.join(', ')})` : '';
    return ` ${args.path}${paramStr}`;
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
    if (typeof result === 'object' && result !== null) {
      const mode = result.mode || 'unknown';
      if (mode === 'search-replace') {
        const replacements = result.replacements || 0;
        const linesChanged = result.linesChanged || 0;
        return ` • ${replacements} replacements, ${linesChanged}L changed`;
      } else if (result.linesChanged) {
        return ` • ${result.linesChanged}L changed`;
      }
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
      if (result.exitCode === 0) {
        // For successful commands, show stdout if available and not too long
        let output = '';
        if (result.stdout && result.stdout.length < 500) {
          output = `\n${result.stdout}`;
        } else if (result.stdout && result.stdout.length >= 500) {
          output = `\n${result.stdout.substring(0, 500)}...`;
        }
        return ` • ok${time}${output}`;
      } else {
        let stderr = result.stderr || '';
        if (stderr.length > 500) {
          stderr = stderr.substring(0, 500) + '...';
        }
        return ` • exit ${result.exitCode}${time}\n${stderr}`;
      }
    }
    return ` • executed`;
  } else if (toolLower.includes('glob') || toolLower.includes('ls')) {
    if (typeof result === 'object' && result?.matches) {
      const files = result.matches.filter((item: any) => item.type === 'file').length;
      const dirs = result.matches.filter((item: any) => item.type === 'directory').length;
      return ` • ${files} files, ${dirs} directories`;
    } else if (Array.isArray(result)) {
      const files = result.filter(item => !item.endsWith('/')).length;
      const dirs = result.length - files;
      return ` • ${files} files, ${dirs} directories`;
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