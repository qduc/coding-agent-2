/**
 * Terminal Output Utilities
 * 
 * Handles terminal-specific output operations like line counting with wrapping
 * and cursor positioning for complex streaming scenarios.
 */

export interface TerminalLineCalculationOptions {
  terminalWidth: number;
  prefix?: string;
}

/**
 * Calculate the actual number of terminal lines used by content,
 * accounting for line wrapping and optional prefix on the first line.
 */
export function calculateTerminalLines(
  content: string,
  options: TerminalLineCalculationOptions
): number {
  const { terminalWidth, prefix = '' } = options;
  
  if (!content) {
    return prefix ? 1 : 0;
  }

  let totalTerminalLines = 0;
  const contentLines = content.split('\n');
  
  contentLines.forEach((line, index) => {
    const lineWithPrefix = index === 0 ? prefix + line : line;
    const lineLength = lineWithPrefix.length;
    
    // Calculate how many terminal lines this logical line spans
    // Handle empty lines (they still take up 1 terminal line)
    const wrappedLines = lineLength === 0 ? 1 : Math.ceil(lineLength / terminalWidth);
    totalTerminalLines += wrappedLines;
  });

  return totalTerminalLines;
}

/**
 * Generate terminal escape sequences to clear a specific number of lines
 * moving upward from the current cursor position.
 */
export function generateClearSequence(linesToClear: number): string {
  if (linesToClear <= 0) {
    return '';
  }

  let sequence = '';
  
  for (let i = 0; i < linesToClear; i++) {
    if (i === 0) {
      // First iteration: move to start of current line and clear it
      sequence += '\r\x1b[2K';
    } else {
      // Subsequent iterations: move up and clear previous lines
      sequence += '\x1b[1A\x1b[2K';
    }
  }
  
  return sequence;
}

/**
 * Calculate and generate the clearing sequence for streamed content
 * with a given prefix (like "🤖 Agent: ").
 */
export function calculateStreamingClearSequence(
  streamedContent: string,
  terminalWidth: number,
  prefix: string = ''
): string {
  const linesToClear = calculateTerminalLines(streamedContent, {
    terminalWidth,
    prefix
  });
  
  return generateClearSequence(linesToClear);
}