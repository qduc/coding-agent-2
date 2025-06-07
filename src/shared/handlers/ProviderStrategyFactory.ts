/**
 * ProviderStrategyFactory - Creates provider-specific strategies for tool calling
 */

import { LLMService } from '../services/llm';
import { SchemaAdapter } from '../services/schemaAdapter';
import { BaseTool } from '../tools';
import { ConversationMessage } from './ConversationManager';
import { ToolExecutionHandler, ToolCall } from './ToolExecutionHandler';
import chalk from 'chalk';

export interface ProviderStrategy {
  processMessage(
    messages: ConversationMessage[],
    tools: BaseTool[],
    onChunk?: (chunk: string) => void,
    verbose?: boolean
  ): Promise<{
    content: string | null;
    tool_calls?: any[];
  }>;
}

export class AnthropicStrategy implements ProviderStrategy {
  constructor(private llmService: LLMService) {}

  async processMessage(
    messages: ConversationMessage[],
    tools: BaseTool[],
    onChunk?: (chunk: string) => void,
    verbose?: boolean
  ): Promise<{ content: string | null; tool_calls?: any[] }> {
    const schemas = this.getToolSchemas(tools);
    
    if (schemas.length > 0) {
      // Use non-streaming for Anthropic with tools to avoid streaming tool input issues
      return await this.llmService.sendMessageWithTools(messages, schemas);
    } else {
      // Use streaming when no tools
      return await this.llmService.streamMessageWithTools(messages, schemas, onChunk);
    }
  }

  private getToolSchemas(tools: BaseTool[]): any[] {
    const toolSchemas = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.getFunctionCallSchema().parameters
    }));
    return SchemaAdapter.convertToAnthropic(toolSchemas);
  }
}

export class OpenAIStrategy implements ProviderStrategy {
  constructor(private llmService: LLMService) {}

  async processMessage(
    messages: ConversationMessage[],
    tools: BaseTool[],
    onChunk?: (chunk: string) => void,
    verbose?: boolean
  ): Promise<{ content: string | null; tool_calls?: any[] }> {
    const schemas = this.getToolSchemas(tools);
    
    // Use streaming for OpenAI
    return await this.llmService.streamMessageWithTools(messages, schemas, onChunk);
  }

  private getToolSchemas(tools: BaseTool[]): any[] {
    const toolSchemas = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.getFunctionCallSchema().parameters
    }));
    return SchemaAdapter.convertToOpenAI(toolSchemas);
  }
}

export class GeminiStrategy implements ProviderStrategy {
  constructor(
    private llmService: LLMService,
    private toolExecutionHandler: ToolExecutionHandler
  ) {}

  async processMessage(
    messages: ConversationMessage[],
    tools: BaseTool[],
    onChunk?: (chunk: string) => void,
    verbose?: boolean
  ): Promise<{ content: string | null; tool_calls?: any[] }> {
    // For Gemini, we need to use the chat loop approach
    const functionDeclarations = this.convertToGeminiFunctionDeclarations(tools);
    
    // Extract user input from messages (last user message)
    const userMessage = messages.filter(m => m.role === 'user').pop();
    if (!userMessage?.content) {
      throw new Error('No user message found');
    }

    return await this.processGeminiChatLoop(
      userMessage.content,
      functionDeclarations,
      onChunk,
      verbose
    );
  }

  private async processGeminiChatLoop(
    userInput: string,
    functionDeclarations: any[],
    onChunk?: (chunk: string) => void,
    verbose?: boolean,
    maxIterations: number = 10
  ): Promise<{ content: string | null; tool_calls?: any[] }> {
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
            const tool = this.toolExecutionHandler.getTool(toolCall.function.name);
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
        return { content: result.content || '', tool_calls: undefined };

      } catch (error) {
        console.error(`❌ Error in Gemini chat loop iteration ${iterations}:`, error);
        throw error;
      }
    }
    throw new Error('Max Gemini tool call iterations reached');
  }

  private convertToGeminiFunctionDeclarations(tools: BaseTool[]): any[] {
    return tools.map(tool => {
      const schema = tool.getFunctionCallSchema();
      let parameters = schema.parameters;

      // Normalize parameters.type for compatibility
      if (parameters && typeof parameters.type === 'string' && parameters.type.toLowerCase() === 'object') {
        parameters = { ...parameters, type: 'object' };
      }

      return {
        name: tool.name,
        description: tool.description,
        parameters
      };
    });
  }
}

export class ProviderStrategyFactory {
  static createStrategy(
    providerName: string,
    llmService: LLMService,
    toolExecutionHandler: ToolExecutionHandler
  ): ProviderStrategy {
    switch (providerName) {
      case 'anthropic':
        return new AnthropicStrategy(llmService);
      case 'openai':
        return new OpenAIStrategy(llmService);
      case 'gemini':
        return new GeminiStrategy(llmService, toolExecutionHandler);
      default:
        // Default to OpenAI strategy for backwards compatibility
        return new OpenAIStrategy(llmService);
    }
  }
}