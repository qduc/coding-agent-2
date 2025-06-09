
import chalk from 'chalk';
import { BoxRenderer } from './boxRenderer';
import { CodeHighlighter } from './codeHighlighter';

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
    
    // Store code blocks in placeholders to protect them from markdown processing
    const codeBlocks: string[] = [];
    
    // Extract and process code blocks, storing them separately
    output = output.replace(/```(\w+)?\n?([\s\S]*?)```/g, (match, language, code) => {
      const lang = language || 'text';
      const highlightedCode = this.highlightCode(code.trim(), lang);
      const renderedCodeBlock = BoxRenderer.createCodeBox(lang, highlightedCode, {
        showLineNumbers: true,
        maxWidth: 70
      });
      codeBlocks.push(renderedCodeBlock);
      return `§§§CODEBLOCK${codeBlocks.length - 1}§§§`;
    });

    // Store inline code in placeholders to protect them from markdown processing
    const inlineCodes: string[] = [];
    
    output = output.replace(/`(.*?)`/g, (match, code) => {
      const renderedInlineCode = chalk.bgGray.black(' ' + code + ' ');
      inlineCodes.push(renderedInlineCode);
      return `§§§INLINECODE${inlineCodes.length - 1}§§§`;
    });

    // Now apply all other markdown formatting (code is protected)
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

    // Restore inline code blocks
    output = output.replace(/§§§INLINECODE(\d+)§§§/g, (match, index) => {
      return inlineCodes[parseInt(index)];
    });

    // Restore code blocks last
    output = output.replace(/§§§CODEBLOCK(\d+)§§§/g, (match, index) => {
      return codeBlocks[parseInt(index)];
    });

    return output;
  }


  /**
   * Highlight code with syntax highlighting
   * 
   * @param code The code to highlight
   * @param language Optional language identifier for language-specific highlighting
   * @returns Highlighted code string
   */
  static highlightCode(code: string, language?: string): string {
    // Use CodeHighlighter for all languages
    return CodeHighlighter.highlight(code, language);
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
