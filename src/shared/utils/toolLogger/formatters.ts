/**
 * Tool-specific formatters for display and logging
 */

/**
 * Format arguments for human-readable display
 */
export function formatArgsForDisplay(toolName: string, args: any): string {
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

  return parts.length > 0 ? parts.join(', ') : JSON.stringify(filterLongParams(args));
}

/**
 * Filter out long parameters that shouldn't be displayed in console
 */
export function filterLongParams(args: any): any {
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
      filtered[key] = filterLongParams(value);
    }
  }

  return filtered;
}