import chalk from 'chalk';

/**
 * Markdown Renderer - Utility for rendering markdown content in the terminal
 *
 * Provides methods to convert markdown to terminal-friendly formatted output
 * using chalk for styling and ANSI escape codes.
 */
export class MarkdownRenderer {
  /**
   * Simple markdown to terminal renderer
   * Converts basic markdown to styled terminal output
   */
  static render(markdownText: string): string {
    let output = markdownText;

    // Code blocks MUST be processed before inline code
    output = output.replace(/```[\s\S]*?```/g, (match) => {
      const lines = match.split('\n');
      const language = lines[0].replace('```', '').trim();
      const code = lines.slice(1, -1).join('\n');
      const langDisplay = language || 'code';

      // Enhanced code block with rounded corners and line numbers
      const codeLines = code.split('\n');
      const maxLineNumWidth = codeLines.length.toString().length;
      const borderLength = Math.min(60, process.stdout.columns - 10 || 60);

      // Create header with language and copy indicator
      const headerText = `${langDisplay}`;
      const copyIndicator = '📋';
      const headerPadding = Math.max(0, borderLength - headerText.length - copyIndicator.length - 6);
      const topBorder = '╭─ ' + chalk.cyan(headerText) + ' ' + '─'.repeat(headerPadding) + ' ' + chalk.gray(copyIndicator) + ' ╮';

      // Format code lines with line numbers
      const formattedLines = codeLines.map((line, index) => {
        const lineNum = (index + 1).toString().padStart(maxLineNumWidth, ' ');
        const lineNumFormatted = chalk.gray.dim(lineNum + ' │ ');
        return chalk.gray('│ ') + lineNumFormatted + line;
      }).join('\n');

      const bottomBorder = '╰' + '─'.repeat(borderLength + 1) + '╯';

      return '\n' + chalk.gray(topBorder) + '\n' +
             formattedLines + '\n' +
             chalk.gray(bottomBorder) + '\n';
    });

    // Headers with enhanced visual hierarchy
    output = output.replace(/^### (.*$)/gm, '\n' + chalk.yellow.bold('▸ $1') + '\n');
    output = output.replace(/^## (.*$)/gm, '\n' + chalk.cyan.bold('▸▸ $1') + '\n');
    output = output.replace(/^# (.*$)/gm, '\n' + chalk.blue.bold('▸▸▸ $1') + '\n');

    // Bold text
    output = output.replace(/\*\*(.*?)\*\*/g, chalk.bold('$1'));
    output = output.replace(/__(.*?)__/g, chalk.bold('$1'));

    // Italic text (ignore unmatched or bold markers)
    output = output.replace(/(?<!\*)\*(?!\*)(.*?)\*(?!\*)/g, chalk.italic('$1'));
    output = output.replace(/(?<!_)_(?!_)(.*?)_(?!_)/g, chalk.italic('$1'));

    // Enhanced inline code with better contrast
    output = output.replace(/`(.*?)`/g, chalk.bgGray.black(' $1 '));

    // Links with better formatting
    output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, chalk.blue.underline('$1') + chalk.gray.dim(' ↗ $2'));

    // Enhanced unordered lists with better indentation
    output = output.replace(/^[\s]*[-*+] (.*)$/gm, '  ' + chalk.green('●') + '  $1');
    // Enhanced ordered lists with better formatting
    output = output.replace(/^[\s]*(\d+)\. (.*)$/gm, '  ' + chalk.green('$1.') + '  $2');

    // Enhanced blockquotes with left border
    output = output.replace(/^> (.*)$/gm, chalk.blue('┃ ') + chalk.italic.gray('$1'));

    // Enhanced horizontal rules
    output = output.replace(/^---$/gm, '\n' + chalk.gray('─'.repeat(Math.min(56, process.stdout.columns - 4 || 56))) + '\n');

    return output;
  }

  /**
   * Render markdown with enhanced code syntax highlighting
   */
  static renderWithCodeHighlight(markdownText: string): string {
    // Enhanced code block handling with basic syntax highlighting and line numbers
    let output = markdownText.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, language, code) => {
      const lang = language || 'text';
      const highlightedCode = this.highlightCode(code.trim(), lang);

      // Enhanced code block with rounded corners and line numbers
      const codeLines = highlightedCode.split('\n');
      const maxLineNumWidth = codeLines.length.toString().length;
      const borderLength = Math.min(60, process.stdout.columns - 10 || 60);

      // Create header with language and copy indicator
      const headerText = `${lang}`;
      const copyIndicator = '📋';
      const headerPadding = Math.max(0, borderLength - headerText.length - copyIndicator.length - 6);
      const topBorder = '╭─ ' + chalk.cyan(headerText) + ' ' + '─'.repeat(headerPadding) + ' ' + chalk.gray(copyIndicator) + ' ╮';

      // Format code lines with line numbers
      const formattedLines = codeLines.map((line, index) => {
        const lineNum = (index + 1).toString().padStart(maxLineNumWidth, ' ');
        const lineNumFormatted = chalk.gray.dim(lineNum + ' │ ');
        return chalk.gray('│ ') + lineNumFormatted + line;
      }).join('\n');

      const bottomBorder = '╰' + '─'.repeat(borderLength + 1) + '╯';

      return '\n' + chalk.gray(topBorder) + '\n' +
             formattedLines + '\n' +
             chalk.gray(bottomBorder) + '\n';
    });

    return this.render(output);
  }

