/**
 * Example Echo Tool - demonstrates BaseTool usage
 *
 * This is a simple example tool that echoes back the input with optional formatting.
 * It serves as a template and testing tool for the BaseTool infrastructure.
 */

import { BaseTool } from './base';
import { ToolSchema, ToolResult } from './types';

interface EchoParams {
  message: string;
  uppercase?: boolean;
  repeat?: number;
}

export class EchoTool extends BaseTool {
  readonly name = 'echo';
  readonly description = 'Echo back a message with optional formatting (for testing and demonstration)';
  readonly schema: ToolSchema = {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'The message to echo back',
        minLength: 1,
        maxLength: 1000
      },
      uppercase: {
        type: 'boolean',
        description: 'Convert message to uppercase'
      },
      repeat: {
        type: 'number',
        description: 'Number of times to repeat the message',
        minimum: 1,
        maximum: 10
      }
    },
    required: ['message'],
    additionalProperties: false
  };

  protected async executeImpl(params: EchoParams): Promise<ToolResult> {
    let { message, uppercase = false, repeat = 1 } = params;

    // Apply formatting
    if (uppercase) {
      message = message.toUpperCase();
    }

    // Repeat the message
    const result = Array(repeat).fill(message).join(' ');

    return this.createSuccessResult(result, {
      originalMessage: params.message,
      formatted: uppercase,
      repetitions: repeat,
      outputLength: result.length,
      type: 'echo'
    });
  }
}

// Export a factory function for easy instantiation
export function createEchoTool(): EchoTool {
  return new EchoTool();
}
