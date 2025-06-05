import chalk from 'chalk';

/**
 * Box Renderer Utility - Creates properly aligned terminal boxes
 */
export class BoxRenderer {
  /**
   * Calculate display width of text (handles Unicode/emojis)
   */
  private static getDisplayWidth(text: string): number {
    // Remove ANSI escape codes for width calculation
    const cleanText = text.replace(/\u001b\[[0-9;]*m/g, '');
    let width = 0;
    for (const char of cleanText) {
      const code = char.codePointAt(0);
      // Basic emoji/double-width detection (not perfect, but covers most cases)
      if (code && (
        (code >= 0x1F300 && code <= 0x1FAFF) || // Emoji range
        (code >= 0x1100 && code <= 0x115F) || // Hangul Jamo init. consonants
        (code >= 0x2E80 && code <= 0xA4CF) || // CJK ... Yi
        (code >= 0xAC00 && code <= 0xD7A3) || // Hangul Syllables
        (code >= 0xF900 && code <= 0xFAFF) || // CJK Compatibility Ideographs
        (code >= 0xFE10 && code <= 0xFE19) || // Vertical forms
        (code >= 0xFE30 && code <= 0xFE6F) || // CJK Compatibility Forms
        (code >= 0xFF00 && code <= 0xFF60) || // Fullwidth Forms
        (code >= 0xFFE0 && code <= 0xFFE6)
      )) {
        width += 2;
      } else {
        width += 1;
      }
    }
    return width;
  }

  /**
   * Create a code block box with proper alignment
   */
  static createCodeBox(
    language: string,
    code: string,
    options: {
      showLineNumbers?: boolean;
      maxWidth?: number;
    } = {}
  ): string {
    const { showLineNumbers = true, maxWidth } = options;
    const terminalWidth = process.stdout.columns || 80;
    const boxWidth = Math.min(maxWidth || 70, terminalWidth - 4);
    const codeLines = code.split('\n');
    const maxLineNumWidth = showLineNumbers ? codeLines.length.toString().length : 0;

    // Header content
    const langText = language || 'code';
    const copyIndicator = '📋';
    const headerContentWidth = this.getDisplayWidth(langText) + this.getDisplayWidth(copyIndicator) + 1;

    // Calculate actual content width (accounting for line numbers and padding)
    const lineNumberWidth = showLineNumbers ? maxLineNumWidth + 3 : 0; // "nn │ "
    const contentWidth = boxWidth - 4 - lineNumberWidth; // 4 = "│ " + " │"

    // Header with proper padding
    const headerPadding = Math.max(0, boxWidth - headerContentWidth - 6); // 6 = "╭─ " + " ╮"
    const topBorder = '╭─ ' + chalk.cyan(langText) + ' ' + '─'.repeat(headerPadding) + ' ' + chalk.gray(copyIndicator) + ' ╮';

    // Format code lines with wrapping for long lines
    const processedLines: string[] = [];
    codeLines.forEach((line, sourceLineIndex) => {
      if (line.length <= contentWidth) {
        // Short line - display normally
        const lineContent = line.padEnd(contentWidth);
        let formattedLine;
        if (showLineNumbers) {
          const lineNum = (sourceLineIndex + 1).toString().padStart(maxLineNumWidth, ' ');
          const lineNumFormatted = chalk.gray.dim(lineNum + ' │ ');
          formattedLine = chalk.gray('│ ') + lineNumFormatted + lineContent + chalk.gray(' │');
        } else {
          formattedLine = chalk.gray('│ ') + lineContent + chalk.gray(' │');
        }
        processedLines.push(formattedLine);
      } else {
        // Long line - wrap it
        let remaining = line;
        let isFirstChunk = true;
        while (remaining.length > 0) {
          const chunk = remaining.substring(0, contentWidth);
          const lineContent = chunk.padEnd(contentWidth);
          let formattedLine;
          if (showLineNumbers) {
            // Show line number only on first chunk, indent continuation lines
            const lineNumDisplay = isFirstChunk 
              ? (sourceLineIndex + 1).toString().padStart(maxLineNumWidth, ' ')
              : ' '.repeat(maxLineNumWidth);
            const lineNumFormatted = chalk.gray.dim(lineNumDisplay + ' │ ');
            formattedLine = chalk.gray('│ ') + lineNumFormatted + lineContent + chalk.gray(' │');
          } else {
            formattedLine = chalk.gray('│ ') + lineContent + chalk.gray(' │');
          }
          processedLines.push(formattedLine);
          remaining = remaining.substring(contentWidth);
          isFirstChunk = false;
        }
      }
    });

    const bottomBorder = '╰' + '─'.repeat(boxWidth - 1) + '╯';

    return '\n' + chalk.gray(topBorder) + '\n' +
           processedLines.join('\n') + '\n' +
           chalk.gray(bottomBorder) + '\n';
  }

  /**
   * Create a simple info box
   */
  static createInfoBox(title: string, content: string, options: { maxWidth?: number } = {}): string {
    const terminalWidth = process.stdout.columns || 80;
    const boxWidth = Math.min(options.maxWidth || 60, terminalWidth - 4);
    const titleWidth = this.getDisplayWidth(title);
    const headerPadding = Math.max(0, boxWidth - titleWidth - 4); // 4 = "┌ " + " ┐"
    const topBorder = '┌─' + title + '─'.repeat(headerPadding) + '┐';
    const contentLines = content.split('\n').flatMap(line => {
      if (line.length <= boxWidth - 4) {
        return ['│ ' + line.padEnd(boxWidth - 4) + ' │'];
      }
      // Wrap long lines instead of truncating
      const wrapped: string[] = [];
      let remaining = line;
      while (remaining.length > 0) {
        const chunk = remaining.substring(0, boxWidth - 4);
        wrapped.push('│ ' + chunk.padEnd(boxWidth - 4) + ' │');
        remaining = remaining.substring(boxWidth - 4);
      }
      return wrapped;
    });
    const bottomBorder = '└' + '─'.repeat(boxWidth - 2) + '┘';
    return '\n' + topBorder + '\n' +
           contentLines.join('\n') + '\n' +
           bottomBorder + '\n';
  }
}