  /**
   * Basic syntax highlighting for common languages
   */
  private static highlightCode(code: string, language: string): string {
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'js':
      case 'typescript':
      case 'ts':
        return this.highlightJavaScript(code);
      case 'json':
        return this.highlightJSON(code);
      case 'bash':
      case 'shell':
        return this.highlightBash(code);
      default:
        return code;
    }
  }

  /**
   * Highlight JavaScript/TypeScript code
   */
  private static highlightJavaScript(code: string): string {
    let highlighted = code;

    // Keywords
    const keywords = ['const', 'let', 'var', 'function', 'class', 'if', 'else', 'for', 'while', 'return', 'import', 'export', 'from', 'async', 'await'];
    keywords.forEach(keyword => {
      highlighted = highlighted.replace(
        new RegExp(`\\b${keyword}\\b`, 'g'),
        chalk.magenta(keyword)
      );
    });

    // Strings
    highlighted = highlighted.replace(/(['"`])((?:(?!\1)[^\\]|\\.)*)(\1)/g, chalk.green('$1$2$3'));

    // Comments
    highlighted = highlighted.replace(/\/\/.*$/gm, chalk.gray('$&'));
    highlighted = highlighted.replace(/\/\*[\s\S]*?\*\//g, chalk.gray('$&'));

    // Numbers
    highlighted = highlighted.replace(/\b\d+\.?\d*\b/g, chalk.yellow('$&'));
    // Booleans and null
    highlighted = highlighted.replace(/\b(true|false|null)\b/g, chalk.yellow('$1'));

    return highlighted;
  }

  /**
   * Highlight JSON code
   */
  private static highlightJSON(code: string): string {
    let highlighted = code;

    // Strings (keys and values)
    highlighted = highlighted.replace(/"([^"]+)":/g, chalk.cyan('"$1"') + ':');
    highlighted = highlighted.replace(/:\s*"([^"]+)"/g, ': ' + chalk.green('"$1"'));

    // Numbers
    highlighted = highlighted.replace(/:\s*(\d+\.?\d*)/g, ': ' + chalk.yellow('$1'));

    // Booleans and null
    highlighted = highlighted.replace(/:\s*(true|false|null)/g, ': ' + chalk.magenta('$1'));

    return highlighted;
  }

  /**
   * Highlight Bash/Shell code
   */
  private static highlightBash(code: string): string {
    let highlighted = code;

    // Commands
    highlighted = highlighted.replace(/^(\w+)/gm, chalk.cyan('$1'));

    // Flags
    highlighted = highlighted.replace(/\s(-{1,2}\w+)/g, ' ' + chalk.yellow('$1'));

    // Comments
    highlighted = highlighted.replace(/#.*$/gm, chalk.gray('$&'));

    // Strings
    highlighted = highlighted.replace(/(['"`])((?:(?!\1)[^\\]|\\.)*)(\1)/g, chalk.green('$1$2$3'));

    return highlighted;
  }

  /**
   * Render a simple table from markdown table syntax
   */
  static renderTable(tableMarkdown: string): string {
    const lines = tableMarkdown.trim().split('\n');
    if (lines.length < 2) return tableMarkdown;

    const headers = lines[0].split('|').slice(1, -1).map(h => h.trim());
    const separator = lines[1];
    const rows = lines.slice(2).map(line =>
      line.split('|').slice(1, -1).map(cell => cell.trim())
    );

    // Calculate column widths
    const colWidths = headers.map((header, i) => {
      const maxRowWidth = Math.max(...rows.map(row => (row[i] || '').length));
      return Math.max(header.length, maxRowWidth);
    });

    // Render table
    let output = '';

    // Header
    output += chalk.cyan(headers.map((header, i) =>
      header.padEnd(colWidths[i])
    ).join(' │ ')) + '\n';

    // Separator
    const sepGroups = headers.map((_, i) => i === 0 ? colWidths[i] : colWidths[i] + 2);
    output += chalk.gray(sepGroups.map(len => '─'.repeat(len)).join('┼')) + '\n';

    // Rows
    rows.forEach(row => {
      output += headers.map((_, i) => {
        const cell = row[i] || '';
        if (!cell) return ''.padEnd(colWidths[i]);
        return i === 0 ? cell : cell.padEnd(colWidths[i]);
      }).join(' │ ') + '\n';
    });

    return output;
  }
}
