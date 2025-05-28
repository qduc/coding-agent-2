/**
 * Echo tool - Simple test tool that echoes back the input
 * Used for testing and debugging the tool system
 */

import { BaseTool } from './base';
import { ToolSchema, ToolResult } from './types';

export interface EchoParams {
  message: string;
  repeat?: number;
}

export class EchoTool extends BaseTool {
  readonly name = 'echo';
  readonly description = 'Echo back a message (useful for testing)';

  readonly schema: ToolSchema = {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Message to echo back'
      },
      repeat: {
        type: 'number',
        description: 'Number of times to repeat the message',
        default: 1,
        minimum: 1,
        maximum: 10
      }
    },
    required: ['message']
  };

  protected async executeImpl(params: EchoParams): Promise<ToolResult> {
    const { message, repeat = 1 } = params;

    const repeatedMessage = Array(repeat).fill(message).join(' ');

    return this.createSuccessResult(repeatedMessage, {
      originalMessage: message,
      repeatCount: repeat
    });
  }
}
