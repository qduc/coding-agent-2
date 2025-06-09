import Anthropic from '@anthropic-ai/sdk';
import { BaseLLMProvider } from '../BaseLLMProvider';
import { Message, StreamingResponse, FunctionCallResponse } from '../../types/llm';
import { PromptCachingService } from '../PromptCachingService';

export class AnthropicProvider extends BaseLLMProvider {
  private anthropic: Anthropic | null = null;
  private cachingService: PromptCachingService;

  constructor() {
    super();
    this.cachingService = new PromptCachingService(this.config);
  }

  getProviderName(): string {
    return 'anthropic';
  }

  protected getDefaultModel(): string {
    return 'claude-3-5-sonnet-20241022';
  }

  /**
   * Initialize Anthropic client
   */
  async initialize(): Promise<boolean> {
    try {
      this.refreshConfig();

      if (!this.validateApiKey(this.config.anthropicApiKey, 'ANTHROPIC_API_KEY')) {
        return false;
      }

      this.anthropic = new Anthropic({
        apiKey: this.config.anthropicApiKey!
      });

      // Test the connection by making a simple request
      await this.testConnection();
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize Anthropic:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Test Anthropic connection
   */
  protected async testConnection(): Promise<void> {
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
        const toolResultContent: any = {
          type: 'tool_result',
          tool_use_id: message.tool_call_id || '',
          content: message.content || ''
        };

        // Add cache control if present
        if (message.cache_control) {
          toolResultContent.cache_control = message.cache_control;
        }

        anthropicMessages.push({
          role: 'user',
          content: [toolResultContent]
        });
      } else if (message.role === 'user' || message.role === 'assistant') {
        // Handle regular messages and assistant messages with tool calls
        if (message.role === 'assistant' && message.tool_calls) {
          // Convert assistant message with tool calls
          const content: any[] = [];

          if (message.content) {
            const textContent: any = {
              type: 'text',
              text: message.content
            };

            // Add cache control to the last content block if present
            if (message.cache_control && !message.tool_calls.length) {
              textContent.cache_control = message.cache_control;
            }

            content.push(textContent);
          }

          for (const toolCall of message.tool_calls) {
            const toolUseContent: any = {
              type: 'tool_use',
              id: toolCall.id,
              name: toolCall.function.name,
              input: this.parseToolArguments(toolCall.function.arguments)
            };

            content.push(toolUseContent);
          }

          // Add cache control to the last tool call if present
          if (message.cache_control && content.length > 0) {
            content[content.length - 1].cache_control = message.cache_control;
          }

          anthropicMessages.push({
            role: 'assistant',
            content
          });
        } else {
          // Handle simple text messages
          if (typeof message.content === 'string') {
            const textContent: any = {
              type: 'text',
              text: message.content
            };

            // Add cache control if present
            if (message.cache_control) {
              textContent.cache_control = message.cache_control;
            }

            anthropicMessages.push({
              role: message.role,
              content: [textContent]
            });
          } else {
            // Fallback for non-string content
            anthropicMessages.push({
              role: message.role,
              content: message.content || ''
            });
          }
        }
      }
    }

    return anthropicMessages;
  }

  /**
   * Send a message and get streaming response
   */
  protected async _streamMessage(
    messages: Message[],
    onChunk: (chunk: string) => void,
    onComplete?: (response: StreamingResponse) => void
  ): Promise<StreamingResponse> {
    this.ensureInitialized();

    const systemMessage = this.extractSystemMessage(messages);
    
    // Apply prompt caching
    const { messages: cachedMessages, systemMessages } = this.cachingService.applyCacheControl(
      messages,
      undefined,
      systemMessage
    );
    
    const anthropicMessages = this.convertMessages(cachedMessages);

    this.logApiCall('streamMessage', messages.length);

    try {
      const requestParams: any = {
        model: this.getModelName(),
        max_tokens: this.config.maxTokens || 8000,
        messages: anthropicMessages,
        stream: true
      };

      // Use cached system messages if available, otherwise use original
      if (systemMessages && systemMessages.length > 0) {
        requestParams.system = systemMessages;
      } else if (systemMessage) {
        requestParams.system = systemMessage;
      }

      const stream = await this.anthropic!.messages.create(requestParams) as any;

      let fullContent = '';
      let finishReason: string | null = null;
      let usage: any = undefined;

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          fullContent += chunk.delta.text;
          onChunk(chunk.delta.text);
        }

        if (chunk.type === 'message_stop') {
          finishReason = 'stop';
        }

        // Capture usage information if available
        if (chunk.type === 'message_delta' && chunk.usage) {
          usage = chunk.usage;
        }
      }

      // Build response with cache usage if available
      const response: StreamingResponse = {
        content: fullContent,
        finishReason,
        usage: usage ? this.buildUsageResponse(usage) : undefined
      };

