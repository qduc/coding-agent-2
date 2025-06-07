import { LLMProvider, Message, StreamingResponse, FunctionCallResponse, ResponsesInput, ReasoningConfig, ResponsesApiResponse } from '../types/llm';
import { createProvider } from '../factories/ProviderFactory';

export type { LLMProvider, Message, StreamingResponse, FunctionCallResponse } from '../types/llm';
import { MessageUtils } from '../utils/messageUtils';
import { ToolLoopHandler } from '../handlers/ToolLoopHandler';
import { logger } from '../utils/logger';
import { configManager } from '../core/config';

export class LLMService implements LLMProvider {
  private provider: LLMProvider | null = null;
  private previousResponseId: string | undefined;
  private openai: any = null;

  /**
   * Initialize the LLM service using the appropriate provider from the factory
   */
  async initialize(): Promise<boolean> {
    try {
      const config = configManager.getConfig();
      const providerName = config.provider || 'openai';
      this.provider = await createProvider(providerName);
      logger.info('LLM service initialized successfully', {}, 'LLMService');
      return true;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Unknown error');
      logger.error('Failed to initialize LLM service', errorObj, {}, 'LLMService');
      return false;
    }
  }

  /**
   * Check if the LLM service is ready for use
   */
  isReady(): boolean {
    return this.provider !== null;
  }

  /**
   * Get the current provider instance
   */
  getCurrentProvider(): LLMProvider | null {
    return this.provider;
  }

  /**
   * Get the provider name
   */
  getProviderName(): string {
    if (!this.provider) {
      throw new Error('LLM service not initialized');
    }
    return this.provider.getProviderName();
  }

  /**
   * Stream a message and call onChunk for each chunk
   */
  async streamMessage(
    messages: Message[],
    onChunk: (chunk: string) => void,
    onComplete?: (response: StreamingResponse) => void
  ): Promise<StreamingResponse> {
    if (!this.provider) {
      throw new Error('LLM service not initialized');
    }
    return this.provider.streamMessage(messages, onChunk, onComplete);
  }

  /**
   * Send a message and return the complete response
   */
  async sendMessage(messages: Message[]): Promise<string> {
    if (!this.provider) {
      throw new Error('LLM service not initialized');
    }
    return this.provider.sendMessage(messages);
  }

  /**
   * Send a message with tools
   */
  async sendMessageWithTools(
    messages: Message[],
    functions?: any[],
    onToolCall?: (toolName: string, args: any) => void
  ): Promise<FunctionCallResponse> {
    if (!this.provider) {
      throw new Error('LLM service not initialized');
    }
    return this.provider.sendMessageWithTools(messages, functions, onToolCall);
  }

  /**
   * Stream a message with tools
   */
  async streamMessageWithTools(
    messages: Message[],
    functions?: any[],
    onChunk?: (chunk: string) => void,
    onToolCall?: (toolName: string, args: any) => void
  ): Promise<FunctionCallResponse> {
    if (!this.provider) {
      throw new Error('LLM service not initialized');
    }
    return this.provider.streamMessageWithTools(messages, functions, onChunk, onToolCall);
  }

  /**
   * Send tool results
   */
  async sendToolResults(
    messages: Message[],
    toolResults: Array<{ tool_call_id: string; content: string }>,
    functions?: any[]
  ): Promise<FunctionCallResponse> {
    if (!this.provider?.sendToolResults) {
      throw new Error('Provider does not support tool results');
    }
    return this.provider.sendToolResults(messages, toolResults, functions);
  }

  /**
   * Stream tool results
   */
  async streamToolResults(
    messages: Message[],
    toolResults: Array<{ tool_call_id: string; content: string }>,
    functions?: any[],
    onChunk?: (chunk: string) => void,
    onToolCall?: (toolName: string, args: any) => void
  ): Promise<FunctionCallResponse> {
    if (!this.provider?.streamToolResults) {
      throw new Error('Provider does not support streaming tool results');
    }
    return this.provider.streamToolResults(messages, toolResults, functions, onChunk, onToolCall);
  }

  /**
   * Create a user message from input text
   */
  private createUserMessage(content: string): Message {
    return {
      role: 'user',
      content
    };
  }

  /**
   * Process input with native tool loop (continuous conversation)
   */
  async processWithNativeToolLoop(
    userInput: string,
    tools: any[],
    onChunk?: (chunk: string) => void,
    verbose: boolean = false
  ): Promise<string> {
    if (!this.isReady()) {
      throw new Error('LLM service not initialized. Run setup first.');
    }

    // Use the ToolLoopHandler static method
    return ToolLoopHandler.runToolLoop([this.createUserMessage(userInput)], verbose ? 10 : 5, verbose);
  }

  /**
   * Send responses message (for reasoning models)
   */
  async sendResponsesMessage(
    input: string | ResponsesInput[],
    options?: {
      model?: string;
      reasoning?: ReasoningConfig;
      tools?: any[];
      include?: string[];
      store?: boolean;
      previous_response_id?: string;
      instructions?: string;
      temperature?: number;
      max_output_tokens?: number;
    }
  ): Promise<ResponsesApiResponse> {
    if (!this.provider?.sendResponsesMessage) {
      throw new Error('Provider does not support responses API');
    }
    return this.provider.sendResponsesMessage(input, options);
  }

  /**
   * Stream responses message (for reasoning models)
   */
  async streamResponsesMessage(
    input: string | ResponsesInput[],
    options?: {
      model?: string;
      reasoning?: ReasoningConfig;
      tools?: any[];
      include?: string[];
      store?: boolean;
      previous_response_id?: string;
      instructions?: string;
      temperature?: number;
      max_output_tokens?: number;
    },
    onChunk?: (chunk: string) => void
  ): Promise<ResponsesApiResponse> {
    if (!this.provider?.streamResponsesMessage) {
      throw new Error('Provider does not support streaming responses API');
    }
    return this.provider.streamResponsesMessage(input, options, onChunk);
  }
}

// Export singleton instance
export const llmService = new LLMService();
