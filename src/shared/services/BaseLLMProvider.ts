import { LLMProvider, Message, StreamingResponse, FunctionCallResponse } from '../types/llm';
import { configManager, Config } from '../core/config';
import { ToolLogger } from '../utils/toolLogger';
import { SchemaAdapter } from './schemaAdapter';
import { logger } from '../utils/logger';

/**
 * Abstract base class for LLM providers that implements common functionality
 * to reduce code duplication across provider implementations.
 */
export abstract class BaseLLMProvider implements LLMProvider {
  protected initialized = false;
  protected config: Config;

  constructor() {
    this.config = configManager.getConfig();
  }

  // Abstract methods that must be implemented by concrete providers
  abstract initialize(): Promise<boolean>;
  abstract getProviderName(): string;
  abstract sendMessage(messages: Message[]): Promise<string>;
  abstract streamMessage(
    messages: Message[],
    onChunk: (chunk: string) => void,
    onComplete?: (response: StreamingResponse) => void
  ): Promise<StreamingResponse>;
  abstract sendMessageWithTools(
    messages: Message[],
    functions?: any[],
    onToolCall?: (toolName: string, args: any) => void
  ): Promise<FunctionCallResponse>;
  abstract streamMessageWithTools(
    messages: Message[],
    functions?: any[],
    onChunk?: (chunk: string) => void,
    onToolCall?: (toolName: string, args: any) => void
  ): Promise<FunctionCallResponse>;

  // Concrete methods with shared implementation
  
  /**
   * Check if the provider is ready for use
   */
  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Get the model name from configuration
   */
  getModelName(): string {
    this.config = configManager.getConfig();
    return this.config.model || this.getDefaultModel();
  }

  /**
   * Get the default model for this provider
   */
  protected abstract getDefaultModel(): string;

  /**
   * Validate and normalize tool functions using SchemaAdapter
   */
  protected validateAndNormalizeTools(functions: any[]): any[] {
    if (!functions || functions.length === 0) {
      return [];
    }
    return SchemaAdapter.normalizeAll(functions);
  }

  /**
   * Handle tool call logging and callbacks
   */
  protected handleToolCall(toolName: string, args: any, onToolCall?: (toolName: string, args: any) => void): void {
    const { logToolUsage } = configManager.getConfig();
    if (logToolUsage) {
      ToolLogger.logToolCall(toolName, args);
    }
    if (onToolCall) {
      onToolCall(toolName, args);
    }
  }

  /**
   * Parse tool call arguments safely
   */
  protected parseToolArguments(argsString: string): any {
    try {
      return JSON.parse(argsString);
    } catch (error) {
      logger.warn(`Failed to parse tool arguments: ${argsString}`, { error: error instanceof Error ? error.message : String(error) }, this.getProviderName());
      return {};
    }
  }

  /**
   * Format error messages consistently
   */
  protected formatError(error: unknown, context: string): Error {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const providerName = this.getProviderName();
    return new Error(`${providerName} API error in ${context}: ${errorMessage}`);
  }

  /**
   * Log API calls for debugging
   */
  protected logApiCall(method: string, messageCount: number, additionalInfo: Record<string, any> = {}): void {
    logger.debug(`${this.getProviderName()} ${method} called`, {
      messageCount,
      model: this.getModelName(),
      ...additionalInfo
    }, this.getProviderName());
  }

  /**
   * Build usage response object in standard format
   */
  protected buildUsageResponse(usage: any): { promptTokens: number; completionTokens: number; totalTokens: number } | undefined {
    if (!usage) {
      return undefined;
    }

    // Handle different provider usage formats
    if (usage.input_tokens !== undefined && usage.output_tokens !== undefined) {
      // Anthropic format
      return {
        promptTokens: usage.input_tokens,
        completionTokens: usage.output_tokens,
        totalTokens: usage.input_tokens + usage.output_tokens
      };
    } else if (usage.prompt_tokens !== undefined && usage.completion_tokens !== undefined) {
      // OpenAI format
      return {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens || (usage.prompt_tokens + usage.completion_tokens)
      };
    } else if (usage.total_tokens !== undefined) {
      // Generic format with total tokens
      return {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: usage.total_tokens
      };
    }

    return undefined;
  }

  /**
   * Check if provider is initialized and throw error if not
   */
  protected ensureInitialized(): void {
    if (!this.isReady()) {
      throw new Error(`${this.getProviderName()} service not initialized. Run setup first.`);
    }
  }

  /**
   * Extract system message from messages array
   */
  protected extractSystemMessage(messages: Message[]): string {
    const systemMessage = messages.find(msg => msg.role === 'system');
    return systemMessage?.content || '';
  }

  /**
   * Standard implementation for sending tool results
   * Can be overridden by providers that need custom behavior
   */
  async sendToolResults(
    messages: Message[],
    toolResults: Array<{ tool_call_id: string; content: string }>,
    functions: any[] = []
  ): Promise<FunctionCallResponse> {
    this.ensureInitialized();

    // Add tool result messages to the conversation
    const updatedMessages = [...messages];
    for (const result of toolResults) {
      updatedMessages.push({
        role: 'tool',
        content: result.content,
        tool_call_id: result.tool_call_id
      });
    }

    // Send the updated conversation back to the LLM
    return this.sendMessageWithTools(updatedMessages, functions);
  }

  /**
   * Standard implementation for streaming tool results
   * Can be overridden by providers that need custom behavior
   */
  async streamToolResults(
    messages: Message[],
    toolResults: Array<{ tool_call_id: string; content: string }>,
    functions: any[] = [],
    onChunk?: (chunk: string) => void,
    onToolCall?: (toolName: string, args: any) => void
  ): Promise<FunctionCallResponse> {
    this.ensureInitialized();

    // Add tool result messages to the conversation
    const updatedMessages = [...messages];
    for (const result of toolResults) {
      updatedMessages.push({
        role: 'tool',
        content: result.content,
        tool_call_id: result.tool_call_id
      });
    }

    // Send the updated conversation back to the LLM with streaming
    return this.streamMessageWithTools(updatedMessages, functions, onChunk, onToolCall);
  }

  /**
   * Refresh configuration from config manager
   */
  protected refreshConfig(): void {
    this.config = configManager.getConfig();
  }

  /**
   * Test connection implementation that can be overridden by providers
   */
  protected async testConnection(): Promise<void> {
    // Default implementation - providers can override for specific testing
    logger.debug(`${this.getProviderName()} connection test - using default implementation`, {}, this.getProviderName());
  }

  /**
   * Get provider-specific configuration section
   */
  protected getProviderConfig(): any {
    const providerName = this.getProviderName();
    return this.config[providerName] || {};
  }

  /**
   * Validate API key for the provider
   */
  protected validateApiKey(apiKey: string | undefined, keyName: string): boolean {
    if (!apiKey) {
      logger.error(`${keyName} not configured for ${this.getProviderName()} provider`, new Error(`Missing ${keyName}`), {}, this.getProviderName());
      return false;
    }
    return true;
  }
}