      if (onComplete) {
        onComplete(response);
      }

      return response;
    } catch (error) {
      throw this.formatError(error, 'streamMessage');
    }
  }

  /**
   * Send a simple message and get complete response
   */
  protected async _sendMessage(messages: Message[]): Promise<string> {
    this.ensureInitialized();

    const systemMessage = this.extractSystemMessage(messages);
    
    // Apply prompt caching
    const { messages: cachedMessages, systemMessages } = this.cachingService.applyCacheControl(
      messages,
      undefined,
      systemMessage
    );
    
    const anthropicMessages = this.convertMessages(cachedMessages);

    this.logApiCall('sendMessage', messages.length);

    try {
      const requestParams: any = {
        model: this.getModelName(),
        max_tokens: this.config.maxTokens || 8000,
        messages: anthropicMessages
      };

      // Use cached system messages if available, otherwise use original
      if (systemMessages && systemMessages.length > 0) {
        requestParams.system = systemMessages;
      } else if (systemMessage) {
        requestParams.system = systemMessage;
      }

      const response = await this.anthropic!.messages.create(requestParams);

      return response.content.map(block =>
        block.type === 'text' ? block.text : ''
      ).join('');
    } catch (error) {
      throw this.formatError(error, 'sendMessage');
    }
  }

  /**
   * Send a message with function calling support
   * Note: Anthropic has different tool calling format than OpenAI
   */
  protected async _sendMessageWithTools(
    messages: Message[],
    functions: any[] = [],
    onToolCall?: (toolName: string, args: any) => void
  ): Promise<FunctionCallResponse> {
    this.ensureInitialized();

    const systemMessage = this.extractSystemMessage(messages);
    const normalizedFunctions = this.validateAndNormalizeTools(functions);
    
    // Apply prompt caching
    const { messages: cachedMessages, tools: cachedTools, systemMessages } = this.cachingService.applyCacheControl(
      messages,
      normalizedFunctions,
      systemMessage
    );
    
    const anthropicMessages = this.convertMessages(cachedMessages);

    this.logApiCall('sendMessageWithTools', messages.length, { functionsCount: normalizedFunctions.length });

    try {
      const requestParams: any = {
        model: this.getModelName(),
        max_tokens: this.config.maxTokens || 8000,
        messages: anthropicMessages
      };

      // Use cached system messages if available, otherwise use original
      if (systemMessages && systemMessages.length > 0) {
        requestParams.system = systemMessages;
      } else if (systemMessage) {
        requestParams.system = systemMessage;
      }

      // Add tool calling if functions are provided
      const toolsToUse = cachedTools || normalizedFunctions;
      if (toolsToUse.length > 0) {
        requestParams.tools = toolsToUse.map(func => ({
          name: func.name,
          description: func.description,
          input_schema: func.input_schema || func.parameters,
          cache_control: func.cache_control
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

          this.handleToolCall(contentBlock.name, contentBlock.input, onToolCall);
        }
      }

      return {
        content: content || null,
        tool_calls: toolCalls,
        finishReason: response.stop_reason,
        usage: this.buildUsageResponse(response.usage)
      };
    } catch (error) {
      throw this.formatError(error, 'sendMessageWithTools');
    }
  }

  /**
   * Send a message with function calling support and streaming
   */
  protected async _streamMessageWithTools(
    messages: Message[],
    functions: any[] = [],
    onChunk?: (chunk: string) => void,
    onToolCall?: (toolName: string, args: any) => void
  ): Promise<FunctionCallResponse> {
    this.ensureInitialized();

    const systemMessage = this.extractSystemMessage(messages);
    const anthropicMessages = this.convertMessages(messages);
    const normalizedFunctions = this.validateAndNormalizeTools(functions);

    this.logApiCall('streamMessageWithTools', messages.length, { functionsCount: normalizedFunctions.length });

    try {
      const requestParams: any = {
        model: this.getModelName(),
        max_tokens: this.config.maxTokens || 8000,
        system: systemMessage,
        messages: anthropicMessages,
        stream: true
      };

      // Add tool calling if functions are provided
      if (normalizedFunctions.length > 0) {
        requestParams.tools = normalizedFunctions.map(func => ({
          name: func.name,
          description: func.description,
          input_schema: func.input_schema || func.parameters
        }));
      }

      const stream = await this.anthropic!.messages.create(requestParams) as any;

      let fullContent = '';
      let finishReason: string | null = null;
      let toolCalls: any[] | undefined;

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
              const parsedInput = this.parseToolArguments(fullInputJson);
              toolCalls[toolCallArrayIndex].function.arguments = JSON.stringify(parsedInput);

              this.handleToolCall(toolCalls[toolCallArrayIndex].function.name, parsedInput, onToolCall);
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
      throw this.formatError(error, 'streamMessageWithTools');
    }
  }
}