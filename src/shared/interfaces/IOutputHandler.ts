import { Message } from '../../services/llm';

/**
 * Interface for handling system output with formatting
 */
export interface IOutputHandler {
  /**
   * Write standard output
   * @param content Content to output
   * @param style Optional styling options
   */
  writeOutput(content: string, style?: OutputStyle): void;

  /**
   * Write error output
   * @param error Error message or object
   * @param details Optional error details
   */
  writeError(error: string | Error, details?: Record<string, unknown>): void;

  /**
   * Write success message
   * @param message Success message
   */
  writeSuccess(message: string): void;

  /**
   * Render and output markdown content
   * @param markdown Markdown content to render
   */
  writeMarkdown(markdown: string): void;
}

/**
 * Output styling options
 */
export interface OutputStyle {
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'warning';
  format?: 'bold' | 'italic' | 'underline';
  indent?: number;
}
