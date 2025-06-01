import chalk from 'chalk';
import { IOutputHandler, OutputStyle } from '../../shared/interfaces/IOutputHandler';
import { MarkdownRenderer } from '../../shared/utils/markdown';

export class CLIOutputHandler implements IOutputHandler {
  writeOutput(content: string, style?: OutputStyle): void {
    this.write(content, style);
  }

  writeError(error: string | Error, details?: Record<string, unknown>): void {
    const message = typeof error === 'string' ? error : error.message;
    this.writeLine(`Error: ${message}`, { color: 'error' });
    if (details) {
      this.writeLine(JSON.stringify(details, null, 2), { color: 'secondary', indent: 2 });
    }
  }

  writeSuccess(message: string): void {
    this.writeLine(message, { color: 'success' });
  }
  write(text: string, style?: OutputStyle): void {
    let output = text;
    
    if (style?.color) {
      switch (style.color) {
        case 'primary': output = chalk.blue(output); break;
        case 'secondary': output = chalk.gray(output); break;
        case 'success': output = chalk.green(output); break;
        case 'error': output = chalk.red(output); break;
        case 'warning': output = chalk.yellow(output); break;
      }
    }

    if (style?.format) {
      switch (style.format) {
        case 'bold': output = chalk.bold(output); break;
        case 'italic': output = chalk.italic(output); break;
        case 'underline': output = chalk.underline(output); break;
      }
    }

    if (style?.indent) {
      output = ' '.repeat(style.indent) + output;
    }

    process.stdout.write(output);
  }

  writeLine(text: string, style?: OutputStyle): void {
    this.write(text + '\n', style);
  }

  writeMarkdown(markdown: string): void {
    this.writeLine(MarkdownRenderer.render(markdown));
  }

  clearScreen(): void {
    process.stdout.write('\x1Bc');
  }
}
