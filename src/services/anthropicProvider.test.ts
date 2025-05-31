// Mock Anthropic SDK
const mockMessagesCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  return class {
    messages = { create: mockMessagesCreate };
  };
});

// Mock ToolLogger
const mockLogToolCall = jest.fn();
jest.mock('../utils/toolLogger', () => ({ ToolLogger: { logToolCall: mockLogToolCall } }));

import { configManager } from '../core/config';
import { AnthropicProvider } from './anthropicProvider';
import { Message, StreamingResponse, FunctionCallResponse } from './llm';

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    provider = new AnthropicProvider();
    mockMessagesCreate.mockReset();
    mockLogToolCall.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockMessagesCreate.mockReset();
  });

  describe('initialize', () => {
    it('returns true and sets provider ready when API key present and connection succeeds', async () => {
      jest.spyOn(configManager, 'getConfig').mockReturnValue({ anthropicApiKey: 'sk-ant-key' } as any);
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Hi' }],
        stop_reason: 'end_turn'
      });
      
      const result = await provider.initialize();
      expect(result).toBe(true);
      expect(provider.isReady()).toBe(true);
    });

    it('returns false when API key is missing', async () => {
      jest.spyOn(configManager, 'getConfig').mockReturnValue({} as any);
      
      const result = await provider.initialize();
      expect(result).toBe(false);
      expect(provider.isReady()).toBe(false);
    });

    it('returns false when connection test fails', async () => {
      jest.spyOn(configManager, 'getConfig').mockReturnValue({ anthropicApiKey: 'sk-ant-key' } as any);
      mockMessagesCreate.mockRejectedValue(new Error('API Error'));
      
      const result = await provider.initialize();
      expect(result).toBe(false);
      expect(provider.isReady()).toBe(false);
    });
  });

  describe('sendMessage', () => {
    beforeEach(async () => {
      jest.spyOn(configManager, 'getConfig').mockReturnValue({ 
        anthropicApiKey: 'sk-ant-key',
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 4000
      } as any);
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Hi' }],
        stop_reason: 'end_turn'
      });
      await provider.initialize();
    });

    it('sends a simple message and returns response', async () => {
      const messages: Message[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' }
      ];

      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Hello! How can I help you today?' }],
        stop_reason: 'end_turn'
      });

      const result = await provider.sendMessage(messages);
      
      expect(result).toBe('Hello! How can I help you today?');
      expect(mockMessagesCreate).toHaveBeenCalledWith({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        system: 'You are a helpful assistant.',
        messages: [{ role: 'user', content: 'Hello' }]
      });
    });

    it('throws error when provider not initialized', async () => {
      const uninitializedProvider = new AnthropicProvider();
      const messages: Message[] = [{ role: 'user', content: 'Hello' }];

      await expect(uninitializedProvider.sendMessage(messages)).rejects.toThrow(
        'Anthropic service not initialized. Run setup first.'
      );
    });
  });

  describe('sendMessageWithTools', () => {
    beforeEach(async () => {
      jest.spyOn(configManager, 'getConfig').mockReturnValue({ 
        anthropicApiKey: 'sk-ant-key',
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 4000,
        logToolUsage: true
      } as any);
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Hi' }],
        stop_reason: 'end_turn'
      });
      await provider.initialize();
    });

    it('handles tool calls correctly', async () => {
      const messages: Message[] = [{ role: 'user', content: 'What files are in the current directory?' }];
      const functions = [
        {
          name: 'list_files',
          description: 'List files in a directory',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Directory path' }
            }
          }
        }
      ];

      mockMessagesCreate.mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            id: 'call_123',
            name: 'list_files',
            input: { path: '.' }
          }
        ],
        stop_reason: 'tool_use',
        usage: { input_tokens: 100, output_tokens: 50 }
      });

      const onToolCall = jest.fn();
      const result = await provider.sendMessageWithTools(messages, functions, onToolCall);

      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls![0]).toEqual({
        id: 'call_123',
        type: 'function',
        function: {
          name: 'list_files',
          arguments: JSON.stringify({ path: '.' })
        }
      });
      expect(result.usage).toEqual({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150
      });
      
      expect(onToolCall).toHaveBeenCalledWith('list_files', { path: '.' });
      expect(mockLogToolCall).toHaveBeenCalledWith('list_files', { path: '.' });
    });
  });

  describe('message conversion', () => {
    it('converts messages correctly', async () => {
      jest.spyOn(configManager, 'getConfig').mockReturnValue({ 
        anthropicApiKey: 'sk-ant-key',
        model: 'claude-3-5-sonnet-20241022'
      } as any);
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Hi' }],
        stop_reason: 'end_turn'
      });
      await provider.initialize();

      const messages: Message[] = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'User message' },
        { role: 'assistant', content: 'Assistant response' },
        { role: 'tool', content: 'Tool result', tool_call_id: 'call_123' },
        { role: 'user', content: 'Follow up' }
      ];

      await provider.sendMessage(messages);

      expect(mockMessagesCreate).toHaveBeenCalledWith({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        system: 'System prompt',
        messages: [
          { role: 'user', content: 'User message' },
          { role: 'assistant', content: 'Assistant response' },
          { role: 'user', content: 'Tool result' },
          { role: 'user', content: 'Follow up' }
        ]
      });
    });
  });
});
