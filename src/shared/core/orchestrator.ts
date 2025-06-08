/**
 * Tool Orchestrator - Coordinates between LLM and tools
 *
 * Refactored to use separate handler classes for better maintainability.
 */

import { BaseTool } from '../tools';
import { LLMService } from '../services/llm';
import chalk from 'chalk';
import { ProjectDiscoveryResult } from '../utils/projectDiscovery';
import { ConversationManager } from '../handlers/ConversationManager';
import { ToolExecutionHandler } from '../handlers/ToolExecutionHandler';
import { ProviderStrategyFactory, ProviderStrategy } from '../handlers/ProviderStrategyFactory';
import { SystemPromptBuilder } from '../utils/SystemPromptBuilder';

// Define interfaces locally to avoid import issues
export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
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
  private conversationManager: ConversationManager;
  private toolExecutionHandler: ToolExecutionHandler;
  private systemPromptBuilder: SystemPromptBuilder;
  private providerStrategy: ProviderStrategy;

  constructor(
    private llmService: LLMService,
    tools: BaseTool[] = []
  ) {
    this.conversationManager = new ConversationManager();
    this.toolExecutionHandler = new ToolExecutionHandler(tools);
    this.systemPromptBuilder = new SystemPromptBuilder();
    // Don't initialize provider strategy yet - will be done in Agent.initialize()
    this.providerStrategy = {} as ProviderStrategy; // Placeholder
  }

  /**
   * Initialize provider strategy after LLM service is ready
   */
  initializeProviderStrategy(): void {
    if (this.llmService.isReady()) {
      this.providerStrategy = ProviderStrategyFactory.createStrategy(
        this.llmService.getProviderName(),
        this.llmService,
        this.toolExecutionHandler
      );
      // Also initialize system prompt builder with LLM service
      this.initializeSystemPromptBuilder();
    }
  }

  /**
   * Register a new tool
   */
  registerTool(tool: BaseTool): void {
    this.toolExecutionHandler.registerTool(tool);
    // Update provider strategy to reflect new tools if LLM service is ready
    if (this.llmService.isReady()) {
      this.providerStrategy = ProviderStrategyFactory.createStrategy(
        this.llmService.getProviderName(),
        this.llmService,
        this.toolExecutionHandler
      );
    }
  }

  /**
   * Set project context from discovery results
   */
  setProjectContext(projectContext: ProjectDiscoveryResult): void {
    this.systemPromptBuilder.setProjectContext(projectContext);
  }

  /**
   * Initialize system prompt builder with LLM service
   */
  private initializeSystemPromptBuilder(): void {
    if (this.llmService.isReady()) {
      this.systemPromptBuilder.setLLMService(this.llmService);
    }
  }

  /**
   * Get all registered tools
   */
  getRegisteredTools(): BaseTool[] {
    return this.toolExecutionHandler.getRegisteredTools();
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
    this.conversationManager.addUserMessage(userInput);

    let maxIterations = 20; // Prevent infinite loops
    let fullResponse = '';

    while (maxIterations > 0) {
      if (verbose) {
        console.log(chalk.blue('🔄 Processing with LLM...'));
      }

      // Build messages for this request with AI-powered task-aware context
      const systemMessage = await this.systemPromptBuilder.createSystemMessage(
        this.toolExecutionHandler.getRegisteredTools(),
        userInput
      );
      const messages = this.conversationManager.buildMessages(systemMessage);

      try {
        // Use provider-specific strategy
        const response = await this.providerStrategy.processMessage(
          messages,
          this.toolExecutionHandler.getRegisteredTools(),
          onChunk,
          verbose
        );

        // Check if LLM wants to call tools
        if (response.tool_calls && response.tool_calls.length > 0) {
          if (verbose) {
            console.log(chalk.yellow(`🔧 LLM wants to call ${response.tool_calls.length} tool(s)`));
          }

          // Add assistant's tool call message
          this.conversationManager.addAssistantMessage(response.content, response.tool_calls);

          // Execute each tool call
          for (const toolCall of response.tool_calls) {
            const result = await this.toolExecutionHandler.executeToolCall(toolCall, verbose);
            this.conversationManager.addToolResult(result.content, result.toolCallId);
          }

          maxIterations--;
          continue; // Continue the conversation loop
        } else {
          // No tool calls, this is the final response
          fullResponse = response.content || '';

          // Add to conversation history
          this.conversationManager.addAssistantMessage(fullResponse);

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
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationManager.clearHistory();
  }

  /**
   * Get conversation history
   */
  getHistory(): ConversationMessage[] {
    return this.conversationManager.getHistory();
  }

  /**
   * Get conversation summary for debugging
   */
  getConversationSummary(): string {
    return this.conversationManager.getConversationSummary();
  }

  /**
   * Get tool schemas in the format expected by native tool calling
   * Uses SchemaAdapter to ensure compatibility with different providers
   */
  getToolSchemas(): any[] {
    const provider = this.llmService.getProviderName();
    const toolSchemas = this.toolExecutionHandler.getRegisteredTools().map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.schema
    }));

    // Transform based on provider
    switch (provider) {
      case 'anthropic':
        return toolSchemas;
      case 'gemini':
        // For Gemini, we need to convert to function declarations
        return toolSchemas.map(tool => ({
          name: tool.name,
          description: tool.description,
          input_schema: {
            type: tool.input_schema.type,
            properties: tool.input_schema.properties || {},
            required: tool.input_schema.required || []
          }
        }));
      default:
        // Default format (also works for OpenAI when needed)
        return toolSchemas;
    }
  }

  /**
   * Legacy method for backwards compatibility
   * Use the enhanced provider strategy approach instead
   */
  async processWithEnhancedNativeCalling(
    userInput: string,
    onChunk?: (chunk: string) => void,
    verbose?: boolean
  ): Promise<string> {
    if (verbose) {
      console.log('🚀 Using enhanced native tool calling (delegating to processMessage)');
    }
    return this.processMessage(userInput, onChunk, verbose);
  }

  /**
   * Legacy method for backwards compatibility
   * Redirects to the main processMessage method
   */
  async processWithNativeToolLoop(
    userInput: string,
    onChunk?: (chunk: string) => void,
    verbose: boolean = false
  ): Promise<string> {
    if (verbose) {
      console.log('🔄 Using native tool loop (delegating to processMessage)');
    }
    return this.processMessage(userInput, onChunk, verbose);
  }
}
