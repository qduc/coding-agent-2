/**
 * Retry utilities with exponential backoff for tool operations
 */

import { ToolError } from './types';

/**
 * Options for retry behavior
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds */
  initialDelay: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Maximum delay between retries */
  maxDelay: number;
  /** Function to determine if an error should trigger a retry */
  shouldRetry?: (error: Error) => boolean;
}

/**
 * Default retry options
 */
export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 100,
  backoffMultiplier: 2,
  maxDelay: 5000,
  shouldRetry: (error: Error) => {
    // Retry on temporary filesystem errors, but not on validation errors
    if (error instanceof ToolError) {
      return error.code === 'OPERATION_TIMEOUT' || error.code === 'UNKNOWN_ERROR';
    }

    // Retry on EBUSY, EAGAIN, EMFILE (temporary file system errors)
    const retryableCodes = ['EBUSY', 'EAGAIN', 'EMFILE', 'ENOTREADY'];
    return retryableCodes.includes((error as any).code);
  }
};

/**
 * Execute an operation with exponential backoff retry logic
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error;
  let delay = opts.initialDelay;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on the last attempt
      if (attempt === opts.maxRetries) {
        break;
      }

      // Check if we should retry this error
      if (!opts.shouldRetry!(lastError)) {
        break;
      }

      // Wait before retrying
      await sleep(delay);

      // Calculate next delay with exponential backoff
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay);
    }
  }

  // If we get here, all retries failed
  throw lastError!;
}

/**
 * Sleep for the specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute an operation with a timeout
 */
export async function executeWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'Operation timed out'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new ToolError(timeoutMessage, 'OPERATION_TIMEOUT'));
    }, timeoutMs);
  });

  return Promise.race([operation(), timeoutPromise]);
}
