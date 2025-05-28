/**
 * Tool Orchestrator - Coordinates between LLM and tools
 *
 * Handles OpenAI function calling integration, tool execution,
 * and conversation management with tool results.
 */

import { BaseTool, ToolResult } from '../tools';
import { LLMService, Message } from '../services/llm';
import chalk from 'chalk';

export interface ConversationMessage extends Message {
  tool_calls?: any[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export class ToolOrchestrator {
  private tools: Map<string, BaseTool> = new Map();
  private conversationHistory: ConversationMessage[] = [];

  constructor(
    private llmService: LLMService,
    tools: BaseTool[] = []
  ) {
    // Register tools
    tools.forEach(tool => {
      this.tools.set(tool.name, tool);
    });
  }

  /**
   * Register a new tool
   */
  registerTool(tool: BaseTool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Get all registered tools
   */
  getRegisteredTools(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Process a user message with tool support
   */
  async processMessage(
    userInput: string,
    onChunk?: (chunk: string) => void,
    verbose: boolean = false
  ): Promise<string> {
    if (!this.llmService.isReady()) {
      throw new Error('LLM service not initialized');
    }

    // Add user message to conversation
    const userMessage: ConversationMessage = {
      role: 'user',
      content: userInput
    };
    this.conversationHistory.push(userMessage);

    let maxIterations = 5; // Prevent infinite loops
    let fullResponse = '';

    while (maxIterations > 0) {
      if (verbose) {
        console.log(chalk.blue('🔄 Processing with LLM...'));
      }

      // Create messages for this request
      const messages = this.buildMessages();

      try {
        // Send to LLM with function calling support
        const response = await this.llmService.sendMessageWithTools(
          messages,
          this.getFunctionSchemas()
        );

        // Check if LLM wants to call tools
        if (response.tool_calls && response.tool_calls.length > 0) {
          if (verbose) {
            console.log(chalk.yellow(`🔧 LLM wants to call ${response.tool_calls.length} tool(s)`));
          }

          // Add assistant's tool call message
          this.conversationHistory.push({
            role: 'assistant',
            content: response.content || null,
            tool_calls: response.tool_calls
          });

          // Execute each tool call
          for (const toolCall of response.tool_calls) {
            await this.executeToolCall(toolCall, verbose);
          }

          maxIterations--;
          continue; // Continue the conversation loop
        } else {
          // No tool calls, this is the final response
          fullResponse = response.content || '';

          // Add to conversation history
          this.conversationHistory.push({
            role: 'assistant',
            content: fullResponse
          });

          break;
        }
      } catch (error) {
        throw new Error(`Failed to process message: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (maxIterations === 0) {
      throw new Error('Maximum tool call iterations reached');
    }

    return fullResponse;
  }

  /**
   * Execute a tool call and add the result to conversation
   */
  private async executeToolCall(toolCall: ToolCall, verbose: boolean): Promise<void> {
    const { function: func } = toolCall;
    const tool = this.tools.get(func.name);

    if (!tool) {
      const errorMessage = `Tool '${func.name}' not found`;
      if (verbose) {
        console.error(chalk.red(`❌ ${errorMessage}`));
      }

      // Add error result to conversation
      this.conversationHistory.push({
        role: 'tool',
        content: JSON.stringify({
          error: errorMessage,
          available_tools: Array.from(this.tools.keys())
        }),
        tool_call_id: toolCall.id
      });
      return;
    }

    try {
      if (verbose) {
        console.log(chalk.cyan(`🛠️  Executing tool: ${func.name}`));
        console.log(chalk.gray(`   Arguments: ${func.arguments}`));
      }

      // Parse arguments
      let args: any;
      try {
        args = JSON.parse(func.arguments);
      } catch (error) {
        throw new Error(`Invalid JSON arguments: ${func.arguments}`);
      }

      // Execute the tool
      const result = await tool.execute(args);

      if (verbose) {
        if (result.success) {
          console.log(chalk.green(`✅ Tool executed successfully`));
          if (result.metadata?.executionTime) {
            console.log(chalk.gray(`   Execution time: ${result.metadata.executionTime}ms`));
          }
        } else {
          console.log(chalk.red(`❌ Tool execution failed: ${result.error}`));
        }
      }

      // Add tool result to conversation
      this.conversationHistory.push({
        role: 'tool',
        content: JSON.stringify(this.formatToolResult(result)),
        tool_call_id: toolCall.id
      });

    } catch (error) {
      const errorMessage = `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`;

      if (verbose) {
        console.error(chalk.red(`❌ ${errorMessage}`));
      }

      // Add error result to conversation
      this.conversationHistory.push({
        role: 'tool',
        content: JSON.stringify({
          error: errorMessage,
          tool: func.name,
          arguments: func.arguments
        }),
        tool_call_id: toolCall.id
      });
    }
  }

  /**
   * Format tool result for LLM consumption
   */
  private formatToolResult(result: ToolResult): any {
    if (result.success) {
      return {
        success: true,
        data: result.output,
        metadata: result.metadata
      };
    } else {
      return {
        success: false,
        error: result.error?.toString() || 'Unknown error',
        metadata: result.metadata
      };
    }
  }

  /**
   * Build messages array for LLM request
   */
  private buildMessages(): ConversationMessage[] {
    // Start with system message
    const systemMessage = this.createSystemMessageWithTools();

    // Add conversation history
    return [systemMessage, ...this.conversationHistory];
  }

  /**
   * Create system message that includes tool descriptions
   */
  private createSystemMessageWithTools(): ConversationMessage {
    const baseSystemMessage = `You are a helpful coding assistant. You help developers understand, analyze, and work with their code.

Key capabilities:
- Read and analyze files in the project
- Explain code functionality and structure
- Help debug issues and suggest improvements
- Provide clear, concise explanations
- Ask clarifying questions when needed

You have access to the following tools:`;

    const toolDescriptions = Array.from(this.tools.values())
      .map(tool => `- ${tool.name}: ${tool.description}`)
      .join('\n');

    const fullSystemMessage = `${baseSystemMessage}\n${toolDescriptions}\n\nUse these tools when you need to access files or gather information about the project. Always be helpful, accurate, and focused on the specific coding task at hand.`;

    return {
      role: 'system',
      content: fullSystemMessage
    };
  }

  /**
   * Get function schemas for OpenAI function calling
   */
  private getFunctionSchemas(): any[] {
    return Array.from(this.tools.values()).map(tool => tool.getFunctionCallSchema());
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Get conversation history
   */
  getHistory(): ConversationMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Get conversation summary for debugging
   */
  getConversationSummary(): string {
    return this.conversationHistory
      .map((msg, index) => {
        const role = msg.role.toUpperCase();
        const content = msg.content ? msg.content.substring(0, 100) + '...' : '[null]';
        const toolCalls = msg.tool_calls ? ` (${msg.tool_calls.length} tool calls)` : '';
        const toolCallId = msg.tool_call_id ? ` (tool_call_id: ${msg.tool_call_id})` : '';
        return `${index + 1}. ${role}: ${content}${toolCalls}${toolCallId}`;
      })
      .join('\n');
  }
}
