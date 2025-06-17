import Anthropic from '@anthropic-ai/sdk';
import { BaseLLMProvider } from '../BaseLLMProvider';
import { Message, FunctionCallResponse } from '../../types/llm';
import { PromptCachingService } from '../PromptCachingService';
import { Logger } from '../../utils/logger';

export class AnthropicProvider extends BaseLLMProvider {
  private anthropic: Anthropic | null = null;
  private cachingService: PromptCachingService;
  private logger: Logger;

  constructor() {
    super();
    this.cachingService = new PromptCachingService(this.config);
    this.logger = Logger.getInstance();
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

      this.logger.debug('Initializing Anthropic provider', {
        promptCachingEnabled: this.config.enablePromptCaching,
        bailOnNoCacheUsage: this.config.bailOnNoCacheUsage,
        model: this.config.model
      });

      this.anthropic = new Anthropic({
        apiKey: this.config.anthropicApiKey!,
        defaultHeaders: {
          'anthropic-beta': 'prompt-caching-2024-07-31'
        }
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

    this.logApiCall('sendMessageWithTools111', messages.length, { functionsCount: normalizedFunctions.length });

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

      // Validate cache usage if bail-on-no-cache is enabled
      if (this.config.bailOnNoCacheUsage && this.config.enablePromptCaching) {
        this.validateCacheUsage(response.usage, 'sendMessageWithTools');
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
   * Validate that the response used prompt caching, bail out if not
   */
  private validateCacheUsage(usage: any, operation: string): void {
    if (!usage) {
      this.logger.debug('Cache validation failed - no usage data', { operation });
      throw new Error(`No usage data available for cache validation in ${operation}`);
    }

    const cacheUsage = this.cachingService.extractCacheUsage(usage);
    const hasCacheReads = cacheUsage?.cache_read_input_tokens > 0;
    const hasCacheCreation = cacheUsage?.cache_creation_input_tokens > 0;

    this.logger.debug('Cache usage data received', {
      operation,
      rawUsage: usage,
      extractedCacheUsage: cacheUsage,
      hasCacheReads,
      hasCacheCreation,
      cacheReadTokens: cacheUsage?.cache_read_input_tokens || 0,
      cacheCreationTokens: cacheUsage?.cache_creation_input_tokens || 0,
      regularInputTokens: usage.input_tokens || 0
    });

    if (!hasCacheReads && !hasCacheCreation) {
      const errorMsg = `Request did not use prompt caching (operation: ${operation}). ` +
        `Bailing out to avoid unnecessary cost. Consider disabling bailOnNoCacheUsage ` +
        `or ensuring your prompts meet minimum token requirements for caching.`;

      this.logger.debug('Cache validation failed', {
        operation,
        usage: usage,
        cacheUsage,
        bailOnNoCacheUsage: this.config.bailOnNoCacheUsage
      });

      throw new Error(errorMsg);
    }

    const efficiency = this.cachingService.calculateCacheEfficiency(usage);
    this.logger.debug('Cache validation passed', {
      operation,
      cacheReads: cacheUsage?.cache_read_input_tokens || 0,
      cacheCreation: cacheUsage?.cache_creation_input_tokens || 0,
      hitRatio: efficiency.hitRatio,
      costSavings: efficiency.costSavings,
      hasReads: hasCacheReads,
      hasCreation: hasCacheCreation
    });
  }
}