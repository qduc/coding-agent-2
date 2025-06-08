import { AnthropicProvider } from './providers/AnthropicProvider';
import { Message } from './llm';

describe('AnthropicProvider Tool Results', () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    provider = new AnthropicProvider();
  });

  describe('convertMessages', () => {
    it('should convert tool result messages to proper Anthropic format', () => {
      const messages: Message[] = [
        {
          role: 'system',
          content: 'You are a helpful assistant.'
        },
        {
          role: 'user',
          content: 'What is the weather?'
        },
        {
          role: 'assistant',
          content: 'I need to check the weather for you.',
          tool_calls: [
            {
              id: 'tool_123',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"location": "San Francisco"}'
              }
            }
          ]
        },
        {
          role: 'tool',
          content: 'The weather is sunny, 75°F',
          tool_call_id: 'tool_123'
        }
      ];

      // Access the private method for testing
      const convertMessages = (provider as any).convertMessages.bind(provider);
      const result = convertMessages(messages);

      expect(result).toHaveLength(3); // system message is excluded

      // Check user message
      expect(result[0]).toEqual({
        role: 'user',
        content: 'What is the weather?'
      });

      // Check assistant message with tool calls
      expect(result[1]).toEqual({
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'I need to check the weather for you.'
          },
          {
            type: 'tool_use',
            id: 'tool_123',
            name: 'get_weather',
            input: { location: 'San Francisco' }
          }
        ]
      });

      // Check tool result message
      expect(result[2]).toEqual({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool_123',
            content: 'The weather is sunny, 75°F'
          }
        ]
      });
    });

    it('should handle assistant messages with only tool calls (no text content)', () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'tool_456',
              type: 'function',
              function: {
                name: 'calculate',
                arguments: '{"expression": "2+2"}'
              }
            }
          ]
        }
      ];

      const convertMessages = (provider as any).convertMessages.bind(provider);
      const result = convertMessages(messages);

      expect(result[0]).toEqual({
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool_456',
            name: 'calculate',
            input: { expression: '2+2' }
          }
        ]
      });
    });
  });

  describe('extractSystemMessage', () => {
    it('should extract system message content', () => {
      const messages: Message[] = [
        {
          role: 'system',
          content: 'You are a helpful assistant.'
        },
        {
          role: 'user',
          content: 'Hello'
        }
      ];

      const extractSystemMessage = (provider as any).extractSystemMessage.bind(provider);
      const result = extractSystemMessage(messages);

      expect(result).toBe('You are a helpful assistant.');
    });

    it('should return empty string if no system message', () => {
      const messages: Message[] = [
        {
          role: 'user',
          content: 'Hello'
        }
      ];

      const extractSystemMessage = (provider as any).extractSystemMessage.bind(provider);
      const result = extractSystemMessage(messages);

      expect(result).toBe('');
    });
  });

  describe('sendToolResults and streamToolResults', () => {
    it('should add tool results to messages and call appropriate method', async () => {
      const messages: Message[] = [
        {
          role: 'user',
          content: 'What is 2+2?'
        },
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'tool_123',
              type: 'function',
              function: {
                name: 'calculate',
                arguments: '{"expression": "2+2"}'
              }
            }
          ]
        }
      ];

      const toolResults = [
        {
          tool_call_id: 'tool_123',
          content: '4'
        }
      ];

      // Mock the isReady method to return true
      jest.spyOn(provider, 'isReady').mockReturnValue(true);

      // Mock the sendMessageWithTools method
      const mockResponse = {
        content: 'The answer is 4.',
        tool_calls: undefined,
        finishReason: 'stop'
      };

      jest.spyOn(provider, 'sendMessageWithTools').mockResolvedValue(mockResponse);

      const result = await provider.sendToolResults(messages, toolResults, []);

      expect(provider.sendMessageWithTools).toHaveBeenCalledWith(
        [
          ...messages,
          {
            role: 'tool',
            content: '4',
            tool_call_id: 'tool_123'
          }
        ],
        []
      );

      expect(result).toBe(mockResponse);
    });
  });
});
