
import chalk from 'chalk';
import { BoxRenderer } from './boxRenderer';

// Prism.js loading with async initialization
let Prism: any = null;
let prismInitialized = false;

// Load Prism.js asynchronously on first use
async function initializePrism() {
  if (!prismInitialized) {
    try {
      const prismModule = await import('prismjs');
      Prism = prismModule.default || prismModule;
      
      // Load language components
      await import('prismjs/components/prism-typescript.js');
      await import('prismjs/components/prism-javascript.js');  
      await import('prismjs/components/prism-json.js');
      await import('prismjs/components/prism-bash.js');
    } catch (error) {
      // Silently fail if Prism components can't be loaded
    }
    prismInitialized = true;
  }
}

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
    // First, extract and protect code blocks from markdown processing
    const codeBlocks: string[] = [];
    const codeBlockPlaceholders: string[] = [];

    let output = markdownText.replace(/```[\s\S]*?```/g, (match, index) => {
      const lines = match.split('\n');
      const language = lines[0].replace('```', '').trim();
      const code = lines.slice(1, -1).join('\n');
      const renderedCodeBlock = BoxRenderer.createCodeBox(language, code, {
        showLineNumbers: true,
        maxWidth: 70
      });

      const placeholder = `__CODE_BLOCK_${index}__`;
      codeBlocks.push(renderedCodeBlock);
      codeBlockPlaceholders.push(placeholder);
      return placeholder;
    });

    // Also protect inline code from markdown processing
    const inlineCodeBlocks: string[] = [];
    const inlineCodePlaceholders: string[] = [];

    output = output.replace(/`(.*?)`/g, (match, code, index) => {
      const renderedInlineCode = chalk.bgGray.black(' ' + code + ' ');
      const placeholder = `__INLINE_CODE_${index}__`;
      inlineCodeBlocks.push(renderedInlineCode);
      inlineCodePlaceholders.push(placeholder);
      return placeholder;
    });

    // Now apply markdown formatting to the rest of the content
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

    // Finally, restore the protected code blocks
    codeBlockPlaceholders.forEach((placeholder, index) => {
      output = output.replace(placeholder, codeBlocks[index]);
    });

    // Restore inline code blocks
    inlineCodePlaceholders.forEach((placeholder, index) => {
      output = output.replace(placeholder, inlineCodeBlocks[index]);
    });

    return output;
  }

  /**
   * Render markdown with enhanced code syntax highlighting (synchronous version)
   */
  static renderWithCodeHighlight(markdownText: string): string {
    return this.renderWithCodeHighlightInternal(markdownText);
  }

  /**
   * Render markdown with enhanced code syntax highlighting (async version)
   */
  static async renderWithCodeHighlightAsync(markdownText: string): Promise<string> {
    // Load Prism.js asynchronously if not already loaded
    if (!prismInitialized) {
      await initializePrism();
    }
    return this.renderWithCodeHighlightInternal(markdownText);
  }

  /**
   * Internal implementation for code highlighting
   */
  private static renderWithCodeHighlightInternal(markdownText: string): string {
    // First, extract and protect code blocks with syntax highlighting
    const codeBlocks: string[] = [];
    const codeBlockPlaceholders: string[] = [];

    let blockIndex = 0;
    let output = markdownText.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, language, code) => {
      const lang = language || 'text';
      const highlightedCode = this.highlightCode(code.trim(), lang);
      const renderedCodeBlock = BoxRenderer.createCodeBox(lang, highlightedCode, {
        showLineNumbers: true,
        maxWidth: 70
      });

      const placeholder = `__CODE_BLOCK_${blockIndex}__`;
      codeBlocks.push(renderedCodeBlock);
      codeBlockPlaceholders.push(placeholder);
      blockIndex++;
      return placeholder;
    });

    // Also protect inline code from markdown processing  
    const inlineCodeBlocks: string[] = [];
    const inlineCodePlaceholders: string[] = [];

    let inlineIndex = 0;
    output = output.replace(/`(.*?)`/g, (match, code) => {
      // Apply syntax highlighting to inline code using Prism.js
      const highlightedCode = this.highlightCode(code, 'javascript');
      const renderedInlineCode = chalk.bgGray.black(' ' + highlightedCode + ' ');
      const placeholder = `__INLINE_CODE_${inlineIndex}__`;
      inlineCodeBlocks.push(renderedInlineCode);
      inlineCodePlaceholders.push(placeholder);
      inlineIndex++;
      return placeholder;
    });

    // Apply markdown formatting to non-code content
    // First protect all placeholders by temporarily replacing them
    const placeholderProtection: { [key: string]: string } = {};
    let protectionIndex = 0;
    
    output = output.replace(/__(CODE_BLOCK|INLINE_CODE)_\d+__/g, (match) => {
      const protectionKey = `ZZPROTECTEDPLACEHOLDERZZ${protectionIndex}ZZEND`;
      placeholderProtection[protectionKey] = match;
      protectionIndex++;
      return protectionKey;
    });
    
    // Headers with enhanced visual hierarchy
    output = output.replace(/^### (.*$)/gm, '\n' + chalk.yellow.bold('▸ $1') + '\n');
    output = output.replace(/^## (.*$)/gm, '\n' + chalk.cyan.bold('▸▸ $1') + '\n');
    output = output.replace(/^# (.*$)/gm, '\n' + chalk.blue.bold('▸▸▸ $1') + '\n');

    // Bold text - now safe to apply 
    output = output.replace(/\*\*(.*?)\*\*/g, chalk.bold('$1'));
    output = output.replace(/__(.*?)__/g, chalk.bold('$1'));

    // Italic text (ignore unmatched or bold markers)
    output = output.replace(/(?<!\*)\*(?!\*)(.*?)\*(?!\*)/g, chalk.italic('$1'));
    output = output.replace(/(?<!_)_(?!_)(.*?)_(?!_)/g, chalk.italic('$1'));
    
    // Restore protected placeholders
    Object.entries(placeholderProtection).forEach(([key, value]) => {
      output = output.replace(key, value);
    });

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

    // Finally, restore the protected code blocks
    codeBlockPlaceholders.forEach((placeholder, index) => {
      output = output.replace(placeholder, codeBlocks[index]);
    });

    // Restore inline code blocks
    inlineCodePlaceholders.forEach((placeholder, index) => {
      output = output.replace(placeholder, inlineCodeBlocks[index]);
    });

    return output;
  }

  /**
   * Maps Prism token types to chalk colors
   */
  private static tokenToChalk(token: any): string {
    if (typeof token === 'string') {
      return token;
    }

    if (Array.isArray(token.content)) {
      return token.content.map((t: any) => this.tokenToChalk(t)).join('');
    }

    const content = typeof token.content === 'string' ? token.content : this.tokenToChalk(token.content);

    // Map token types to chalk colors
    switch (token.type) {
      case 'comment':
        return chalk.gray(content);
      case 'string':
        return chalk.green(content);
      case 'keyword':
        return chalk.magenta(content);
      case 'function':
        return chalk.blue(content);
      case 'number':
        return chalk.yellow(content);
      case 'operator':
        return chalk.cyan(content);
      case 'punctuation':
        return chalk.white(content);
      case 'boolean':
      case 'constant':
        return chalk.yellow(content);
      case 'property':
        return chalk.cyan(content);
      case 'tag':
        return chalk.red(content);
      case 'selector':
        return chalk.magenta(content);
      case 'attr-name':
        return chalk.cyan(content);
      case 'attr-value':
        return chalk.green(content);
      case 'regex':
        return chalk.red(content);
      case 'variable':
        return chalk.yellow(content);
      default:
        return content;
    }
  }

  /**
   * Syntax highlighting for code using Prism.js
   */
  private static highlightCode(code: string, language: string): string {
    // Return plain text if Prism is not available
    if (!Prism) {
      return code;
    }

    // Normalize language name
    let lang = language.toLowerCase();

    // Map language aliases
    switch (lang) {
      case 'js':
        lang = 'javascript';
        break;
      case 'ts':
        lang = 'typescript';
        break;
      case 'shell':
        lang = 'bash';
        break;
    }

    try {
      // Check if Prism supports this language
      if (Prism.languages && Prism.languages[lang]) {
        const tokens = Prism.tokenize(code, Prism.languages[lang]);
        return tokens.map(token => this.tokenToChalk(token)).join('');
      }
    } catch (error) {
      console.error(`Error highlighting code with language ${lang}:`, error);
    }

    // Fallback to plain text if language not supported or error occurs
    return code;
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
