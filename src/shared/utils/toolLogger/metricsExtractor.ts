/**
 * Tool result metrics extraction for logging and display
 */

/**
 * Extract meaningful metrics from tool results
 */
export function getResultMetrics(toolName: string, result: any, args?: any): string | null {
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
      
      if (mode === 'search-replace') {
        const replacements = result.replacements || 0;
        return `✏️ File ${created}: ${replacements} replacements, ${linesChanged} lines changed (${mode})`;
      } else {
        return `✏️ File ${created}: ${linesChanged} lines changed (${mode})`;
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
      // Handle GlobResult format specifically
      if (toolName.toLowerCase().includes('glob')) {
        const files = result.matches.filter((item: any) => item.type === 'file').length;
        const dirs = result.matches.filter((item: any) => item.type === 'directory').length;
        return `🔍 Found: ${files} files, ${dirs} directories`;
      }
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