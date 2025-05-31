import { ToolOrchestrator } from './orchestrator';
import { LLMService } from '../services/llm';
import { GeminiProvider } from '../services/geminiProvider';

describe('ToolOrchestrator', () => {
  let orchestrator: ToolOrchestrator;
  let mockLLMService: jest.Mocked<LLMService>;
  let mockGeminiProvider: jest.Mocked<GeminiProvider>;

  beforeEach(() => {
    mockGeminiProvider = {
      sendMessageWithTools: jest.fn(),
      streamMessageWithTools: jest.fn(),
      sendMessage: jest.fn(),
      streamMessage: jest.fn(),
      initialize: jest.fn(),
      isReady: jest.fn()
    } as any;

    mockLLMService = {
      provider: 'gemini',
      sendMessageWithTools: jest.fn(),
      streamMessageWithTools: jest.fn(),
      sendMessage: jest.fn(),
      streamMessage: jest.fn(),
      initialize: jest.fn(),
      isReady: jest.fn(),
      getCurrentProvider: jest.fn().mockReturnValue('gemini') // Add missing method
    } as any;

    orchestrator = new ToolOrchestrator(mockLLMService);
  });

  describe('processWithEnhancedNativeCalling', () => {
    it('should route to Gemini chat loop when provider is gemini', async () => {
      const userInput = 'test message';
      const mockResult = 'test response';

      // Mock the internal processGeminiChatLoop method
      const processGeminiChatLoopSpy = jest.spyOn(orchestrator as any, 'processGeminiChatLoop')
        .mockResolvedValue(mockResult);

      const result = await orchestrator.processWithEnhancedNativeCalling(userInput);

      expect(result).toBe(mockResult);
      expect(processGeminiChatLoopSpy).toHaveBeenCalledWith(
        userInput,
        expect.any(Array), // function declarations
        undefined, // onChunk
        undefined  // verbose
      );
    });

    it('should fallback to standard processing for non-gemini providers', async () => {
      // Create a new mock LLMService for this test with openai provider
      const openaiMockLLMService = {
        provider: 'openai',
        sendMessageWithTools: jest.fn(),
        streamMessageWithTools: jest.fn(),
        sendMessage: jest.fn(),
        streamMessage: jest.fn(),
        initialize: jest.fn(),
        isReady: jest.fn(),
        getCurrentProvider: jest.fn().mockReturnValue('openai') // Add missing method
      } as any;

      const openaiOrchestrator = new ToolOrchestrator(openaiMockLLMService);
      const userInput = 'test message';
      const mockResult = 'test response';

      // Mock the internal processMessage method
      const processMessageSpy = jest.spyOn(openaiOrchestrator as any, 'processMessage')
        .mockResolvedValue(mockResult);

      const result = await openaiOrchestrator.processWithEnhancedNativeCalling(userInput);

      expect(result).toBe(mockResult);
      expect(processMessageSpy).toHaveBeenCalledWith(
        userInput,
        undefined, // onChunk
        undefined  // verbose
      );
    });
  });

  describe('convertToGeminiFunctionDeclarations', () => {
    it('should convert tools to Gemini function declarations format', () => {
      const orchestratorInstance = orchestrator as any;
      const tools = [
        {
          function: {
            name: 'test_tool',
            description: 'A test tool',
            parameters: { type: 'object' }
          }
        }
      ];

      const result = orchestratorInstance.convertToGeminiFunctionDeclarations(tools);

      expect(result).toEqual([
        {
          name: 'test_tool',
          description: 'A test tool',
          parameters: { type: 'object' }
        }
      ]);
    });

    it('should handle tools with direct name and description properties', () => {
      const orchestratorInstance = orchestrator as any;
      const tools = [
        {
          name: 'direct_tool',
          description: 'A directly structured tool',
          parameters: { type: 'object', properties: {} }
        }
      ];

      const result = orchestratorInstance.convertToGeminiFunctionDeclarations(tools);

      expect(result).toEqual([
        {
          name: 'direct_tool',
          description: 'A directly structured tool',
          parameters: { type: 'object', properties: {} }
        }
      ]);
    });
  });
});