import { Message } from '../types/llm';
import { Config } from '../core/config';
import { Logger } from '../utils/logger';

export interface CacheBreakpoint {
  position: number;
  type: 'tools' | 'system' | 'conversation' | 'custom';
}

export interface CachingStrategy {
  name: 'aggressive' | 'conservative' | 'custom';
  breakpoints: CacheBreakpoint[];
  enabled: boolean;
}

export class PromptCachingService {
  private logger: Logger = Logger.getInstance();
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Apply cache control to messages based on configuration
   */
  applyCacheControl(
    messages: Message[],
    tools?: any[],
    systemMessage?: string
  ): {
    messages: Message[];
    tools?: any[];
    systemMessages?: Array<{ type: 'text'; text: string; cache_control?: any }>;
    breakpoints: CacheBreakpoint[]
  } {
    if (!this.config.enablePromptCaching || this.config.provider !== 'anthropic' || !this.isModelSupported()) {
      return { messages, tools, breakpoints: [] };
    }

    if (messages.length === 0) {
      return { messages, tools, breakpoints: [] };
    }

    // Simple approach: just add cache control to the last message
    const processedMessages = [...messages];
    const lastIndex = processedMessages.length - 1;

    processedMessages[lastIndex] = {
      ...processedMessages[lastIndex],
      cache_control: { type: 'ephemeral' }
    };

    const breakpoints: CacheBreakpoint[] = [
      { position: lastIndex, type: 'conversation' }
    ];

    this.logger.debug('Applied cache control to last message', {
      messagesCount: messages.length,
      lastMessageIndex: lastIndex
    });

    return {
      messages: processedMessages,
      tools,
      systemMessages: systemMessage ? [{ type: 'text', text: systemMessage }] : undefined,
      breakpoints
    };
  }

  /**
   * Check if prompt caching is available for the current provider
   */
  isAvailable(): boolean {
    return this.config.provider === 'anthropic' && this.config.enablePromptCaching === true;
  }

  /**
   * Get minimum token requirement for current model
   */
  getMinimumTokens(): number {
    if (!this.config.model) return 1024;

    // Haiku models require 2048 tokens minimum
    if (this.config.model.includes('haiku')) {
      return 2048;
    }

    // All other Claude models require 1024 tokens minimum
    return 1024;
  }

  /**
   * Estimate token count for text (rough approximation: 1 token ≈ 4 characters)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Get supported models for prompt caching
   */
  getSupportedModels(): string[] {
    return [
      'claude-opus-4-20250514',
      'claude-sonnet-4-20250514',
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-haiku-20240307'
    ];
  }

  /**
   * Validate if current model supports prompt caching
   */
  isModelSupported(): boolean {
    if (!this.config.model) {
      return false;
    }
    return this.getSupportedModels().includes(this.config.model);
  }

  /**
   * Extract cache usage information from API response
   */
  extractCacheUsage(usage: any): any {
    if (!usage) {
      return undefined;
    }

    const cacheUsage: any = {};

    if (usage.cache_creation_input_tokens) {
      cacheUsage.cache_creation_input_tokens = usage.cache_creation_input_tokens;
    }

    if (usage.cache_read_input_tokens) {
      cacheUsage.cache_read_input_tokens = usage.cache_read_input_tokens;
    }

    if (usage.cache_creation) {
      cacheUsage.cache_creation = usage.cache_creation;
    }

    return Object.keys(cacheUsage).length > 0 ? cacheUsage : undefined;
  }
}
