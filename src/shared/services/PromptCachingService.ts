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
    if (!this.config.enablePromptCaching || this.config.provider !== 'anthropic') {
      return { messages, tools, breakpoints: [] };
    }

    const strategy = this.getStrategy();
    const breakpoints: CacheBreakpoint[] = [];
    let processedMessages = [...messages];
    let processedTools = tools ? [...tools] : undefined;
    let systemMessages: Array<{ type: 'text'; text: string; cache_control?: any }> | undefined;

    // Handle system message caching
    if (systemMessage && this.config.cacheSystemPrompts && this.meetsMinimumTokens(systemMessage)) {
      systemMessages = [
        {
          type: 'text',
          text: systemMessage,
          cache_control: { type: 'ephemeral' }
        }
      ];
      breakpoints.push({ position: 0, type: 'system' });
    } else if (systemMessage) {
      // Include system message without caching if it doesn't meet requirements
      systemMessages = [
        {
          type: 'text',
          text: systemMessage
        }
      ];
    }

    // Handle tool definition caching
    if (processedTools && this.config.cacheToolDefinitions && processedTools.length > 0) {
      // Estimate tokens for all tools combined
      const toolsText = JSON.stringify(processedTools);
      if (this.meetsMinimumTokens(toolsText)) {
        const lastToolIndex = processedTools.length - 1;
        processedTools[lastToolIndex] = {
          ...processedTools[lastToolIndex],
          cache_control: { type: 'ephemeral' }
        };
        breakpoints.push({ position: 1, type: 'tools' });
      }
    } else if (!this.config.cacheToolDefinitions && processedTools) {
      // Don't modify tools if caching is disabled for them
      processedTools = undefined;
    }

    // Apply caching strategy to messages
    if (this.config.cacheConversationHistory) {
      processedMessages = this.applyCachingStrategy(processedMessages, strategy);

      // Find conversation breakpoints
      processedMessages.forEach((msg, index) => {
        if (msg.cache_control) {
          breakpoints.push({
            position: index + 2, // After tools and system
            type: 'conversation'
          });
        }
      });
    }

    this.logCacheStrategy(breakpoints);

    return {
      messages: processedMessages,
      tools: processedTools,
      systemMessages,
      breakpoints
    };
  }

  /**
   * Get caching strategy based on configuration
   */
  private getStrategy(): CachingStrategy {
    const strategyName = this.config.promptCachingStrategy || 'aggressive';

    switch (strategyName) {
      case 'aggressive':
        return {
          name: 'aggressive',
          enabled: true,
          breakpoints: [
            { position: 0, type: 'tools' },
            { position: 1, type: 'system' },
            { position: -2, type: 'conversation' } // Second to last message
          ]
        };

      case 'conservative':
        return {
          name: 'conservative',
          enabled: true,
          breakpoints: [
            { position: 0, type: 'system' },
            { position: -1, type: 'conversation' } // Last message only
          ]
        };

      default:
        return {
          name: 'custom',
          enabled: true,
          breakpoints: []
        };
    }
  }

  /**
   * Apply caching strategy to conversation messages
   */
  private applyCachingStrategy(messages: Message[], strategy: CachingStrategy): Message[] {
    if (!strategy.enabled || strategy.breakpoints.length === 0) {
      return messages;
    }

    const processed = [...messages];

    for (const breakpoint of strategy.breakpoints) {
      if (breakpoint.type === 'conversation') {
        const index = this.resolveMessageIndex(breakpoint.position, processed.length);
        if (index >= 0 && index < processed.length) {
          const messageContent = processed[index].content || '';
          if (typeof messageContent === 'string' && this.meetsMinimumTokens(messageContent)) {
            processed[index] = {
              ...processed[index],
              cache_control: {
                type: 'ephemeral' as const
              }
            };
          }
        }
      }
    }

    return processed;
  }

  /**
   * Resolve negative indices for message positioning
   */
  private resolveMessageIndex(position: number, messageCount: number): number {
    if (position >= 0) {
      return position;
    }
    return messageCount + position;
  }

  /**
   * Extract cache usage information from API response
   */
  extractCacheUsage(usage: any): any {
    if (!usage) return undefined;

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

  /**
   * Calculate cache efficiency metrics
   */
  calculateCacheEfficiency(usage: any): {
    hitRatio: number;
    costSavings: number;
    latencyImprovement: number;
  } {
    if (!usage) {
      return { hitRatio: 0, costSavings: 0, latencyImprovement: 0 };
    }

    const cacheReads = usage.cache_read_input_tokens || 0;
    const cacheCreation = usage.cache_creation_input_tokens || 0;
    const totalCacheTokens = cacheReads + cacheCreation;

    const hitRatio = totalCacheTokens > 0 ? cacheReads / totalCacheTokens : 0;

    // Approximate cost savings (cache reads are ~10% of normal cost)
    const costSavings = cacheReads * 0.9;

    // Approximate latency improvement (cache reads are ~85% faster)
    const latencyImprovement = cacheReads * 0.85;

    return { hitRatio, costSavings, latencyImprovement };
  }

  /**
   * Log caching strategy for debugging
   */
  private logCacheStrategy(breakpoints: CacheBreakpoint[]): void {
    if (this.config.verbose && breakpoints.length > 0) {
      this.logger.debug('Prompt caching applied', {
        strategy: this.config.promptCachingStrategy,
        breakpoints: breakpoints.map(bp => ({
          position: bp.position,
          type: bp.type
        }))
      });
    }
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
   * Check if content meets minimum token requirements for caching
   */
  private meetsMinimumTokens(content: string): boolean {
    const estimatedTokens = this.estimateTokens(content);
    const minimumTokens = this.getMinimumTokens();
    return estimatedTokens >= minimumTokens;
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
    if (!this.config.model) return false;
    return this.getSupportedModels().includes(this.config.model);
  }
}
