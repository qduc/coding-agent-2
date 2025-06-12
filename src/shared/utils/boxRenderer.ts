import chalk from 'chalk';

/**
 * Box Renderer Utility - Creates properly aligned terminal boxes
 */
export class BoxRenderer {
  // Constants
  private static readonly ANSI_REGEX = /\u001b\[[0-9;]*m/g;
  private static readonly DEFAULT_TERMINAL_WIDTH = 80;
  private static readonly DEFAULT_CODE_BOX_WIDTH = 70;
  private static readonly DEFAULT_INFO_BOX_WIDTH = 60;
  private static readonly MIN_INPUT_HEIGHT = 3;
  private static readonly BOX_PADDING = 4;
  private static readonly HEADER_PADDING = 6;
  
  // Width calculation cache
  private static readonly widthCache = new Map<string, number>();
  
  /**
   * Check if a Unicode code point represents a wide character
   */
  private static isWideCharacter(code: number): boolean {
    return (
      (code >= 0x1F300 && code <= 0x1FAFF) || // Emoji range
      (code >= 0x1100 && code <= 0x115F) || // Hangul Jamo init. consonants
      (code >= 0x2E80 && code <= 0xA4CF) || // CJK ... Yi
      (code >= 0xAC00 && code <= 0xD7A3) || // Hangul Syllables
      (code >= 0xF900 && code <= 0xFAFF) || // CJK Compatibility Ideographs
      (code >= 0xFE10 && code <= 0xFE19) || // Vertical forms
      (code >= 0xFE30 && code <= 0xFE6F) || // CJK Compatibility Forms
      (code >= 0xFF00 && code <= 0xFF60) || // Fullwidth Forms
      (code >= 0xFFE0 && code <= 0xFFE6)
    );
  }

  /**
   * Calculate display width of text (handles Unicode/emojis) with memoization
   */
  private static getDisplayWidth(text: string): number {
    if (this.widthCache.has(text)) {
      return this.widthCache.get(text)!;
    }

    // Remove ANSI escape codes for width calculation
    const cleanText = text.replace(this.ANSI_REGEX, '');
    let width = 0;
    for (const char of cleanText) {
      const code = char.codePointAt(0);
      if (code && this.isWideCharacter(code)) {
        width += 2;
      } else {
        width += 1;
      }
    }
    
    this.widthCache.set(text, width);
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
    const terminalWidth = process.stdout.columns || this.DEFAULT_TERMINAL_WIDTH;
    const boxWidth = Math.min(maxWidth || this.DEFAULT_CODE_BOX_WIDTH, terminalWidth - this.BOX_PADDING);
    const codeLines = code.split('\n');
    const maxLineNumWidth = showLineNumbers ? codeLines.length.toString().length : 0;

    // Create header
    const topBorder = this.createCodeBoxHeader(language, boxWidth);

    // Calculate content dimensions
    const lineNumberWidth = showLineNumbers ? maxLineNumWidth + 3 : 0; // "nn │ "
    const contentWidth = boxWidth - this.BOX_PADDING - lineNumberWidth;

    // Process all code lines
    const processedLines = this.processCodeLines(codeLines, contentWidth, maxLineNumWidth, showLineNumbers);

    // Create footer
    const bottomBorder = this.createBoxFooter(boxWidth, '╰', '╯');

    return this.assembleBox([topBorder, ...processedLines, bottomBorder]);
  }

  /**
   * Create header for code box
   */
  private static createCodeBoxHeader(language: string, boxWidth: number): string {
    const langText = language || 'code';
    const copyIndicator = '📋';
    const headerContentWidth = this.getDisplayWidth(langText) + this.getDisplayWidth(copyIndicator) + 1;
    const headerPadding = Math.max(0, boxWidth - headerContentWidth - this.HEADER_PADDING);
    
    return chalk.gray([
      '╭─ ',
      chalk.cyan(langText),
      ' ',
      '─'.repeat(headerPadding),
      ' ',
      chalk.gray(copyIndicator),
      ' ╮'
    ].join(''));
  }

  /**
   * Process code lines with wrapping and line numbers
   */
  private static processCodeLines(
    codeLines: string[], 
    contentWidth: number, 
    maxLineNumWidth: number, 
    showLineNumbers: boolean
  ): string[] {
    const processedLines: string[] = [];
    
    codeLines.forEach((line, sourceLineIndex) => {
      if (this.getDisplayWidth(line) <= contentWidth) {
        processedLines.push(this.formatCodeLine(line, contentWidth, sourceLineIndex, maxLineNumWidth, showLineNumbers));
      } else {
        const wrappedLines = this.wrapCodeLine(line, contentWidth, sourceLineIndex, maxLineNumWidth, showLineNumbers);
        processedLines.push(...wrappedLines);
      }
    });

    return processedLines;
  }

  /**
   * Format a single code line
   */
  private static formatCodeLine(
    line: string, 
    contentWidth: number, 
    sourceLineIndex: number, 
    maxLineNumWidth: number, 
    showLineNumbers: boolean,
    isFirstChunk: boolean = true
  ): string {
    const displayWidth = this.getDisplayWidth(line);
    const padding = Math.max(0, contentWidth - displayWidth);
    const lineContent = line + ' '.repeat(padding);
    
    if (showLineNumbers) {
      const lineNumDisplay = isFirstChunk 
        ? (sourceLineIndex + 1).toString().padStart(maxLineNumWidth, ' ')
        : ' '.repeat(maxLineNumWidth);
      const lineNumFormatted = chalk.gray.dim(lineNumDisplay + ' │ ');
      return chalk.gray('│ ') + lineNumFormatted + lineContent + chalk.gray(' │');
    } else {
      return chalk.gray('│ ') + lineContent + chalk.gray(' │');
    }
  }

  /**
   * Wrap a long code line
   */
  private static wrapCodeLine(
    line: string, 
    contentWidth: number, 
    sourceLineIndex: number, 
    maxLineNumWidth: number, 
    showLineNumbers: boolean
  ): string[] {
    const wrappedChunks = this.wrapTextWithCursor(line, contentWidth);
    const wrappedLines: string[] = [];
    
    wrappedChunks.forEach((chunk, chunkIndex) => {
      const isFirstChunk = chunkIndex === 0;
      wrappedLines.push(this.formatCodeLine(chunk, contentWidth, sourceLineIndex, maxLineNumWidth, showLineNumbers, isFirstChunk));
    });

    return wrappedLines;
  }

  /**
   * Create a simple info box
   */
  static createInfoBox(title: string, content: string, options: { maxWidth?: number } = {}): string {
    const terminalWidth = process.stdout.columns || this.DEFAULT_TERMINAL_WIDTH;
    const boxWidth = Math.min(options.maxWidth || this.DEFAULT_INFO_BOX_WIDTH, terminalWidth - this.BOX_PADDING);
    
    // Create header
    const topBorder = this.createInfoBoxHeader(title, boxWidth);
    
    // Process content
    const contentLines = this.processInfoBoxContent(content, boxWidth);
    
    // Create footer
    const bottomBorder = this.createBoxFooter(boxWidth, '└', '┘');
    
    return this.assembleBox([topBorder, ...contentLines, bottomBorder]);
  }

  /**
   * Create header for info box
   */
  private static createInfoBoxHeader(title: string, boxWidth: number): string {
    const titleWidth = this.getDisplayWidth(title);
    const headerPadding = Math.max(0, boxWidth - titleWidth - 2);
    return '┌─' + title + '─'.repeat(headerPadding) + '┐';
  }

  /**
   * Process content for info box
   */
  private static processInfoBoxContent(content: string, boxWidth: number): string[] {
    const maxContentWidth = boxWidth - this.BOX_PADDING;
    
    return content.split('\n').flatMap(line => {
      if (this.getDisplayWidth(line) <= maxContentWidth) {
        const displayWidth = this.getDisplayWidth(line);
        const padding = Math.max(0, maxContentWidth - displayWidth);
        return ['│ ' + line + ' '.repeat(padding) + ' │'];
      }
      
      // Wrap long lines
      const wrappedChunks = this.wrapTextWithCursor(line, maxContentWidth);
      return wrappedChunks.map(chunk => {
        const displayWidth = this.getDisplayWidth(chunk);
        const padding = Math.max(0, maxContentWidth - displayWidth);
        return '│ ' + chunk + ' '.repeat(padding) + ' │';
      });
    });
  }

  /**
   * Create an interactive input box for multi-line text input
   */
  static createInputBox(
    title: string, 
    content: string, 
    cursorPosition: number,
    options: { 
      maxWidth?: number;
      minHeight?: number;
      placeholder?: string;
      showCursor?: boolean;
    } = {}
  ): string {
    const terminalWidth = process.stdout.columns || this.DEFAULT_TERMINAL_WIDTH;
    const boxWidth = Math.min(options.maxWidth || this.DEFAULT_INFO_BOX_WIDTH, terminalWidth - this.BOX_PADDING);
    const minHeight = options.minHeight || this.MIN_INPUT_HEIGHT;
    const showCursor = options.showCursor !== false;
    
    // Create header
    const topBorder = this.createInputBoxHeader(title, boxWidth);
    
    // Process content with cursor
    const contentWithCursor = showCursor ? this.insertCursor(content, cursorPosition) : content;
    const contentLines = this.processInputBoxContent(contentWithCursor, boxWidth, minHeight, options.placeholder);
    
    // Create footer
    const bottomBorder = chalk.cyan(this.createBoxFooter(boxWidth, '└', '┘'));
    
    return [topBorder, ...contentLines, bottomBorder].join('\n');
  }

  /**
   * Create header for input box
   */
  private static createInputBoxHeader(title: string, boxWidth: number): string {
    const titleWidth = this.getDisplayWidth(title);
    const headerPadding = Math.max(0, boxWidth - titleWidth - 4);
    return chalk.cyan('┌─' + title + '─'.repeat(headerPadding) + '┐');
  }

  /**
   * Process content for input box
   */
  private static processInputBoxContent(
    contentWithCursor: string, 
    boxWidth: number, 
    minHeight: number, 
    placeholder?: string
  ): string[] {
    const contentLines: string[] = [];
    const contentWidth = boxWidth - 2; // Account for "│" and "│"
    
    // Use ANSI-aware wrapping for text with cursor
    const wrappedLines = this.wrapTextWithCursor(contentWithCursor, contentWidth);
    
    wrappedLines.forEach(line => {
      const displayWidth = this.getDisplayWidth(line);
      const padding = Math.max(0, contentWidth - displayWidth);
      const paddedLine = line + ' '.repeat(padding);
      contentLines.push(chalk.gray('│') + paddedLine + chalk.gray('│'));
    });
    
    // Add placeholder text if content is empty
    if (contentLines.length === 0 && placeholder) {
      const placeholderText = chalk.gray.dim(placeholder);
      contentLines.push(chalk.gray('│') + placeholderText.padEnd(contentWidth) + chalk.gray('│'));
    }
    
    // Ensure minimum height
    while (contentLines.length < minHeight) {
      contentLines.push(chalk.gray('│') + ''.padEnd(contentWidth) + chalk.gray('│'));
    }
    
    return contentLines;
  }

  /**
   * Create box footer with specified corner characters
   */
  private static createBoxFooter(boxWidth: number, leftCorner: string, rightCorner: string): string {
    return leftCorner + '─'.repeat(boxWidth - 2) + rightCorner;
  }

  /**
   * Assemble box parts with proper line breaks
   */
  private static assembleBox(parts: string[]): string {
    return '\n' + parts.join('\n') + '\n';
  }

  /**
   * Insert cursor character at the specified position in text
   */
  private static insertCursor(text: string, position: number): string {
    const cursor = chalk.bgWhite(' ');
    if (position >= text.length) {
      return text + cursor;
    }
    return text.substring(0, position) + cursor + text.substring(position);
  }

  /**
   * Wrap text considering ANSI escape codes and cursor position
   */
  private static wrapTextWithCursor(text: string, maxWidth: number): string[] {
    const lines = text.split('\n');
    const wrappedLines: string[] = [];
    
    lines.forEach(line => {
      if (this.getDisplayWidth(line) <= maxWidth) {
        wrappedLines.push(line);
      } else {
        wrappedLines.push(...this.splitLongLine(line, maxWidth));
      }
    });
    
    return wrappedLines;
  }

  /**
   * Split a long line while preserving ANSI codes and wide characters
   */
  private static splitLongLine(line: string, maxWidth: number): string[] {
    const chunks: string[] = [];
    let remaining = line;
    
    while (remaining.length > 0) {
      const chunk = this.extractChunk(remaining, maxWidth);
      chunks.push(chunk.text);
      remaining = remaining.substring(chunk.length);
    }
    
    return chunks;
  }

  /**
   * Extract a chunk of text that fits within maxWidth
   */
  private static extractChunk(text: string, maxWidth: number): { text: string; length: number } {
    let chunkEnd = 0;
    let displayWidth = 0;
    
    while (chunkEnd < text.length && displayWidth < maxWidth) {
      const char = text[chunkEnd];
      
      // Handle ANSI escape sequences
      if (char === '\u001b' && text[chunkEnd + 1] === '[') {
        const ansiLength = this.skipAnsiSequence(text, chunkEnd);
        chunkEnd += ansiLength;
        continue;
      }
      
      // Calculate character display width
      const code = char.codePointAt(0);
      const charWidth = code && this.isWideCharacter(code) ? 2 : 1;
      
      if (displayWidth + charWidth > maxWidth) {
        break;
      }
      
      displayWidth += charWidth;
      chunkEnd++;
    }
    
    // Ensure we take at least one character if nothing fits
    if (chunkEnd === 0) {
      chunkEnd = 1;
    }
    
    return {
      text: text.substring(0, chunkEnd),
      length: chunkEnd
    };
  }

  /**
   * Skip over an ANSI escape sequence and return its length
   */
  private static skipAnsiSequence(text: string, startIndex: number): number {
    let index = startIndex + 2; // Skip '\u001b['
    while (index < text.length && !/[a-zA-Z]/.test(text[index])) {
      index++;
    }
    return index - startIndex + 1; // Include the final character
  }
}
