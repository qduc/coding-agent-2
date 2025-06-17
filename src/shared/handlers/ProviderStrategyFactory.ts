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
    
    if (verbose) {
      console.log(chalk.blue(`🤖 Sending ${messages.length} messages to Anthropic with ${schemas.length} tools`));
    }
    
    // Use sendMessageWithTools for Anthropic - the provider has comprehensive tool support
    return await this.llmService.sendMessageWithTools(messages, schemas);
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
    
    // Use sendMessageWithTools for OpenAI
    return await this.llmService.sendMessageWithTools(messages, schemas);
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
    const schemas = this.getToolSchemas(tools);
    
    // Convert conversation messages to proper format
    const geminiMessages = this.convertMessagesToGeminiFormat(messages);
    
    if (verbose) {
      console.log(chalk.blue(`🤖 Sending ${geminiMessages.length} messages to Gemini with ${schemas.length} tools`));
    }
    
    // Use sendMessageWithTools with tools
    return await this.llmService.sendMessageWithTools(geminiMessages, schemas);
  }

  private convertMessagesToGeminiFormat(messages: ConversationMessage[]): any[] {
    // Just pass through the messages - let the Gemini provider handle the conversion
    // since it has better logic for handling tool results and conversation context
    return messages;
  }

  private getToolSchemas(tools: BaseTool[]): any[] {
    const toolSchemas = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.getFunctionCallSchema().parameters
    }));
    return SchemaAdapter.convertToGemini(toolSchemas);
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