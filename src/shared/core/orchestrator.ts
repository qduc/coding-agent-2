/**
 * Tool Orchestrator - Coordinates between LLM and tools
 *
 * Refactored to use separate handler classes for better maintainability.
 * 
 * Infinite loop detection:
 * Instead of using a fixed maximum iteration count, this implementation uses multiple
 * approaches to detect infinite loops:
 * 1. Time-based limits: Stops execution after 5 minutes
 * 2. Pattern detection: Identifies repetitive sequences of tool calls
 * 3. Excessive calls: Detects when the same tool is called many times in succession
 * 4. Total call limit: Stops after 30 total tool calls without resolution
 * 
 * This approach is more flexible than a fixed iteration count and provides better
 * feedback about why the process was stopped.
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

    // Instead of a fixed iteration count, use a combination of approaches to detect infinite loops
    const startTime = Date.now();
    const MAX_EXECUTION_TIME = 10 * 60 * 1000; // 10 minutes max execution time
    const toolCallHistory: { name: string, args: string }[] = [];
    let fullResponse = '';

    // Loop until we get a final response or detect an infinite loop
    while (true) {
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

          // Check for time limit
          const executionTime = Date.now() - startTime;
          if (executionTime > MAX_EXECUTION_TIME) {
            if (verbose) {
              console.log(chalk.red(`⏱️ Time limit exceeded: ${Math.round(executionTime / 1000)} seconds (limit: ${MAX_EXECUTION_TIME / 1000} seconds)`));
            }
            throw new Error(`Maximum execution time reached (${Math.round(executionTime / 1000)} seconds)`);
          }

          // Execute each tool call and track in history
          for (const toolCall of response.tool_calls) {
            // Track tool call for pattern detection
            const toolName = toolCall.function.name;
            const toolArgs = toolCall.function.arguments;
            toolCallHistory.push({ name: toolName, args: toolArgs });

            // Execute the tool
            const result = await this.toolExecutionHandler.executeToolCall(toolCall, verbose);
            this.conversationManager.addToolResult(result.content, result.toolCallId);
          }

          // Check for repetitive patterns that might indicate an infinite loop
          const loopDetected = this.detectRepetitivePattern(toolCallHistory);
          if (loopDetected.detected) {
            if (verbose) {
              console.log(chalk.red(`🔄 Infinite loop detected: ${loopDetected.reason}`));
            }
            throw new Error(`Detected repetitive tool call pattern: ${loopDetected.reason}`);
          }

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

    return fullResponse;
  }

  /**
   * Detect repetitive patterns in tool calls that might indicate an infinite loop
   * @param toolCallHistory Array of tool calls with name and arguments
   * @returns Object with detected flag and reason for detection
   */
  private detectRepetitivePattern(toolCallHistory: { name: string, args: string }[]): { detected: boolean, reason: string } {
    // Need at least a few calls to detect a pattern
    if (toolCallHistory.length < 6) {
      return { detected: false, reason: '' };
    }

    // Check for the same tool being called repeatedly with similar arguments
    const recentCalls = toolCallHistory.slice(-10); // Look at the last 10 calls

    // Check for exact repetition (same sequence repeating)
    for (let patternLength = 2; patternLength <= 5; patternLength++) {
      // Get the most recent pattern of length patternLength
      const pattern = recentCalls.slice(-patternLength);

      // Check if this pattern repeats in the history
      const previousPattern = recentCalls.slice(-2 * patternLength, -patternLength);

      if (pattern.length === patternLength && previousPattern.length === patternLength) {
        // Compare the patterns
        let isRepeating = true;
        let similaritySum = 0;

        for (let i = 0; i < patternLength; i++) {
          if (pattern[i].name !== previousPattern[i].name) {
            isRepeating = false;
            break;
          }

          // For arguments, we do a similarity check rather than exact match
          // as arguments might have small variations but still be in a loop
          const similarity = this.calculateArgumentSimilarity(
            pattern[i].args,
            previousPattern[i].args
          );

          similaritySum += similarity;

          if (similarity < 0.9) { // 90% similarity threshold
            isRepeating = false;
            break;
          }
        }

        if (isRepeating) {
          const toolNames = pattern.map(p => p.name).join(', ');
          const avgSimilarity = (similaritySum / patternLength * 100).toFixed(1);
          return { 
            detected: true, 
            reason: `Repeating pattern of ${patternLength} tools (${toolNames}) with ${avgSimilarity}% argument similarity`
          };
        }
      }
    }

    // Check for the same tool being called many times in a row
    const lastTool = recentCalls[recentCalls.length - 1]?.name;
    if (lastTool) {
      const sameToolCount = recentCalls.filter(call => call.name === lastTool).length;
      
      // Set tool-specific limits - exploratory tools get higher limits
      const exploratoryTools = ['read', 'glob', 'ripgrep', 'ls'];
      const limit = exploratoryTools.includes(lastTool) ? 12 : 8;
      
      if (sameToolCount >= limit) {
        return { 
          detected: true, 
          reason: `Same tool '${lastTool}' called ${sameToolCount} times in the last ${recentCalls.length} calls (limit: ${limit})`
        };
      }
    }

    // Check for excessive total calls
    if (toolCallHistory.length > 50) {
      return {
        detected: true,
        reason: `Excessive number of tool calls (${toolCallHistory.length}) without resolution`
      };
    }

    return { detected: false, reason: '' };
  }

  /**
   * Calculate similarity between two JSON argument strings
   * @param args1 First JSON argument string
   * @param args2 Second JSON argument string
   * @returns Similarity score between 0 and 1
   */
  private calculateArgumentSimilarity(args1: string, args2: string): number {
    try {
      // Parse JSON arguments
      const obj1 = JSON.parse(args1);
      const obj2 = JSON.parse(args2);

      // Get all keys from both objects
      const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

      let matchingKeys = 0;
      let totalKeys = 0;

      // Compare values for each key
      for (const key of allKeys) {
        totalKeys++;

        // If both objects have the key and values are similar
        if (key in obj1 && key in obj2) {
          const val1 = obj1[key];
          const val2 = obj2[key];

          // For strings, check if they're very similar
          if (typeof val1 === 'string' && typeof val2 === 'string') {
            if (val1 === val2 || 
                (val1.length > 10 && val2.includes(val1.substring(0, 10))) || 
                (val2.length > 10 && val1.includes(val2.substring(0, 10)))) {
              matchingKeys++;
            }
          } 
          // For other types, check for equality
          else if (val1 === val2) {
            matchingKeys++;
          }
        }
      }

      return matchingKeys / totalKeys;
    } catch (e) {
      // If we can't parse the JSON, compare as strings
      const minLength = Math.min(args1.length, args2.length);
      const maxLength = Math.max(args1.length, args2.length);

      if (minLength === 0) return maxLength === 0 ? 1 : 0;

      // Count matching characters
      let matchingChars = 0;
      for (let i = 0; i < minLength; i++) {
        if (args1[i] === args2[i]) {
          matchingChars++;
        }
      }

      return matchingChars / maxLength;
    }
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
