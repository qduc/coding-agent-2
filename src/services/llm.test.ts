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

// Mock ToolLogger
const mockLogToolCall = jest.fn();
jest.mock('../utils/toolLogger', () => ({ ToolLogger: { logToolCall: mockLogToolCall } }));

import { configManager } from '../core/config';
import {
  LLMService,
  Message,
  StreamingResponse,
  FunctionCallResponse,
} from './llm';

describe('LLMService', () => {
  let service: LLMService;

  beforeEach(() => {
    service = new LLMService();
    mockModelsList.mockReset();
    mockChatCreate.mockReset();
    mockLogToolCall.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockModelsList.mockReset();
    mockChatCreate.mockReset();
  });

  describe('initialize', () => {
    it('returns true and sets service ready when API key present and connection succeeds', async () => {
      jest.spyOn(configManager, 'getConfig').mockReturnValue({ openaiApiKey: 'key' } as any);
      mockModelsList.mockResolvedValue({});
      const result = await service.initialize();
      expect(result).toBe(true);
      expect(service.isReady()).toBe(true);
    });

    it('returns false when no API key', async () => {
      jest.spyOn(configManager, 'getConfig').mockReturnValue({} as any);
      const result = await service.initialize();
      expect(result).toBe(false);
      expect(service.isReady()).toBe(false);
    });
  });

  describe('message methods without initialization', () => {
    it('streamMessage throws when not initialized', async () => {
      await expect(
        service.streamMessage([], () => {})
      ).rejects.toThrow('LLM service not initialized. Run setup first.');
    });

    it('sendMessage throws when not initialized', async () => {
      await expect(service.sendMessage([])).rejects.toThrow(
        'LLM service not initialized. Run setup first.'
      );
    });

    it('sendMessageWithTools throws when not initialized', async () => {
      await expect(service.sendMessageWithTools([])).rejects.toThrow(
        'LLM service not initialized. Run setup first.'
      );
    });
  });

  describe('streamMessage', () => {
    it('calls onChunk and onComplete and returns response', async () => {
      jest
        .spyOn(configManager, 'getConfig')
        .mockReturnValue({ openaiApiKey: 'key', model: 'm', maxTokens: 5 } as any);
      mockModelsList.mockResolvedValue({});
      await service.initialize();

      const dummyStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: { content: 'a' } }] };
          yield { choices: [{ delta: {}, finish_reason: 'stop' }] };
        },
      } as any;
      mockChatCreate.mockResolvedValue(dummyStream);

      const chunks: string[] = [];
      let completion: StreamingResponse | undefined;
      const response = await service.streamMessage(
        [],
        (chunk: string) => {
          chunks.push(chunk);
        },
        (resp: StreamingResponse) => {
          completion = resp;
        }
      );
      expect(chunks).toEqual(['a']);
      expect(completion).toEqual(response);
      expect(response).toEqual({ content: 'a', finishReason: 'stop' });
    });
  });

  describe('sendMessage', () => {
    it('returns content on success', async () => {
      jest
        .spyOn(configManager, 'getConfig')
        .mockReturnValue({ openaiApiKey: 'key', model: 'm', maxTokens: 5 } as any);
      mockModelsList.mockResolvedValue({});
      await service.initialize();
      mockChatCreate.mockResolvedValue({ choices: [{ message: { content: 'hi' } }] } as any);
      const res = await service.sendMessage([{ role: 'user', content: 'hi' }]);
      expect(res).toBe('hi');
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
        [{},],
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
      expect(onToolCall).toHaveBeenCalledWith('tool', 'notjson');
      expect(resp.content).toBe('resp');
      expect(resp.finishReason).toBeNull();
      expect(resp.usage).toBeUndefined();
    });
  });

  describe('message creators', () => {
    it('createSystemMessage returns valid system message', () => {
      (execSync as jest.Mock).mockReturnValue('branch\n');
      const msg = service.createSystemMessage();
      expect(msg.role).toBe('system');
      expect(msg.content).toContain('Git branch: branch');
      expect(msg.content).toContain('Environment:');
      expect(msg.content).toContain('Key capabilities:');
    });

    it('createUserMessage returns correct message', () => {
      const msg = service.createUserMessage('hello');
      expect(msg).toEqual({ role: 'user', content: 'hello' });
    });

    it('createAssistantMessage returns correct message', () => {
      const msg = service.createAssistantMessage('reply');
      expect(msg).toEqual({ role: 'assistant', content: 'reply' });
    });
  });
});