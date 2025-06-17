// Mock child_process execSync for createSystemMessage
jest.mock('child_process', () => ({ execSync: jest.fn() }));
import { execSync } from 'child_process';

// Mock OpenAI client
const mockModelsList = jest.fn();
const mockChatCreate = jest.fn();
jest.mock('openai', () => {
  return class {
    models = { list: mockModelsList };
    chat = { completions: { create: mockChatCreate } };
  };
});

// Mock Anthropic provider
const mockAnthropicInitialize = jest.fn();
const mockAnthropicIsReady = jest.fn();
const mockAnthropicSendMessageRemovedWithTools = jest.fn();
const mockAnthropicSendMessageRemovedWithToolsStream = jest.fn();

jest.mock('./providers/AnthropicProvider', () => ({
  AnthropicProvider: jest.fn().mockImplementation(() => ({
    initialize: mockAnthropicInitialize,
    isReady: mockAnthropicIsReady,
    sendMessageWithTools: mockAnthropicSendMessageRemovedWithTools,
    streamMessageWithTools: mockAnthropicSendMessageRemovedWithToolsStream
  }))
}));

// Mock ToolLogger
const mockLogToolCall = jest.fn();
jest.mock('../utils/toolLogger', () => ({ ToolLogger: { logToolCall: mockLogToolCall } }));

import { configManager } from '../core/config';
import {
  LLMService,
  Message,
  FunctionCallResponse,
} from './llm';

