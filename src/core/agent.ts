import { LLMService } from '../services/llm';
import { configManager } from './config';
import { ToolLogger } from '../utils/toolLogger';

/**
 * Core Agent logic for orchestrating tools and LLM interactions
 */
export class Agent {
  private llmService: LLMService;
  private toolRegistry: any; // Will be implemented later

  constructor() {
    this.llmService = new LLMService();
    // Tool registry will be initialized later
  }

  /**
   * Initialize the agent
   */
  async initialize(): Promise<boolean> {
    return await this.llmService.initialize();
  }

  /**
   * Execute a tool and log the results if enabled
   */
  async executeToolWithLogging(toolName: string, args: any): Promise<any> {
    const config = configManager.getConfig();
    let result;
    let success = true;

    try {
      // This is a placeholder for actual tool execution
      // Will be implemented with the tool registry
      result = { success: true, data: 'Tool execution result' };
    } catch (error) {
      success = false;
      result = error;
    }

    // Log tool result if enabled
    if (config.logToolUsage) {
      ToolLogger.logToolResult(toolName, success, result);
    }

    return result;
  }

  /**
   * Process a user message with tool support
   */
  async processMessage(userMessage: string, availableTools: any[]): Promise<string> {
    // Create system and user messages
    const messages = [
      this.llmService.createSystemMessage(),
      this.llmService.createUserMessage(userMessage)
    ];

    // Send message with tools and logging support
    const config = configManager.getConfig();
    const response = await this.llmService.sendMessageWithTools(
      messages,
      availableTools,
      config.logToolUsage
        ? (toolName: string, args: any) => {
            ToolLogger.logToolCall(toolName, args);
          }
        : undefined
    );

    // Process and execute tool calls
    if (response.tool_calls) {
      for (const toolCall of response.tool_calls) {
        if (toolCall.type === 'function') {
          const { name, arguments: argsString } = toolCall.function;
          const args = JSON.parse(argsString);

          // Execute the tool and get result
          const result = await this.executeToolWithLogging(name, args);

          // Add the tool response as a message
          messages.push({
            role: 'assistant',
            content: null,
            tool_calls: [toolCall]
          });

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          });
        }
      }

      // Get final response after tool usage
      const finalResponse = await this.llmService.sendMessage(messages);
      return finalResponse;
    }

    return response.content || '';
  }
}
