import { logger } from '../utils/logger';

export class ToolLoopHandler {
  static async runToolLoop(messages: any[], maxIterations = 10, verbose = false): Promise<string> {
    for (let iterations = 0; iterations < maxIterations; iterations++) {
      try {
        const response = await someToolCall(messages);
        if (response.needMoreInteraction) {
          messages.push({ role: 'system', content: response.content });
        } else {
          if (verbose) {
            logger.debug('Tool loop completed', {}, 'ToolLoopHandler');
          }
          return response.content || '';
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Tool loop failed in iteration ${iterations}`, error instanceof Error ? error : new Error(errorMessage), {}, 'ToolLoopHandler');
        throw new Error(`Failed to process tool loop in iteration ${iterations}: ${errorMessage}`);
      }
    }

    throw new Error(`Maximum iterations (${maxIterations}) reached without completion`);
  }
}

async function someToolCall(messages: any[]): Promise<any> {
  // Placeholder function for demonstration
  return { needMoreInteraction: false, content: 'Result' };
}
