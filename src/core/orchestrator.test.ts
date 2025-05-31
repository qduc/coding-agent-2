import { ToolOrchestrator } from '../core/orchestrator.js';
import { LLMService } from '../services/llm.js';

describe('Gemini Enhanced Tool Calling', () => {
  let orchestrator: ToolOrchestrator;
  let mockLLMService: jest.Mocked<LLMService>;

  beforeEach(() => {
    mockLLMService = {
      provider: 'gemini',
      processWithChatLoop: jest.fn()
    } as any;

    orchestrator = new ToolOrchestrator(mockLLMService);
  });

  it('should route to Gemini chat loop when provider is gemini', async () => {
    const userInput = 'test message';
    const mockResult = 'test response';

    mockLLMService.processWithChatLoop.mockResolvedValue(mockResult);

    const result = await orchestrator.processWithEnhancedNativeCalling(userInput);

    expect(result).toBe(mockResult);
    expect(mockLLMService.processWithChatLoop).toHaveBeenCalledWith(
      userInput,
      expect.any(Array), // function declarations
      expect.any(Function), // tool executor
      undefined, // onChunk
      undefined, // verbose
      10 // maxIterations
    );
  });

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
});