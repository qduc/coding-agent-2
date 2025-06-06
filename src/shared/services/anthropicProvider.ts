import Anthropic from '@anthropic-ai/sdk';
import chalk from 'chalk';
import { configManager } from '../core/config';
import * as os from 'os';
import { execSync } from 'child_process';
import { ToolLogger } from '../utils/toolLogger';
import { LLMProvider, Message, StreamingResponse, FunctionCallResponse } from './llm';

export class AnthropicProvider implements LLMProvider {
  private anthropic: Anthropic | null = null;
  private initialized = false;

  getProviderName(): string {
    return 'anthropic';
  }

  /**
   * Initialize Anthropic client
   */
  async initialize(): Promise<boolean> {
    try {
      const config = configManager.getConfig();

      if (!config.anthropicApiKey) {
        return false;
      }

      this.anthropic = new Anthropic({
        apiKey: config.anthropicApiKey
      });

      // Test the connection by making a simple request
      await this.testConnection();
      this.initialized = true;
      return true;
    } catch (error) {
      console.error(chalk.red('Failed to initialize Anthropic:'), error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Test Anthropic connection
   */
  private async testConnection(): Promise<void> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    // Simple test to verify API key works - create a minimal message
    await this.anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }]
    });
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.initialized && this.anthropic !== null;
  }

  /**
   * Convert our Message format to Anthropic format
   */
  private convertMessages(messages: Message[]): Anthropic.MessageParam[] {
    const anthropicMessages: Anthropic.MessageParam[] = [];

    for (const message of messages) {
      if (message.role === 'system') {
        // Anthropic handles system messages separately - we'll add them to the first user message
        continue;
      }

      if (message.role === 'tool') {
        // Handle tool result messages - convert to proper tool_result format
        anthropicMessages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: message.tool_call_id || '',
              content: message.content || ''
            }
          ]
        });
      } else if (message.role === 'user' || message.role === 'assistant') {
        // Handle regular messages and assistant messages with tool calls
        if (message.role === 'assistant' && message.tool_calls) {
          // Convert assistant message with tool calls
          const content: any[] = [];

          if (message.content) {
            content.push({
              type: 'text',
              text: message.content
            });
          }

          for (const toolCall of message.tool_calls) {
            content.push({
              type: 'tool_use',
              id: toolCall.id,
              name: toolCall.function.name,
              input: JSON.parse(toolCall.function.arguments)
            });
          }

          anthropicMessages.push({
            role: 'assistant',
            content
          });
        } else {
          anthropicMessages.push({
            role: message.role,
            content: message.content || ''
          });
        }
      }
    }

    return anthropicMessages;
  }

  /**
   * Extract system message from messages array
   */
  private extractSystemMessage(messages: Message[]): string {
    const systemMessage = messages.find(msg => msg.role === 'system');
    return systemMessage?.content || '';
  }

  /**
   * Send a message and get streaming response
   */
  async streamMessage(
    messages: Message[],
    onChunk: (chunk: string) => void,
    onComplete?: (response: StreamingResponse) => void
  ): Promise<StreamingResponse> {
    if (!this.isReady()) {
      throw new Error('Anthropic service not initialized. Run setup first.');
    }

    const config = configManager.getConfig();
    const systemMessage = this.extractSystemMessage(messages);
    const anthropicMessages = this.convertMessages(messages);

    try {
      const stream = await this.anthropic!.messages.create({
        model: config.model || 'claude-3-5-sonnet-20241022',
        max_tokens: config.maxTokens || 8000,
        system: systemMessage,
        messages: anthropicMessages,
        stream: true
      });

      let fullContent = '';
      let finishReason: string | null = null;

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          fullContent += chunk.delta.text;
          onChunk(chunk.delta.text);
        }

        if (chunk.type === 'message_stop') {
          finishReason = 'stop';
        }
      }

      const response: StreamingResponse = {
        content: fullContent,
        finishReason
      };

      if (onComplete) {
        onComplete(response);
      }

      return response;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Anthropic API error: ${error.message}`);
      }
      throw new Error('Unknown Anthropic API error');
    }
  }

  /**
   * Send a simple message and get complete response
   */
  async sendMessage(messages: Message[]): Promise<string> {
    if (!this.isReady()) {
      throw new Error('Anthropic service not initialized. Run setup first.');
    }

    const config = configManager.getConfig();
    const systemMessage = this.extractSystemMessage(messages);
    const anthropicMessages = this.convertMessages(messages);

    try {
      const response = await this.anthropic!.messages.create({
        model: config.model || 'claude-3-5-sonnet-20241022',
        max_tokens: config.maxTokens || 8000,
        system: systemMessage,
        messages: anthropicMessages
      });

      return response.content.map(block =>
        block.type === 'text' ? block.text : ''
      ).join('');
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Anthropic API error: ${error.message}`);
      }
      throw new Error('Unknown Anthropic API error');
    }
  }

  /**
   * Send a message with function calling support
   * Note: Anthropic has different tool calling format than OpenAI
   */
  async sendMessageWithTools(
    messages: Message[],
    functions: any[] = [],
    onToolCall?: (toolName: string, args: any) => void
  ): Promise<FunctionCallResponse> {
    if (!this.isReady()) {
      throw new Error('Anthropic service not initialized. Run setup first.');
    }

    const config = configManager.getConfig();
    const systemMessage = this.extractSystemMessage(messages);
    const anthropicMessages = this.convertMessages(messages);

    try {
      const requestParams: any = {
        model: config.model || 'claude-3-5-sonnet-20241022',
        max_tokens: config.maxTokens || 8000,
        system: systemMessage,
        messages: anthropicMessages
      };

      // Add tool calling if functions are provided
      if (functions.length > 0) {
        requestParams.tools = functions.map(func => ({
          name: func.name,
          description: func.description,
          input_schema: func.input_schema || func.parameters
        }));
      }

      const response = await this.anthropic!.messages.create(requestParams);

      let content = '';
      let toolCalls: any[] | undefined;

      for (const contentBlock of response.content) {
        if (contentBlock.type === 'text') {
          content += contentBlock.text;
        } else if (contentBlock.type === 'tool_use') {
          if (!toolCalls) {
            toolCalls = [];
          }

          // Convert Anthropic tool format to OpenAI-compatible format
          toolCalls.push({
            id: contentBlock.id,
            type: 'function',
            function: {
              name: contentBlock.name,
              arguments: JSON.stringify(contentBlock.input)
            }
          });

          const { logToolUsage } = configManager.getConfig();
          if (logToolUsage) {
            ToolLogger.logToolCall(contentBlock.name, contentBlock.input);
          }
          if (onToolCall) {
            onToolCall(contentBlock.name, contentBlock.input);
          }
        }
      }

      return {
        content: content || null,
        tool_calls: toolCalls,
        finishReason: response.stop_reason,
        usage: response.usage ? {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens
        } : undefined
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Anthropic API error: ${error.message}`);
      }
      throw new Error('Unknown Anthropic API error');
    }
  }

  /**
   * Send a message with function calling support and streaming
   */
  async streamMessageWithTools(
    messages: Message[],
    functions: any[] = [],
    onChunk?: (chunk: string) => void,
    onToolCall?: (toolName: string, args: any) => void
  ): Promise<FunctionCallResponse> {
    if (!this.isReady()) {
      throw new Error('Anthropic service not initialized. Run setup first.');
    }

    const config = configManager.getConfig();
    const systemMessage = this.extractSystemMessage(messages);
    const anthropicMessages = this.convertMessages(messages);

    try {
      const requestParams: any = {
        model: config.model || 'claude-3-5-sonnet-20241022',
        max_tokens: config.maxTokens || 8000,
        system: systemMessage,
        messages: anthropicMessages,
        stream: true
      };

      // Add tool calling if functions are provided
      if (functions.length > 0) {
        requestParams.tools = functions.map(func => ({
          name: func.name,
          description: func.description,
          input_schema: func.input_schema || func.parameters
        }));
      }

      const stream = await this.anthropic!.messages.create(requestParams) as any;

      let fullContent = '';
      let finishReason: string | null = null;
      let toolCalls: any[] | undefined;
      const { logToolUsage } = configManager.getConfig();

      // Track streaming tool input accumulation
      const streamingToolInputs: Map<number, string> = new Map();

      for await (const chunk of stream) {
        // Handle content streaming
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          fullContent += chunk.delta.text;
          if (onChunk) {
            onChunk(chunk.delta.text);
          }
        }

        // Handle tool use start
        if (chunk.type === 'content_block_start' && chunk.content_block.type === 'tool_use') {
          if (!toolCalls) {
            toolCalls = [];
          }

          const toolBlock = chunk.content_block;
          const toolCallIndex = chunk.index;

          // Initialize tool call with placeholder - we'll update the arguments later
          toolCalls.push({
            id: toolBlock.id,
            type: 'function',
            function: {
              name: toolBlock.name,
              arguments: '{}' // Will be updated when streaming completes
            }
          });

          // Initialize streaming input accumulation for this tool
          streamingToolInputs.set(toolCallIndex, '');
        }

        // Handle streaming tool input
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'input_json_delta') {
          const toolCallIndex = chunk.index;
          const currentInput = streamingToolInputs.get(toolCallIndex) || '';
          streamingToolInputs.set(toolCallIndex, currentInput + chunk.delta.partial_json);
        }

        // Handle tool use completion
        if (chunk.type === 'content_block_stop' && toolCalls) {
          const toolCallIndex = chunk.index;
          const fullInputJson = streamingToolInputs.get(toolCallIndex);

          if (fullInputJson !== undefined) {
            // Find the tool call for this index and update its arguments
            const toolCallArrayIndex = toolCalls.length - 1; // Assuming tools are added in order
            if (toolCallArrayIndex >= 0) {
              try {
                const parsedInput = JSON.parse(fullInputJson);
                toolCalls[toolCallArrayIndex].function.arguments = JSON.stringify(parsedInput);

                if (logToolUsage) {
                  ToolLogger.logToolCall(toolCalls[toolCallArrayIndex].function.name, parsedInput);
                }
                if (onToolCall) {
                  onToolCall(toolCalls[toolCallArrayIndex].function.name, parsedInput);
                }
              } catch (e) {
                // If JSON parsing fails, keep the raw input
                toolCalls[toolCallArrayIndex].function.arguments = fullInputJson;

                if (logToolUsage) {
                  ToolLogger.logToolCall(toolCalls[toolCallArrayIndex].function.name, {});
                }
                if (onToolCall) {
                  onToolCall(toolCalls[toolCallArrayIndex].function.name, {});
                }
              }
            }

            // Clean up streaming state
            streamingToolInputs.delete(toolCallIndex);
          }
        }

        if (chunk.type === 'message_stop') {
          finishReason = 'stop';
        }
      }

      return {
        content: fullContent || null,
        tool_calls: toolCalls,
        finishReason,
        // Note: streaming doesn't provide usage info in the same way
        usage: undefined
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Anthropic API error: ${error.message}`);
      }
      throw new Error('Unknown Anthropic API error');
    }
  }

  /**
   * Send tool results back to Claude and get the final response
   */
  async sendToolResults(
    messages: Message[],
    toolResults: Array<{ tool_call_id: string; content: string }>,
    functions: any[] = []
  ): Promise<FunctionCallResponse> {
    if (!this.isReady()) {
      throw new Error('Anthropic service not initialized. Run setup first.');
    }

    // Add tool result messages to the conversation
    const updatedMessages = [...messages];
    for (const result of toolResults) {
      updatedMessages.push({
        role: 'tool',
        content: result.content,
        tool_call_id: result.tool_call_id
      });
    }

    // Send the updated conversation back to Claude
    return this.sendMessageWithTools(updatedMessages, functions);
  }

  /**
   * Send tool results back to Claude and get streaming response
   */
  async streamToolResults(
    messages: Message[],
    toolResults: Array<{ tool_call_id: string; content: string }>,
    functions: any[] = [],
    onChunk?: (chunk: string) => void,
    onToolCall?: (toolName: string, args: any) => void
  ): Promise<FunctionCallResponse> {
    if (!this.isReady()) {
      throw new Error('Anthropic service not initialized. Run setup first.');
    }

    // Add tool result messages to the conversation
    const updatedMessages = [...messages];
    for (const result of toolResults) {
      updatedMessages.push({
        role: 'tool',
        content: result.content,
        tool_call_id: result.tool_call_id
      });
    }

    // Send the updated conversation back to Claude with streaming
    return this.streamMessageWithTools(updatedMessages, functions, onChunk, onToolCall);
  }
}
