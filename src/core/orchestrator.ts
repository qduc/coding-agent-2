/**
 * Tool Orchestrator - Coordinates between LLM and tools
 *
 * Handles OpenAI function calling integration, tool execution,
 * and conversation management with tool results.
 */

import { BaseTool, ToolResult } from '../tools';
import { LLMService, Message } from '../services/llm';
import chalk from 'chalk';
import * as path from 'path';
import { configManager } from './config';
import { ToolLogger } from '../utils/toolLogger';
import { ProjectDiscoveryResult } from '../utils/projectDiscovery';
import { logger } from '../utils/logger';

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
  private projectContext?: ProjectDiscoveryResult;

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
   * Set project context from discovery results
   */
  setProjectContext(projectContext: ProjectDiscoveryResult): void {
    this.projectContext = projectContext;
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
        // Send to LLM with streaming function calling support
        const response = await this.llmService.streamMessageWithTools(
          messages,
          this.getFunctionSchemas(),
          onChunk // Pass through streaming callback
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
    const startTime = Date.now();

    if (!tool) {
      const errorMessage = `Tool '${func.name}' not found`;
      logger.error('Tool not found', new Error(errorMessage), {
        toolName: func.name,
        availableTools: Array.from(this.tools.keys())
      }, 'ORCHESTRATOR');

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
      const { logToolUsage } = configManager.getConfig();
      if (verbose) {
        console.log(chalk.cyan(`🛠️  Executing tool: ${func.name}`));
        console.log(chalk.gray(`   Arguments: ${func.arguments}`));
      }

      // Parse arguments
      let args: any;
      try {
        args = JSON.parse(func.arguments);
      } catch (error) {
        const parseError = new Error(`Invalid JSON arguments: ${func.arguments}`);
        logger.error('Tool argument parsing failed', parseError, {
          toolName: func.name,
          arguments: func.arguments
        }, 'ORCHESTRATOR');
        throw parseError;
      }

      logger.debug('Executing tool', { toolName: func.name, args }, 'ORCHESTRATOR');

      // Execute the tool
      const result = await tool.execute(args);
      const executionTime = Date.now() - startTime;

      logger.logToolExecution(func.name, args, result, undefined, executionTime);

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

      if (logToolUsage) {
        ToolLogger.logToolResult(func.name, result.success, result.success ? result.output : result.error);
      }

      // Add tool result to conversation
      this.conversationHistory.push({
        role: 'tool',
        content: JSON.stringify(this.formatToolResult(result)),
        tool_call_id: toolCall.id
      });
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorObj = error instanceof Error ? error : new Error('Unknown error');
      const errorMessage = `Tool execution failed: ${errorObj.message}`;

      logger.logToolExecution(func.name, {}, undefined, errorObj, executionTime);

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
   * Create system message that includes tool descriptions and context
   */
  private createSystemMessageWithTools(): ConversationMessage {
    const currentDirectory = process.cwd();
    const projectName = path.basename(currentDirectory);
    const currentDateTime = new Date().toLocaleString();
    const platform = process.platform;
    const nodeVersion = process.version;

    const baseSystemMessage = `You are a helpful coding assistant. You help developers understand, analyze, and work with their code.

CURRENT CONTEXT:
- Date/Time: ${currentDateTime}
- Operating System: ${platform}
- Node.js Version: ${nodeVersion}
- Working Directory: ${currentDirectory}
- Project Name: ${projectName}
- When users refer to "this file", "this project", or use relative paths, they're referring to files within this directory

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

    // Include project context if available
    const projectContextSection = this.projectContext ?
      `\n\n${this.formatProjectContextForPrompt()}\n` : '\n';

    const fullSystemMessage = `${baseSystemMessage}\n${toolDescriptions}${projectContextSection}\nWhen working with files:
- Use the current working directory (${currentDirectory}) as the base for relative paths
- When users say "this file" or "this project", they mean files in the current directory
- Use the ls tool to explore the project structure when needed
- Always provide helpful context about what you find

Use these tools when you need to access files or gather information about the project. Always be helpful, accurate, and focused on the specific coding task at hand.`;

    return {
      role: 'system',
      content: fullSystemMessage
    };
  }

  /**
   * Format project context for inclusion in system prompt
   */
  private formatProjectContextForPrompt(): string {
    if (!this.projectContext) {
      return '';
    }

    const lines = [
      'PROJECT CONTEXT:',
      this.projectContext.summary,
      '',
      'Project Structure:',
      this.projectContext.projectStructure,
      '',
      'Tech Stack:',
      this.projectContext.techStack,
      ''
    ];

    if (this.projectContext.entryPoints.length > 0) {
      lines.push(`Entry Points: ${this.projectContext.entryPoints.join(', ')}`);
    }

    return lines.join('\n');
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

  /**
   * Get tool schemas in the format expected by native tool calling
   * This supports both OpenAI and Anthropic tool schema formats
   */
  getToolSchemas(): any[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: "object",
        properties: tool.schema.properties || {},
        required: tool.schema.required || []
      }
    }));
  }

  /**
   * Process message using native tool calling loop pattern (similar to Anthropic example)
   * This follows the continuous conversation pattern where tool calls happen in a loop
   */
  async processWithNativeToolLoop(
    userInput: string,
    onChunk?: (chunk: string) => void,
    verbose: boolean = false
  ): Promise<string> {
    if (!this.llmService.isReady()) {
      throw new Error('LLM service not initialized');
    }

    // Initialize conversation with system message and user input
    let messages: ConversationMessage[] = [
      this.createSystemMessageWithTools(),
      {
        role: 'user',
        content: userInput
      }
    ];

    const maxIterations = 10; // Prevent infinite loops
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;

      if (verbose) {
        console.log(chalk.blue(`🔄 Processing iteration ${iterations}...`));
      }

      try {
        // Send to LLM with tool schemas
        const response = await this.llmService.streamMessageWithTools(
          messages,
          this.getFunctionSchemas(),
          onChunk
        );

        // Check if we have tool calls to execute
        if (response.tool_calls && response.tool_calls.length > 0) {
          if (verbose) {
            console.log(chalk.yellow(`🔧 Executing ${response.tool_calls.length} tool call(s)`));
          }

          // Add assistant's response with tool calls to conversation
          messages.push({
            role: 'assistant',
            content: response.content,
            tool_calls: response.tool_calls
          });

          // Execute each tool call and add results
          for (const toolCall of response.tool_calls) {
            const toolResult = await this.executeToolCallNative(toolCall, verbose);

            // Add tool result to conversation
            messages.push({
              role: 'tool',
              content: JSON.stringify(toolResult),
              tool_call_id: toolCall.id
            });
          }

          // Continue the loop for next iteration
          continue;
        } else {
          // No tool calls - this is the final response
          const finalResponse = response.content || '';

          if (verbose) {
            console.log(chalk.green('✅ Final response generated'));
          }

          // Update conversation history for future calls
          this.conversationHistory = messages.slice(1); // Remove system message
          this.conversationHistory.push({
            role: 'assistant',
            content: finalResponse
          });

          return finalResponse;
        }
      } catch (error) {
        throw new Error(`Failed to process message in iteration ${iterations}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    throw new Error(`Maximum iterations (${maxIterations}) reached without completion`);
  }

  /**
   * Execute a single tool call and return formatted result
   * Used by the native tool loop
   */
  private async executeToolCallNative(toolCall: ToolCall, verbose: boolean): Promise<any> {
    const { function: func } = toolCall;
    const tool = this.tools.get(func.name);

    if (!tool) {
      const errorResult = {
        error: `Tool '${func.name}' not found`,
        available_tools: Array.from(this.tools.keys())
      };

      if (verbose) {
        console.error(chalk.red(`❌ ${errorResult.error}`));
      }

      return errorResult;
    }

    try {
      if (verbose) {
        console.log(chalk.cyan(`🛠️  Executing: ${func.name}`));
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

      // Log tool usage if enabled
      const { logToolUsage } = configManager.getConfig();
      if (logToolUsage) {
        ToolLogger.logToolResult(func.name, result.success, result.success ? result.output : result.error);
      }

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

      // Return formatted result for LLM consumption
      return this.formatToolResult(result);
    } catch (error) {
      const errorResult = {
        error: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        tool: func.name,
        arguments: func.arguments
      };

      if (verbose) {
        console.error(chalk.red(`❌ ${errorResult.error}`));
      }

      return errorResult;
    }
  }

  /**
   * Convert tool schemas to Gemini function declarations format
   */
  private convertToGeminiFunctionDeclarations(tools: any[]): any[] {
    return tools.map(tool => ({
      name: tool.function?.name || tool.name,
      description: tool.function?.description || tool.description,
      parameters: tool.function?.parameters || tool.parameters
    }));
  }

  /**
   * Enhanced native calling that routes to provider-specific implementations
   */
  async processWithEnhancedNativeCalling(
    userInput: string,
    onChunk?: (chunk: string) => void,
    verbose?: boolean
  ): Promise<string> {
    if (verbose) {
      console.log('🚀 Starting enhanced native tool calling process');
      console.log(`🔧 Provider: ${this.llmService.provider}`);
    }

    const tools = await this.getToolSchemas();

    // Use provider-specific native calling
    if (this.llmService.provider === 'gemini') {
      // Convert tools to Gemini function declarations format
      const functionDeclarations = this.convertToGeminiFunctionDeclarations(tools);

      if (verbose) {
        console.log('🔧 Using Gemini chat loop for tool calling');
      }

      // Create a connected version of processWithChatLoop that can execute tools
      return await this.processGeminiChatLoop(userInput, functionDeclarations, onChunk, verbose);
    } else {
      // Use existing approach for OpenAI/Anthropic
      if (verbose) {
        console.log('🔧 Using traditional tool calling approach');
      }
      return await this.processMessage(userInput, onChunk, verbose);
    }
  }

  /**
   * Gemini-specific chat loop with integrated tool execution
   */
  private async processGeminiChatLoop(
    userInput: string,
    functionDeclarations: any[],
    onChunk?: (chunk: string) => void,
    verbose?: boolean,
    maxIterations: number = 10
  ): Promise<string> {
    try {
      if (verbose) {
        console.log('🔧 Starting integrated Gemini chat loop');
        console.log(`🛠️ Available tools: ${functionDeclarations.map(f => f.name).join(', ')}`);
      }

      // Create tool executor that uses our orchestrator's tool execution
      const toolExecutor = async (toolName: string, args: any) => {
        if (verbose) {
          console.log(`🔧 Executing tool: ${toolName}`);
        }

        // Find the tool in our registry
        const tool = this.tools.get(toolName);
        if (!tool) {
          throw new Error(`Tool ${toolName} not found in registry`);
        }

        // Execute the tool with proper error handling
        try {
          const result = await tool.execute(args);
          return result;
        } catch (error) {
          console.error(`❌ Tool execution failed for ${toolName}:`, error);
          throw error;
        }
      };

      // Check if we have the enhanced Gemini provider
      if (this.llmService.provider === 'gemini' &&
          typeof (this.llmService as any).processWithChatLoop === 'function') {

        // Use the enhanced Gemini chat loop
        return await (this.llmService as any).processWithChatLoop(
          userInput,
          functionDeclarations,
          toolExecutor,
          onChunk,
          verbose,
          maxIterations
        );
      } else {
        // Fall back to traditional approach
        if (verbose) {
          console.log('⚠️ Enhanced Gemini chat loop not available, using traditional approach');
        }
        return await this.processMessage(userInput, onChunk, verbose);
      }

    } catch (error) {
      console.error('❌ Gemini chat loop error:', error);
      throw error;
    }
  }
}
