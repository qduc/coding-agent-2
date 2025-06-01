import { GeminiProvider } from './geminiProvider';
import { configManager } from '../core/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Message } from './llm';
import { ToolSchema } from '../tools/types';

// Mock the GoogleGenerativeAI
jest.mock('@google/generative-ai');
jest.mock('../core/config');

describe('GeminiProvider', () => {
  let provider: GeminiProvider;
  let mockGenAI: jest.Mocked<GoogleGenerativeAI>;
  let mockModel: any;

  beforeEach(() => {
    mockModel = {
      generateContent: jest.fn(),
      generateContentStream: jest.fn()
    };

    mockGenAI = {
      getGenerativeModel: jest.fn().mockReturnValue(mockModel)
    } as any;

    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => mockGenAI);
    (configManager.getConfig as jest.Mock).mockReturnValue({
      geminiApiKey: 'test-key',
      model: 'gemini-2.5-flash-preview-05-20',
      maxTokens: 8000
    });

    provider = new GeminiProvider();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('convertMessagesToParts', () => {
    it('should convert regular messages to Gemini format', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' }
      ];

      const result = (provider as any).convertMessagesToParts(messages);

      expect(result).toEqual([
        { role: 'user', parts: [{ text: 'Hello' }] },
        { role: 'model', parts: [{ text: 'Hi there' }] }
      ]);
    });

    it('should pass through Gemini-native messages', () => {
      const messages = [
        { role: 'user', parts: [{ text: 'Hello' }] },
        { role: 'model', parts: [{ functionCall: { name: 'test', args: {} } }] }
      ];

      const result = (provider as any).convertMessagesToParts(messages);

      expect(result).toEqual(messages);
    });

    it('should filter out messages with no content', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: null },
        { role: 'user', content: '' }
      ];

      const result = (provider as any).convertMessagesToParts(messages);

      expect(result).toEqual([
        { role: 'user', parts: [{ text: 'Hello' }] }
      ]);
    });

    it('should throw error for Gemini messages with empty parts', () => {
      const messages = [
        { role: 'user', parts: [] }
      ];

      expect(() => {
        (provider as any).convertMessagesToParts(messages);
      }).toThrow('Gemini message parts cannot be empty');
    });
  });

  describe('sendMessageWithTools', () => {
    beforeEach(async () => {
      await provider.initialize();
    });

    it('should handle function calls correctly', async () => {
      const mockResponse = {
        response: {
          text: () => 'I need to call a function',
          candidates: [{
            content: {
              parts: [{
                functionCall: {
                  name: 'test_tool',
                  args: { param: 'value' }
                }
              }]
            }
          }]
        }
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const messages: Message[] = [{ role: 'user', content: 'Test message' }];
      const functions = [{
        name: 'test_tool',
        description: 'A test tool',
        input_schema: {
          type: 'object',
          properties: { param: { type: 'string' } }
        }
      }];

      const result = await provider.sendMessageWithTools(messages, functions);

      expect(result).toEqual({
        content: 'I need to call a function',
        tool_calls: [{
          id: expect.stringMatching(/^tool_\d+_[a-z0-9]+$/),
          function: {
            name: 'test_tool',
            arguments: JSON.stringify({ param: 'value' })
          }
        }],
        finishReason: 'tool_calls'
      });
    });

    it('should handle responses without function calls', async () => {
      const mockResponse = {
        response: {
          text: () => 'Simple response',
          candidates: [{
            content: {
              parts: [{ text: 'Simple response' }]
            }
          }]
        }
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const messages: Message[] = [{ role: 'user', content: 'Test message' }];
      const result = await provider.sendMessageWithTools(messages, []);

      expect(result).toEqual({
        content: 'Simple response',
        tool_calls: undefined,
        finishReason: 'stop'
      });
    });

    it('should convert tools to Gemini format', async () => {
      const mockResponse = {
        response: {
          text: () => 'Response',
          candidates: [{ content: { parts: [{ text: 'Response' }] } }]
        }
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const messages: Message[] = [{ role: 'user', content: 'Test' }];
      const functions = [{
        name: 'test_tool',
        description: 'Test tool',
        input_schema: {
          type: 'object',
          properties: { param: { type: 'string' } },
          required: ['param']
        }
      }];

      await provider.sendMessageWithTools(messages, functions);

      expect(mockGenAI.getGenerativeModel).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash-preview-05-20',
        generationConfig: { maxOutputTokens: 8000 },
        tools: [{
          functionDeclarations: [{
            name: 'test_tool',
            description: 'Test tool',
            parameters: {
              type: 'OBJECT',
              properties: { param: { type: 'string' } },
              required: ['param']
            }
          }]
        }]
      });
    });
  });

  describe('streamMessage', () => {
    beforeEach(async () => {
      await provider.initialize();
    });

    it('should handle streaming responses', async () => {
      const mockStream = {
        stream: (async function* () {
          yield { text: () => 'Hello ' };
          yield { text: () => 'world!' };
        })()
      };

      mockModel.generateContentStream.mockResolvedValue(mockStream);

      const messages: Message[] = [{ role: 'user', content: 'Test' }];
      const chunks: string[] = [];

      const result = await provider.streamMessage(
        messages,
        (chunk) => chunks.push(chunk)
      );

      expect(chunks).toEqual(['Hello ', 'world!']);
      expect(result).toEqual({
        content: 'Hello world!',
        finishReason: 'stop'
      });
    });
  });
});