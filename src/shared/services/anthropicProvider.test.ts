
// Mock Anthropic SDK
const mockMessagesCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  return class {
    messages = { create: mockMessagesCreate };
  };
});

import { AnthropicProvider } from './providers/AnthropicProvider';
import { configManager } from '../core/config';
import { Message, FunctionCallResponse } from './llm';

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;
  let originalConfig: any;

  beforeEach(() => {
    provider = new AnthropicProvider();
    originalConfig = { ...configManager.getConfig() };
    mockMessagesCreate.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockMessagesCreate.mockReset();
    // Restore config
    Object.assign(configManager.getConfig(), originalConfig);
  });

  describe('initialize', () => {
    it('returns false if no API key', async () => {
      jest.spyOn(configManager, 'getConfig').mockReturnValue({});
      const result = await provider.initialize();
      expect(result).toBe(false);
    });

    it('returns true if API key is present and testConnection passes', async () => {
      jest.spyOn(configManager, 'getConfig').mockReturnValue({ anthropicApiKey: 'test-key' });
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Test response' }],
        stop_reason: 'end_turn'
      });
      const result = await provider.initialize();
      expect(result).toBe(true);
    });

    it('returns false if testConnection throws', async () => {
      jest.spyOn(configManager, 'getConfig').mockReturnValue({ anthropicApiKey: 'test-key' });
      mockMessagesCreate.mockRejectedValue(new Error('fail'));
      const result = await provider.initialize();
      expect(result).toBe(false);
    });
  });

  describe('isReady', () => {
    it('returns false if not initialized', () => {
      expect(provider.isReady()).toBe(false);
    });
    it('returns true after successful initialize', async () => {
      jest.spyOn(configManager, 'getConfig').mockReturnValue({ anthropicApiKey: 'test-key' });
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Test response' }],
        stop_reason: 'end_turn'
      });
      await provider.initialize();
      expect(provider.isReady()).toBe(true);
    });
  });

  describe('convertMessages', () => {
    it('converts user, assistant, and tool messages', () => {
      // @ts-ignore
      const result = provider['convertMessages']([
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
        { role: 'tool', content: 'result', tool_call_id: 'id1' },
        { role: 'assistant', content: 'foo', tool_calls: [ { id: 'tid', function: { name: 'f', arguments: '{"a":1}' } } ] }
      ]);
      expect(result).toEqual([
        { role: 'user', content: [{ type: 'text', text: 'hi' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'hello' }] },
        { role: 'user', content: [ { type: 'tool_result', tool_use_id: 'id1', content: 'result' } ] },
        { role: 'assistant', content: [ { type: 'text', text: 'foo' }, { type: 'tool_use', id: 'tid', name: 'f', input: { a: 1 } } ] }
      ]);
    });
  });

  describe('extractSystemMessage', () => {
    it('returns system message content', () => {
      // @ts-ignore
      const result = provider['extractSystemMessage']([
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hi' }
      ]);
      expect(result).toBe('sys');
    });
    it('returns empty string if no system message', () => {
      // @ts-ignore
      const result = provider['extractSystemMessage']([
        { role: 'user', content: 'hi' }
      ]);
      expect(result).toBe('');
    });
  });


  describe('sendMessageWithTools', () => {
    it('returns content and tool_calls', async () => {
      jest.spyOn(provider, 'isReady').mockReturnValue(true);
      jest.spyOn(configManager, 'getConfig').mockReturnValue({});
      provider['anthropic'] = {
        messages: {
          create: jest.fn().mockResolvedValue({
            content: [
              { type: 'text', text: 'foo' },
              { type: 'tool_use', id: 'tid', name: 'f', input: { a: 1 } }
            ],
            stop_reason: 'stop',
            usage: { input_tokens: 1, output_tokens: 2 }
          })
        }
      } as any;
      const result = await provider.sendMessageWithTools([
        { role: 'user', content: 'hi' }
      ], [ { name: 'f', description: 'desc', parameters: {} } ]);
      expect(result.content).toBe('foo');
      expect(result.tool_calls).toEqual([
        { id: 'tid', type: 'function', function: { name: 'f', arguments: '{"a":1}' } }
      ]);
      expect(result.finishReason).toBe('stop');
      expect(result.usage).toEqual({ promptTokens: 1, completionTokens: 2, totalTokens: 3 });
    });
  });

  describe('sendToolResults', () => {
    it('calls _sendMessageWithTools with tool results', async () => {
      jest.spyOn(configManager, 'getConfig').mockReturnValue({ anthropicApiKey: 'test-key' });
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Test response' }],
        stop_reason: 'end_turn'
      });
      await provider.initialize();
      
      const spy = jest.spyOn<any, any>(provider, '_sendMessageWithTools').mockResolvedValue({ content: 'ok' } as any);
      const messages = [ { role: 'user', content: 'hi' } as any ];
      const toolResults = [ { tool_call_id: 'id', content: 'result' } ];
      await provider.sendToolResults(messages, toolResults, []);
      expect(spy).toHaveBeenCalledWith([
        { role: 'user', content: 'hi' },
        { role: 'tool', content: 'result', tool_call_id: 'id' }
      ], []);
    });
  });
});
