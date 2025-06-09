import { PromptCachingService, CacheBreakpoint, CachingStrategy } from '../services/PromptCachingService';
import { Message } from '../types/llm';
import { Config } from '../core/config';

describe('PromptCachingService', () => {
  let cachingService: PromptCachingService;
  let mockConfig: Config;

  beforeEach(() => {
    mockConfig = {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      enablePromptCaching: true,
      promptCachingStrategy: 'aggressive',
      cacheSystemPrompts: true,
      cacheToolDefinitions: true,
      cacheConversationHistory: true,
      cacheTTL: '1h'
    };

    cachingService = new PromptCachingService(mockConfig);
  });

  describe('isAvailable', () => {
    it('should return true for Anthropic provider with caching enabled', () => {
      expect(cachingService.isAvailable()).toBe(true);
    });

    it('should return false for non-Anthropic providers', () => {
      mockConfig.provider = 'openai';
      cachingService = new PromptCachingService(mockConfig);
      expect(cachingService.isAvailable()).toBe(false);
    });

    it('should return false when caching is disabled', () => {
      mockConfig.enablePromptCaching = false;
      cachingService = new PromptCachingService(mockConfig);
      expect(cachingService.isAvailable()).toBe(false);
    });
  });

  describe('isModelSupported', () => {
    it('should return true for supported Claude models', () => {
      const supportedModels = [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229'
      ];

      supportedModels.forEach(model => {
        mockConfig.model = model;
        cachingService = new PromptCachingService(mockConfig);
        expect(cachingService.isModelSupported()).toBe(true);
      });
    });

    it('should return false for unsupported models', () => {
      mockConfig.model = 'gpt-4';
      cachingService = new PromptCachingService(mockConfig);
      expect(cachingService.isModelSupported()).toBe(false);
    });
  });

  describe('applyCacheControl', () => {
    const sampleMessages: Message[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'How are you?' }
    ];

    const sampleTools = [
      {
        name: 'read_file',
        description: 'Read a file',
        parameters: { type: 'object', properties: { path: { type: 'string' } } }
      },
      {
        name: 'write_file',
        description: 'Write a file',
        parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } }
      }
    ];

    it('should apply caching to system messages', () => {
      const result = cachingService.applyCacheControl(
        sampleMessages,
        sampleTools,
        'You are a helpful assistant.'
      );

      expect(result.systemMessages).toBeDefined();
      expect(result.systemMessages![0]).toEqual({
        type: 'text',
        text: 'You are a helpful assistant.',
        cache_control: { type: 'ephemeral', ttl: '1h' }
      });
    });

    it('should apply caching to tool definitions', () => {
      const result = cachingService.applyCacheControl(
        sampleMessages,
        sampleTools,
        'System prompt'
      );

      expect(result.tools).toBeDefined();
      expect(result.tools![result.tools!.length - 1].cache_control).toEqual({
        type: 'ephemeral',
        ttl: '1h'
      });
    });

    it('should apply aggressive caching strategy', () => {
      mockConfig.promptCachingStrategy = 'aggressive';
      cachingService = new PromptCachingService(mockConfig);

      const result = cachingService.applyCacheControl(
        sampleMessages,
        sampleTools,
        'System prompt'
      );

      // Should have cache breakpoints for system, tools, and conversation
      expect(result.breakpoints.length).toBeGreaterThan(0);

      const breakpointTypes = result.breakpoints.map(bp => bp.type);
      expect(breakpointTypes).toContain('system');
      expect(breakpointTypes).toContain('tools');
    });

    it('should apply conservative caching strategy', () => {
      mockConfig.promptCachingStrategy = 'conservative';
      cachingService = new PromptCachingService(mockConfig);

      const result = cachingService.applyCacheControl(
        sampleMessages,
        sampleTools,
        'System prompt'
      );

      // Conservative should have fewer breakpoints
      const breakpointTypes = result.breakpoints.map(bp => bp.type);
      expect(breakpointTypes).toContain('system');
    });

    it('should not apply caching when disabled', () => {
      mockConfig.enablePromptCaching = false;
      cachingService = new PromptCachingService(mockConfig);

      const result = cachingService.applyCacheControl(
        sampleMessages,
        sampleTools,
        'System prompt'
      );

      expect(result.breakpoints).toEqual([]);
      expect(result.systemMessages).toBeUndefined();
    });

    it('should not apply caching for non-Anthropic providers', () => {
      mockConfig.provider = 'openai';
      cachingService = new PromptCachingService(mockConfig);

      const result = cachingService.applyCacheControl(
        sampleMessages,
        sampleTools,
        'System prompt'
      );

      expect(result.breakpoints).toEqual([]);
    });

    it('should respect individual caching settings', () => {
      mockConfig.cacheSystemPrompts = false;
      mockConfig.cacheToolDefinitions = false;
      cachingService = new PromptCachingService(mockConfig);

      const result = cachingService.applyCacheControl(
        sampleMessages,
        sampleTools,
        'System prompt'
      );

      expect(result.systemMessages).toBeUndefined();
      expect(result.tools).toBeUndefined();
    });
  });

  describe('extractCacheUsage', () => {
    it('should extract cache usage from Anthropic response', () => {
      const usage = {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 20,
        cache_read_input_tokens: 30
      };

      const result = cachingService.extractCacheUsage(usage);

      expect(result).toEqual({
        cache_creation_input_tokens: 20,
        cache_read_input_tokens: 30
      });
    });

    it('should return undefined for usage without cache data', () => {
      const usage = {
        input_tokens: 100,
        output_tokens: 50
      };

      const result = cachingService.extractCacheUsage(usage);
      expect(result).toBeUndefined();
    });
  });

  describe('calculateCacheEfficiency', () => {
    it('should calculate cache efficiency metrics', () => {
      const usage = {
        cache_creation_input_tokens: 100,
        cache_read_input_tokens: 200
      };

      const result = cachingService.calculateCacheEfficiency(usage);

      expect(result.hitRatio).toBe(200 / 300); // 200 reads out of 300 total
      expect(result.costSavings).toBe(200 * 0.9); // 90% savings on reads
      expect(result.latencyImprovement).toBe(200 * 0.85); // 85% improvement on reads
    });

    it('should handle zero cache usage', () => {
      const result = cachingService.calculateCacheEfficiency(undefined);

      expect(result.hitRatio).toBe(0);
      expect(result.costSavings).toBe(0);
      expect(result.latencyImprovement).toBe(0);
    });
  });

  describe('getSupportedModels', () => {
    it('should return list of supported models', () => {
      const models = cachingService.getSupportedModels();

      expect(models).toContain('claude-3-5-sonnet-20241022');
      expect(models).toContain('claude-3-5-haiku-20241022');
      expect(models).toContain('claude-3-opus-20240229');
      expect(models.length).toBeGreaterThan(5);
    });
  });
});