describe('LLMService', () => {
  let service: LLMService;

  beforeEach(() => {
    service = new LLMService();
    mockModelsList.mockReset();
    mockChatCreate.mockReset();
    mockLogToolCall.mockClear();
    mockAnthropicInitialize.mockReset();
    mockAnthropicIsReady.mockReset();
    mockAnthropicSendMessageRemovedWithTools.mockReset();
    mockAnthropicSendMessageRemovedWithToolsStream.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockModelsList.mockReset();
    mockChatCreate.mockReset();
    mockAnthropicInitialize.mockReset();
    mockAnthropicIsReady.mockReset();
    mockAnthropicSendMessageRemovedWithTools.mockReset();
    mockAnthropicSendMessageRemovedWithToolsStream.mockReset();
  });

  describe('initialize', () => {
    it('returns true and sets service ready when OpenAI API key present and connection succeeds', async () => {
      jest.spyOn(configManager, 'getConfig').mockReturnValue({
        openaiApiKey: 'key',
        provider: 'openai'
      } as any);
      mockModelsList.mockResolvedValue({});
      const result = await service.initialize();
      expect(result).toBe(true);
      expect(service.isReady()).toBe(true);
    });

    it('returns true and sets service ready when Anthropic API key present and connection succeeds', async () => {
      jest.spyOn(configManager, 'getConfig').mockReturnValue({
        anthropicApiKey: 'sk-ant-key',
        provider: 'anthropic'
      } as any);
      mockAnthropicInitialize.mockResolvedValue(true);
      mockAnthropicIsReady.mockReturnValue(true);

      const result = await service.initialize();
      expect(result).toBe(true);
      expect(service.isReady()).toBe(true);
      expect(mockAnthropicInitialize).toHaveBeenCalled();
    });

    it('returns false when OpenAI API key is missing', async () => {
      jest.spyOn(configManager, 'getConfig').mockReturnValue({ provider: 'openai' } as any);
      const result = await service.initialize();
      expect(result).toBe(false);
      expect(service.isReady()).toBe(false);
    });

    it('returns false when Anthropic initialization fails', async () => {
      jest.spyOn(configManager, 'getConfig').mockReturnValue({
        anthropicApiKey: 'sk-ant-key',
        provider: 'anthropic'
      } as any);
      mockAnthropicInitialize.mockResolvedValue(false);

      const result = await service.initialize();
      expect(result).toBe(false);
      expect(service.isReady()).toBe(false);
    });

    it('defaults to OpenAI when no provider is specified', async () => {
      jest.spyOn(configManager, 'getConfig').mockReturnValue({ openaiApiKey: 'key' } as any);
      mockModelsList.mockResolvedValue({});

      const result = await service.initialize();
      expect(result).toBe(true);
      expect(service.getCurrentProvider()).toBeTruthy();
    });

    it('returns false when no API key', async () => {
      jest.spyOn(configManager, 'getConfig').mockReturnValue({} as any);
      const result = await service.initialize();
      expect(result).toBe(false);
      expect(service.isReady()).toBe(false);
    });
  });

  describe('message methods without initialization', () => {
    it('sendMessageWithTools throws when not initialized', async () => {
      await expect(service.sendMessageWithTools([])).rejects.toThrow(
        'LLM service not initialized'
      );
    });
  });



  describe('provider delegation', () => {

    it('delegates sendMessageWithTools to Anthropic when configured', async () => {
      jest
        .spyOn(configManager, 'getConfig')
        .mockReturnValue({ anthropicApiKey: 'sk-ant-key', provider: 'anthropic' } as any);
      mockAnthropicInitialize.mockResolvedValue(true);
      mockAnthropicSendMessageRemovedWithTools.mockResolvedValue({
        content: 'tool response',
        tool_calls: [],
        finishReason: 'stop'
      });

      await service.initialize();
      const functions = [{ name: 'test_tool' }];
      const onToolCall = jest.fn();
      const res = await service.sendMessageWithTools([{ role: 'user', content: 'hi' }], functions, onToolCall);

      expect(res).toEqual({ content: 'tool response', tool_calls: [], finishReason: 'stop' });
      expect(mockAnthropicSendMessageRemovedWithTools).toHaveBeenCalledWith(
        [{ role: 'user', content: 'hi' }],
        functions,
        onToolCall
      );
    });

    it('delegates streamMessageWithTools to Anthropic when configured', async () => {
      jest
        .spyOn(configManager, 'getConfig')
        .mockReturnValue({ anthropicApiKey: 'sk-ant-key', provider: 'anthropic' } as any);
      mockAnthropicInitialize.mockResolvedValue(true);
      mockAnthropicSendMessageRemovedWithTools.mockResolvedValue({
        content: 'streaming tool response',
        tool_calls: [],
        finishReason: 'stop'
      });

      await service.initialize();
      const functions = [{ name: 'test_tool' }];
      const onToolCall = jest.fn();
      const res = await service.sendMessageWithTools([{ role: 'user', content: 'hi' }], functions, onToolCall);

      expect(res).toEqual({ content: 'streaming tool response', tool_calls: [], finishReason: 'stop' });
      expect(mockAnthropicSendMessageRemovedWithTools).toHaveBeenCalledWith(
        [{ role: 'user', content: 'hi' }],
        functions,
        onToolCall
      );
    });
  });

  describe('sendMessageWithTools', () => {
    it('returns content and processes tool calls and logs and invokes callback', async () => {
      jest
        .spyOn(configManager, 'getConfig')
        .mockReturnValue({ openaiApiKey: 'key', model: 'm', maxTokens: 5, logToolUsage: true } as any);
      mockModelsList.mockResolvedValue({});
      await service.initialize();
      const toolCall = { function: { name: 'tool', arguments: '{"foo":42}' } };
      mockChatCreate.mockResolvedValue({
        choices: [
          { message: { content: 'resp', tool_calls: [toolCall] }, finish_reason: 'stop' },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      } as any);

      const onToolCall = jest.fn();
      const resp = await service.sendMessageWithTools(
        [{ role: 'user', content: 'hi' }],
        [{ name: 'tool', description: 'test tool', parameters: { type: 'object' } }],
        onToolCall
      );
      expect(resp.content).toBe('resp');
      expect(resp.finishReason).toBe('stop');
      expect(resp.usage).toEqual({ promptTokens: 1, completionTokens: 2, totalTokens: 3 });
      expect(onToolCall).toHaveBeenCalledWith('tool', { foo: 42 });
      expect(mockLogToolCall).toHaveBeenCalledWith('tool', { foo: 42 });
    });

    it('handles invalid JSON tool args gracefully', async () => {
      jest
        .spyOn(configManager, 'getConfig')
        .mockReturnValue({ openaiApiKey: 'key', model: 'm', maxTokens: 5, logToolUsage: false } as any);
      mockModelsList.mockResolvedValue({});
      await service.initialize();
      const toolCall = { function: { name: 'tool', arguments: 'notjson' } };
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: 'resp', tool_calls: [toolCall] }, finish_reason: null }],
      } as any);
      const onToolCall = jest.fn();
      const resp = await service.sendMessageWithTools(
        [{ role: 'user', content: 'hi' }],
        [],
        onToolCall
      );
      expect(onToolCall).toHaveBeenCalledWith('tool', {});
      expect(resp.content).toBe('resp');
      expect(resp.finishReason).toBeNull();
      expect(resp.usage).toBeUndefined();
    });
  });

  describe('provider methods', () => {
    it('isReady returns correct status', async () => {
      expect(service.isReady()).toBe(false);
      
      jest.spyOn(configManager, 'getConfig').mockReturnValue({
        anthropicApiKey: 'sk-ant-key',
        provider: 'anthropic'
      } as any);
      mockAnthropicInitialize.mockResolvedValue(true);
      mockAnthropicIsReady.mockReturnValue(true);

      await service.initialize();
      expect(service.isReady()).toBe(true);
    });
  });
});
