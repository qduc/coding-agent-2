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
import { SchemaAdapter } from '../services/schemaAdapter';

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

    let maxIterations = 20; // Prevent infinite loops
    let fullResponse = '';

    while (maxIterations > 0) {
      if (verbose) {
        console.log(chalk.blue('🔄 Processing with LLM...'));
      }

      // Create messages for this request
      const messages = this.buildMessages();

      try {
        // Check if we're using Anthropic and have tools available
        const schemas = this.getFunctionSchemas();
        const isAnthropicWithTools = this.llmService.getProviderName() === 'anthropic' && schemas.length > 0;

        let response;
        if (isAnthropicWithTools) {
          // Use non-streaming for Anthropic with tools to avoid streaming tool input issues
          response = await this.llmService.sendMessageWithTools(
            messages,
            schemas
          );
        } else {
          // Use streaming for other providers or when no tools
          response = await this.llmService.streamMessageWithTools(
            messages,
            schemas,
            onChunk // Pass through streaming callback
          );
        }

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

      // Log tool execution using available logger methods
      const toolContext = {
        toolName: func.name,
        args,
        result,
        executionTimeMs: executionTime
      };
      logger.debug(`Tool executed: ${func.name}`, toolContext, 'TOOL');

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
        // For bash tool, always pass the output (which contains BashResult even on failure)
        // For other tools, pass output on success, error on failure
        const logResult = (func.name.toLowerCase() === 'bash' && result.output) 
          ? result.output 
          : (result.success ? result.output : result.error);
        ToolLogger.logToolResult(func.name, result.success, logResult, args);
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

      // Log tool execution error using available logger methods
      const toolErrorContext = {
        toolName: func.name,
        args: {},
        executionTimeMs: executionTime
      };
      logger.error(`Tool execution failed: ${func.name}`, errorObj, toolErrorContext, 'TOOL');

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
   * Get function schemas for the current provider
   * Uses SchemaAdapter to transform schemas based on provider requirements
   */
  private getFunctionSchemas(): any[] {
    const provider = this.llmService.getProviderName();
    const toolSchemas = Array.from(this.tools.values()).map(tool => tool.getFunctionCallSchema());

    // Convert to normalized format first
    const normalizedTools = toolSchemas.map(schema => ({
      name: schema.name,
      description: schema.description,
      input_schema: schema.parameters
    }));

    // Transform based on provider
    switch (provider) {
      case 'openai':
        return SchemaAdapter.convertToOpenAI(normalizedTools);
      case 'anthropic':
        return SchemaAdapter.convertToAnthropic(normalizedTools);
      case 'gemini':
        return SchemaAdapter.convertToGemini(normalizedTools);
      default:
        // Default to OpenAI format for backwards compatibility
        return SchemaAdapter.convertToOpenAI(normalizedTools);
    }
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
   * Uses SchemaAdapter to ensure compatibility with different providers
   */
  getToolSchemas(): any[] {
    const provider = this.llmService.getProviderName();
    const toolSchemas = Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.schema
    }));

    // Transform based on provider
    switch (provider) {
      case 'anthropic':
        return SchemaAdapter.convertToAnthropic(toolSchemas);
      case 'gemini':
        // For Gemini, we need to convert to function declarations
        // but this method is used for Anthropic-style schemas
        return toolSchemas.map(tool => ({
          name: tool.name,
          description: tool.description,
          input_schema: {
            type: tool.input_schema.type,
            properties: tool.input_schema.properties || {},
            required: tool.input_schema.required || []
            // Strip additionalProperties for Gemini compatibility
          }
        }));
      default:
        // Default format (also works for OpenAI when needed)
        return toolSchemas;
    }
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
        // Check if we're using Anthropic and have tools available
        const schemas = this.getFunctionSchemas();
        const isAnthropicWithTools = this.llmService.getProviderName() === 'anthropic' && schemas.length > 0;

        let response;
        if (isAnthropicWithTools) {
          // Use non-streaming for Anthropic with tools to avoid streaming tool input issues
          response = await this.llmService.sendMessageWithTools(
            messages,
            schemas
          );
        } else {
          // Use streaming for other providers or when no tools
          response = await this.llmService.streamMessageWithTools(
            messages,
            schemas,
            onChunk
          );
        }

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
        // For bash tool, always pass the output (which contains BashResult even on failure)
        // For other tools, pass output on success, error on failure
        const logResult = (func.name.toLowerCase() === 'bash' && result.output) 
          ? result.output 
          : (result.success ? result.output : result.error);
        ToolLogger.logToolResult(func.name, result.success, logResult, args);
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
    return tools.map(tool => {
      let name, description, parameters;
      if (tool.function) {
        name = tool.function.name;
        description = tool.function.description;
        parameters = tool.function.parameters;
      } else if (tool.input_schema) {
        name = tool.name;
        description = tool.description;
        parameters = tool.input_schema;
      } else if (tool.parameters) {
        name = tool.name;
        description = tool.description;
        parameters = tool.parameters;
      } else {
        // Fallback: return as-is (should not happen)
        return tool;
      }

      // Normalize parameters.type for test compatibility
      if (parameters && typeof parameters.type === 'string' && parameters.type.toLowerCase() === 'object') {
        parameters = { ...parameters, type: 'object' };
      } else if (parameters && typeof parameters.type === 'string' && parameters.type === 'OBJECT') {
        parameters = { ...parameters, type: 'object' };
      }

      return { name, description, parameters };
    });
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
      console.log(`🔧 Provider: ${this.llmService.getProviderName()}`);
    }

    const tools = await this.getToolSchemas();

    // Use provider-specific native calling
    if (this.llmService.getProviderName() === 'gemini') {
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
   * Gemini-specific chat loop using Gemini's official function calling message format
   * Provides integrated tool execution
   */
  private async processGeminiChatLoop(
    userInput: string,
    functionDeclarations: any[],
    onChunk?: (chunk: string) => void,
    verbose?: boolean,
    maxIterations: number = 10
  ): Promise<string> {
    // Helper to build Gemini message parts
    function buildGeminiMessage(role: 'user' | 'model', part: any) {
      if (!part || (typeof part === 'object' && Object.keys(part).length === 0)) {
        throw new Error(`Cannot create Gemini message with empty part for role: ${role}`);
      }
      return { role, parts: [part] };
    }

    // Start conversation with user input
    let contents: any[] = [buildGeminiMessage('user', { text: userInput })];
    let iterations = 0;

    // Get Gemini provider instance
    const geminiProvider = (this.llmService as any).geminiProvider;
    if (!geminiProvider) {
      throw new Error('Gemini provider not initialized');
    }

    while (iterations++ < maxIterations) {
      if (verbose) {
        console.log(`🔄 Gemini tool call iteration ${iterations}`);
        console.log(`📋 Contents length: ${contents.length}`);
        console.log(`📋 Contents structure:`, JSON.stringify(contents, null, 2));
      }

      try {
        // Send current contents to Gemini
        const result = await geminiProvider.sendMessageWithTools(contents, functionDeclarations);

        // Check for function call
        const toolCall = result?.tool_calls?.[0];
        if (toolCall && toolCall.function) {
          if (verbose) {
            console.log(`🔧 Executing tool: ${toolCall.function.name}`);
          }

          // Append function call as model message
          const functionCallPart = {
            functionCall: {
              name: toolCall.function.name,
              args: JSON.parse(toolCall.function.arguments)
            }
          };
          contents.push(buildGeminiMessage('model', functionCallPart));

          // Execute tool
          let toolResult;
          try {
            const tool = this.tools.get(toolCall.function.name);
            if (!tool) throw new Error(`Tool ${toolCall.function.name} not found`);
            const result = await tool.execute(JSON.parse(toolCall.function.arguments));
            toolResult = result.success ? result.output : { error: result.error };
          } catch (err) {
            toolResult = { error: err instanceof Error ? err.message : String(err) };
          }

          // Append function response as user message
          const functionResponsePart = {
            functionResponse: {
              name: toolCall.function.name,
              response: { result: toolResult }
            }
          };
          contents.push(buildGeminiMessage('user', functionResponsePart));

          continue;
        }

        // No tool call, return final response
        if (verbose) {
          console.log('✅ Final response received');
        }
        return result.content || '';

      } catch (error) {
        console.error(`❌ Error in Gemini chat loop iteration ${iterations}:`, error);
        if (verbose) {
          console.error('Contents that caused error:', JSON.stringify(contents, null, 2));
        }
        throw error;
      }
    }
    throw new Error('Max Gemini tool call iterations reached');
  }
}