describe('PromptCachingService Integration', () => {
  let cachingService: PromptCachingService;

  beforeEach(() => {
    const config: Config = {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      enablePromptCaching: true,
      promptCachingStrategy: 'aggressive',
      cacheSystemPrompts: true,
      cacheToolDefinitions: true,
      cacheConversationHistory: true,
      cacheTTL: '1h'
    };

    cachingService = new PromptCachingService(config);
  });

  it('should handle complex conversation with tools', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Read the package.json file' },
      {
        role: 'assistant',
        content: 'I\'ll read the package.json file for you.',
        tool_calls: [{
          id: 'call_1',
          type: 'function',
          function: { name: 'read_file', arguments: '{"path": "package.json"}' }
        }]
      },
      {
        role: 'tool',
        content: '{"name": "coding-agent", "version": "1.0.0"}',
        tool_call_id: 'call_1'
      },
      { role: 'user', content: 'Now analyze the dependencies' }
    ];

    const tools = [
      {
        name: 'read_file',
        description: 'Read a file',
        parameters: { type: 'object', properties: { path: { type: 'string' } } }
      }
    ];

    const result = cachingService.applyCacheControl(
      messages,
      tools,
      'You are a helpful coding assistant.'
    );

    expect(result.breakpoints.length).toBeGreaterThan(0);
    expect(result.systemMessages).toBeDefined();
    expect(result.tools).toBeDefined();

    // Verify cache control is applied to messages
    const hasMessageWithCache = result.messages.some(msg => msg.cache_control);
    expect(hasMessageWithCache).toBe(true);
  });

  it('should handle TTL configuration', () => {
    const config: Config = {
      provider: 'anthropic',
      enablePromptCaching: true,
      cacheTTL: '5m'
    };

    cachingService = new PromptCachingService(config);

    const result = cachingService.applyCacheControl(
      [{ role: 'user', content: 'test' }],
      [],
      'System prompt'
    );

    expect(result.systemMessages![0].cache_control.ttl).toBe('5m');
  });
});
