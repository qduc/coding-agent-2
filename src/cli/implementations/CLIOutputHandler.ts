import chalk from 'chalk';
import { IOutputHandler, OutputStyle } from '../../shared/interfaces/IOutputHandler';
import { MarkdownRenderer } from '../../shared/utils/markdown';

export class CLIOutputHandler implements IOutputHandler {
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
