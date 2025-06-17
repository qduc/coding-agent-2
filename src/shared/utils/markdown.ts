
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
    // Headers with corrected visual hierarchy (h1=1 arrow, h3=3 arrows)
    output = output.replace(/^# (.*$)/gm, '\n' + chalk.blue.bold('▸ $1') + '\n');
    output = output.replace(/^## (.*$)/gm, '\n' + chalk.cyan.bold('▸▸ $1') + '\n');
    output = output.replace(/^### (.*$)/gm, '\n' + chalk.yellow.bold('▸▸▸ $1') + '\n');

    // Bold + Italic (must come first to avoid conflicts)
    output = output.replace(/\*\*\*(.*?)\*\*\*/g, (match, text) => {
      return chalk.bold(chalk.underline(text));
    });
    output = output.replace(/__(.*?)__/g, (match, text) => {
      return chalk.bold(chalk.underline(text));
    });
    
    // Bold text
    output = output.replace(/\*\*(.*?)\*\*/g, (match, text) => {
      return chalk.bold(text);
    });
    output = output.replace(/__(.*?)__/g, (match, text) => {
      return chalk.bold(text);
    });

    // Italic text (ignore unmatched or bold markers)
    output = output.replace(/(?<!\*)\*(?!\*)(.*?)\*(?!\*)/g, (match, text) => {
      return chalk.italic(text);
    });
    output = output.replace(/(?<!_)_(?!_)(.*?)_(?!_)/g, (match, text) => {
      return chalk.italic(text);
    });

    // Links with better terminal compatibility
    output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, chalk.blue.underline('$1') + chalk.gray.dim(' -> $2'));

    // Enhanced nested lists with hierarchical indentation
    output = output.replace(/^([ \t]*)([-*+]) (.*)$/gm, (match, indent, marker, content) => {
      const depth = indent.length;
      const indentSpaces = '  '.repeat(Math.floor(depth / 2) + 1);
      const listMarkers = ['•', '◦', '▪'];
      const markerIndex = Math.min(Math.floor(depth / 2), listMarkers.length - 1);
      return indentSpaces + chalk.cyan(listMarkers[markerIndex]) + ' ' + content;
    });
    
    // Enhanced nested ordered lists with hierarchical indentation
    output = output.replace(/^([ \t]*)(\d+)\. (.*)$/gm, (match, indent, number, content) => {
      const depth = indent.length;
      const indentSpaces = '  '.repeat(Math.floor(depth / 2) + 1);
      const listStyles = [
        (text: string) => chalk.cyan(text),
        (text: string) => chalk.yellow(text), 
        (text: string) => chalk.green(text)
      ];
      const styleIndex = Math.min(Math.floor(depth / 2), listStyles.length - 1);
      return indentSpaces + listStyles[styleIndex](number + '.') + ' ' + content;
    });

    // Enhanced blockquotes with consistent styling
    output = output.replace(/^> (.*)$/gm, chalk.blue('│ ') + chalk.italic.gray('$1'));

    // Enhanced horizontal rules with consistent width
    output = output.replace(/^---$/gm, '\n' + chalk.gray('─'.repeat(Math.min(60, process.stdout.columns - 4 || 60))) + '\n');

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

    // Separator with simplified logic
    output += chalk.gray(colWidths.map(width => '─'.repeat(width)).join('─┼─')) + '\n';

    // Rows with consistent formatting
    rows.forEach(row => {
      output += headers.map((_, i) => {
        const cell = row[i] || '';
        return cell.padEnd(colWidths[i]);
      }).join(' │ ') + '\n';
    });

    return output;
  }
}
