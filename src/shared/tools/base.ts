/**
 * Base abstract class for all tools in the coding agent
 *
 * Provides common functionality for tool execution, validation, error handling,
 * and integration with OpenAI's function calling mechanism.
 */

import { ToolSchema, ToolResult, ToolError, ToolContext, FunctionCallSchema, DEFAULT_TOOL_CONTEXT, ExecutionContext } from './types';
import { validateParams } from './validation';
import { executeWithRetry, executeWithTimeout, DEFAULT_RETRY_OPTIONS, RetryOptions } from './retry';

export abstract class BaseTool {
  /** Unique name for the tool (used in function calling) */
  abstract readonly name: string;

  /** Human-readable description of what the tool does */
  abstract readonly description: string;

  /** JSON schema defining the tool's parameters */
  abstract readonly schema: ToolSchema;

  /** Tool execution context (security, limits, etc.) */
  protected context: ToolContext;

  constructor(context: Partial<ToolContext> = {}) {
    this.context = { ...DEFAULT_TOOL_CONTEXT, ...context };
  }

  /**
   * Execute the tool with the given parameters
   * This is the main method that concrete tools must implement
   */
  protected abstract executeImpl(params: any, abortSignal?: AbortSignal): Promise<ToolResult>;

  /**
   * Public execution method with validation, error handling, and retry logic
   */
  async execute(params: any, executionContext?: ExecutionContext): Promise<ToolResult> {
    const startTime = Date.now();
    const abortSignal = executionContext?.abortSignal;
    const retryOptions = executionContext?.retryOptions || DEFAULT_RETRY_OPTIONS;

    try {
      // Check for cancellation before starting
      if (abortSignal?.aborted) {
        throw new ToolError('Operation was aborted by user', 'OPERATION_TIMEOUT');
      }

      // Validate parameters against schema
      this.validateParams(params);

      // Execute with timeout and retry logic
      const result = await executeWithRetry(
        () => {
          // Check for cancellation before each retry attempt
          if (abortSignal?.aborted) {
            throw new ToolError('Operation was aborted by user', 'OPERATION_TIMEOUT');
          }

          return executeWithTimeout(
            () => this.executeImpl(params, abortSignal),
            this.context.timeout,
            `Tool '${this.name}' execution timed out after ${this.context.timeout}ms`
          );
        },
        retryOptions
      );

      // Add execution metadata
      if (result.metadata) {
        result.metadata.executionTime = Date.now() - startTime;
      } else {
        result.metadata = { executionTime: Date.now() - startTime };
      }

      return result;
    } catch (error) {
      return this.handleError(error as Error, Date.now() - startTime);
    }
  }

  /**
   * Validate parameters against the tool's schema
   */
  protected validateParams(params: any): void {
    try {
      validateParams(params, this.schema);
    } catch (error) {
      if (error instanceof ToolError) {
        throw error;
      }
      throw new ToolError(
        `Parameter validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INVALID_PARAMS'
      );
    }
  }

  /**
   * Handle errors and convert them to ToolResult format
   */
  protected handleError(error: Error, executionTime: number): ToolResult {
    let toolError: ToolError;

    if (error instanceof ToolError) {
      toolError = error;
    } else {
      // Convert standard errors to ToolError
      toolError = this.convertToToolError(error);
    }

    return {
      success: false,
      error: toolError,
      metadata: {
        executionTime,
        errorCode: toolError.code
      }
    };
  }

  /**
   * Convert standard errors to ToolError with appropriate codes and suggestions
   */
  protected convertToToolError(error: Error): ToolError {
    const message = error.message;
    const errorCode = (error as any).code;

    // File system errors
    switch (errorCode) {
      case 'ENOENT':
        return new ToolError(
          'File or directory not found',
          'FILE_NOT_FOUND',
          [
            'Check if the path exists',
            'Verify the file name and extension',
            'Use an absolute path to avoid confusion'
          ]
        );

      case 'EACCES':
      case 'EPERM':
        return new ToolError(
          'Permission denied',
          'PERMISSION_DENIED',
          [
            'Check file permissions',
            'Ensure you have read/write access',
            'Try running with appropriate permissions'
          ]
        );

      case 'EISDIR':
        return new ToolError(
          'Expected a file but found a directory',
          'INVALID_PATH',
          [
            'Provide a file path instead of a directory',
            'Check if you meant to list the directory contents'
          ]
        );

      case 'ENOTDIR':
        return new ToolError(
          'Expected a directory but found a file',
          'INVALID_PATH',
          [
            'Provide a directory path instead of a file',
            'Check the parent directory exists'
          ]
        );

      case 'EMFILE':
      case 'ENFILE':
        return new ToolError(
          'Too many open files',
          'OPERATION_TIMEOUT',
          [
            'Close some files and try again',
            'This is usually a temporary issue'
          ]
        );

      default:
        return new ToolError(
          message || 'An unexpected error occurred',
          'UNKNOWN_ERROR',
          [
            'Try the operation again',
            'Check if the file system is accessible',
            'Contact support if the issue persists'
          ]
        );
    }
  }

  /**
   * Get the function calling schema for OpenAI integration
   */
  getFunctionCallSchema(): FunctionCallSchema {
    return {
      name: this.name,
      description: this.description,
      parameters: this.schema
    };
  }

  /**
   * Create a successful tool result
   */
  protected createSuccessResult(output: any, metadata?: any): ToolResult {
    return {
      success: true,
      output,
      metadata
    };
  }

  /**
   * Create a failed tool result
   */
  protected createErrorResult(message: string, code: ToolError['code'], suggestions?: string[]): ToolResult {
    return {
      success: false,
      error: new ToolError(message, code, suggestions)
    };
  }

  /**
   * Get tool context (useful for debugging)
   */
  getContext(): ToolContext {
    return { ...this.context };
  }

  /**
   * Update tool context
   */
  updateContext(updates: Partial<ToolContext>): void {
    this.context = { ...this.context, ...updates };
  }

  /**
   * Get tool information for logging/debugging
   */
  getInfo(): { name: string; description: string; schema: ToolSchema } {
    return {
      name: this.name,
      description: this.description,
      schema: this.schema
    };
  }
}
