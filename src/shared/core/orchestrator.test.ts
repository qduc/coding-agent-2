import { ToolOrchestrator } from './orchestrator';
import { LLMService } from '../services/llm';
import { BaseTool } from '../tools/base';

describe('ToolOrchestrator', () => {
  let orchestrator: ToolOrchestrator;
  let mockLLMService: jest.Mocked<LLMService>;
  let mockTool: jest.Mocked<BaseTool>;

  beforeEach(() => {
    mockTool = {
      name: 'test-tool',
      description: 'A test tool',
      schema: {
        type: 'object',
        properties: {
          input: { type: 'string' }
        },
        required: ['input']
      },
      execute: jest.fn(),
      getFunctionCallSchema: jest.fn().mockReturnValue({
        name: 'test-tool',
        description: 'A test tool',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          },
          required: ['input']
        }
      })
    } as any;

    mockLLMService = {
      provider: 'openai',
      sendMessageWithTools: jest.fn(),
      sendMessage: jest.fn(),
      streamMessage: jest.fn(),
      initialize: jest.fn(),
      isReady: jest.fn().mockReturnValue(true),
      getProviderName: jest.fn().mockReturnValue('openai')
    } as any;

    orchestrator = new ToolOrchestrator(mockLLMService, [mockTool]);
  });

  describe('processMessage', () => {
    it('should process messages without tool calls', async () => {
      const userInput = 'test message';
      const mockResult = {
        content: 'test response',
        tool_calls: undefined,
        finishReason: 'stop'
      };

      mockLLMService.sendMessageWithTools.mockResolvedValue(mockResult);

      const result = await orchestrator.processMessage(userInput);

      expect(result).toBe('test response');
      expect(mockLLMService.sendMessageWithTools).toHaveBeenCalled();
    });

    it('should handle tool calls in messages', async () => {
      const userInput = 'test message';
      const toolCallResponse = {
        content: 'I need to use a tool',
        tool_calls: [{
          id: 'call-1',
          type: 'function' as const,
          function: {
            name: 'test-tool',
            arguments: JSON.stringify({ input: 'test' })
          }
        }],
        finishReason: 'tool_calls'
      };
      const finalResponse = {
        content: 'final response',
        tool_calls: undefined,
        finishReason: 'stop'
      };

      mockTool.execute.mockResolvedValue({
        success: true,
        output: 'tool result'
      });

      mockLLMService.sendMessageWithTools
        .mockResolvedValueOnce(toolCallResponse)
        .mockResolvedValueOnce(finalResponse);

      const result = await orchestrator.processMessage(userInput);

      expect(result).toBe('final response');
      expect(mockTool.execute).toHaveBeenCalledWith({ input: 'test' });
      expect(mockLLMService.sendMessageWithTools).toHaveBeenCalledTimes(2);
    });
  });

  describe('tool registration', () => {
    it('should register new tools', () => {
      const newTool = {
        name: 'new-tool',
        description: 'A new tool',
        execute: jest.fn(),
        getFunctionCallSchema: jest.fn()
      } as any;

      orchestrator.registerTool(newTool);
      const tools = orchestrator.getRegisteredTools();

      expect(tools).toHaveLength(2); // original + new
      expect(tools.some(t => t.name === 'new-tool')).toBe(true);
    });
  });

  describe('conversation management', () => {
    it('should clear conversation history', () => {
      orchestrator.clearHistory();
      const history = orchestrator.getHistory();
      expect(history).toHaveLength(0);
    });

    it('should provide conversation summary', () => {
      const summary = orchestrator.getConversationSummary();
      expect(typeof summary).toBe('string');
    });
  });

  describe('tool schema handling', () => {
    it('should get tool schemas for different providers', () => {
      const schemas = orchestrator.getToolSchemas();
      expect(Array.isArray(schemas)).toBe(true);
      expect(schemas.length).toBeGreaterThan(0);
    });

    it('should handle provider-specific schema transformations', () => {
      mockLLMService.getProviderName.mockReturnValue('anthropic');
      const schemas = orchestrator.getToolSchemas();

      expect(Array.isArray(schemas)).toBe(true);
      if (schemas.length > 0) {
        expect(schemas[0]).toHaveProperty('name');
        expect(schemas[0]).toHaveProperty('description');
        expect(schemas[0]).toHaveProperty('input_schema');
      }
    });
  });
});