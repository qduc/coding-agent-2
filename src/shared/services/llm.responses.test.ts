/**
 * OpenAI Responses API Integration Test
 *
 * This test verifies the Responses API integration for reasoning models.
 * The Responses API provides significant benefits for reasoning models:
 *
 * 1. **Better Performance**: Optimized for reasoning models (o1, o3, o4-mini series)
 * 2. **Improved Caching**: Up to 80% cache utilization vs 40% with Chat Completions
 * 3. **Reasoning Token Management**: Proper handling of reasoning tokens in multi-turn conversations
 * 4. **Encrypted Reasoning Items**: Support for stateless usage with encrypted reasoning content
 * 5. **Reasoning Summaries**: Transparency into the reasoning process
 *
 * @see https://platform.openai.com/docs/guides/responses
 */

import { llmService } from './llm';
import { configManager } from '../core/config';

describe('OpenAI Responses API Integration', () => {
  beforeAll(async () => {
    // Initialize LLM service
    await llmService.initialize();
  });

  beforeEach(() => {
    // Reset conversation state before each test
    llmService.resetConversationState();
  });

  describe('Reasoning Model Detection', () => {
    it('should detect o1 models as reasoning models', () => {
      // Test o1 series models
      expect(llmService['isReasoningModel']('o1')).toBe(true);
      expect(llmService['isReasoningModel']('o1-preview')).toBe(true);
      expect(llmService['isReasoningModel']('o1-mini')).toBe(true);
    });

    it('should detect o3 models as reasoning models', () => {
      // Test o3 series models
      expect(llmService['isReasoningModel']('o3')).toBe(true);
      expect(llmService['isReasoningModel']('o3-mini')).toBe(true);
      expect(llmService['isReasoningModel']('o3-2025-01-15')).toBe(true);
    });

    it('should detect o4 models as reasoning models', () => {
      // Test o4 series models
      expect(llmService['isReasoningModel']('o4')).toBe(true);
      expect(llmService['isReasoningModel']('o4-mini')).toBe(true);
      expect(llmService['isReasoningModel']('o4-mini-2025-04-16')).toBe(true);
    });

    it('should not detect regular models as reasoning models', () => {
      // Test regular models
      expect(llmService['isReasoningModel']('gpt-4o')).toBe(false);
      expect(llmService['isReasoningModel']('gpt-4-turbo')).toBe(false);
      expect(llmService['isReasoningModel']('gpt-3.5-turbo')).toBe(false);
    });
  });

  describe('Responses API Usage', () => {
    it('should use Responses API for reasoning models', async () => {
      // Mock reasoning model
      const originalModel = configManager.getConfig().model;
      await configManager.saveConfig({ model: 'o3-mini' });

      expect(llmService['shouldUseResponsesApi']()).toBe(true);
      expect(llmService.isUsingReasoningModel()).toBe(true);
      expect(llmService.isResponsesApiEnabled()).toBe(true);

      // Restore original model
      await configManager.saveConfig({ model: originalModel });
    });

    it('should use Chat Completions API for regular models by default', async () => {
      // Mock regular model
      const originalModel = configManager.getConfig().model;
      await configManager.saveConfig({ model: 'gpt-4o', useResponsesApi: false });

      expect(llmService['shouldUseResponsesApi']()).toBe(false);
      expect(llmService.isUsingReasoningModel()).toBe(false);
      expect(llmService.isResponsesApiEnabled()).toBe(false);

      // Restore original model
      await configManager.saveConfig({ model: originalModel });
    });

    it('should force Responses API when configured', async () => {
      // Mock forced Responses API
      const originalConfig = {
        model: configManager.getConfig().model,
        useResponsesApi: configManager.getConfig().useResponsesApi
      };
      await configManager.saveConfig({ model: 'gpt-4o', useResponsesApi: true });

      expect(llmService['shouldUseResponsesApi']()).toBe(true);
      expect(llmService.isResponsesApiEnabled()).toBe(true);

      // Restore original config
      await configManager.saveConfig(originalConfig);
    });
  });

  describe('Message Conversion', () => {
    it('should convert messages to Responses API input format', () => {
      const messages = [
        { role: 'system' as const, content: 'You are a helpful assistant.' },
        { role: 'user' as const, content: 'Hello!' },
        { role: 'assistant' as const, content: 'Hi there!' }
      ];

      const converted = llmService['convertMessagesToResponsesInput'](messages);

      expect(converted).toEqual([
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi there!' }
      ]);
    });

    it('should preserve tool calls in conversion', () => {
      const messages = [
        {
          role: 'assistant' as const,
          content: null,
          tool_calls: [{
            id: 'call_123',
            type: 'function',
            function: { name: 'test_tool', arguments: '{}' }
          }]
        },
        {
          role: 'tool' as const,
          content: 'Tool result',
          tool_call_id: 'call_123'
        }
      ];

      const converted = llmService['convertMessagesToResponsesInput'](messages);

      expect(converted[0]).toHaveProperty('tool_calls');
      expect(converted[1]).toHaveProperty('tool_call_id');
    });
  });

  describe('Conversation State Management', () => {
    it('should manage conversation state', () => {
      // Initially no conversation
      expect(llmService.getCurrentConversationId()).toBeNull();

      // Reset should work
      llmService.resetConversationState();
      expect(llmService.getCurrentConversationId()).toBeNull();
    });
  });
});

/**
 * Integration Test Examples
 *
 * These examples show how to use the Responses API integration:
 *
 * Example 1: Simple reasoning model usage
 * ```typescript
 * // Configure reasoning model
 * configManager.saveConfig({ model: 'o3-mini' });
 *
 * // Send message - automatically uses Responses API
 * const response = await llmService.sendMessage([
 *   { role: 'user', content: 'Solve this complex problem step by step...' }
 * ]);
 * ```
 *
 * Example 2: Force Responses API for any model
 * ```typescript
 * configManager.saveConfig({
 *   model: 'gpt-4o',
 *   useResponsesApi: true
 * });
 *
 * const response = await llmService.sendMessage([
 *   { role: 'user', content: 'Your message...' }
 * ]);
 * ```
 *
 * Example 3: Multi-turn conversation with reasoning
 * ```typescript
 * configManager.saveConfig({ model: 'o3-mini' });
 *
 * // First message
 * const response1 = await llmService.sendMessage([
 *   { role: 'user', content: 'Start analyzing this data...' }
 * ]);
 *
 * // Follow-up uses previous_response_id automatically
 * const response2 = await llmService.sendMessage([
 *   { role: 'user', content: 'Now apply the analysis to this case...' }
 * ]);
 * ```
 *
 * Example 4: Direct Responses API usage
 * ```typescript
 * const response = await llmService.sendResponsesMessage(
 *   'Complex reasoning task...',
 *   {
 *     model: 'o3-mini',
 *     reasoning: {
 *       effort: 'high',
 *       generate_summary: 'auto'
 *     },
 *     include: ['reasoning.encrypted_content'],
 *     store: true
 *   }
 * );
 * ```
 */
