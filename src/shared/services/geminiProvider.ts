import { GoogleGenerativeAI, Content, Part, GenerateContentRequest, Tool, FunctionDeclaration, GenerateContentResult } from '@google/generative-ai';
import chalk from 'chalk';
import { configManager } from '../core/config';
import { LLMProvider, Message, StreamingResponse, FunctionCallResponse } from './llm';
import { ToolLogger } from '../utils/toolLogger';
import { SchemaAdapter } from './schemaAdapter';

/**
 * Google Gemini provider implementation
 */
export class GeminiProvider implements LLMProvider {
  private genAI: GoogleGenerativeAI | null = null;
  private initialized = false;

  getProviderName(): string {
    return 'gemini';
  }

  /**
   * Initialize Gemini client
   */
  async initialize(): Promise<boolean> {
    try {
      const config = configManager.getConfig();
      if (!config.geminiApiKey) {
        return false;
      }

      this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
      this.initialized = true;
      return true;
    } catch (error) {
      console.error(chalk.red('Failed to initialize Gemini provider:'), error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Convert messages to Gemini parts format
   */
  /**
   * Convert messages to Gemini parts format, allowing passthrough for Gemini-native messages
   */
  private convertMessagesToParts(messages: any[]): Content[] {
    return messages.map(msg => {
      if (msg.parts) {
        // Already Gemini-native format - ensure parts is not empty
        if (!msg.parts || msg.parts.length === 0) {
          throw new Error('Gemini message parts cannot be empty');
        }
        return msg;
      }
      const parts: Part[] = [];
      if (msg.content) {
        parts.push({ text: msg.content });
      }

      // Ensure we don't create messages with empty parts
      if (parts.length === 0) {
        // Skip messages with no content rather than creating empty parts
        return null;
      }

      return {
        role: msg.role === 'user' ? 'user' : 'model',
        parts
      };
    }).filter(Boolean); // Remove null entries
  }

  /**
   * Convert tools to Gemini function declarations format
   * Uses SchemaAdapter to handle schema transformation and strip unsupported fields
   */
  private convertToolsToGeminiFormat(functions: any[]): Tool[] {
    // Normalize tools first, then convert to Gemini format
    const normalizedTools = SchemaAdapter.normalizeAll(functions);
    const geminiDeclarations = SchemaAdapter.convertToGemini(normalizedTools);

    return [{
      functionDeclarations: geminiDeclarations
    }];
  }

  async streamMessage(
    messages: Message[],
    onChunk: (chunk: string) => void,
    onComplete?: (response: StreamingResponse) => void
  ): Promise<StreamingResponse> {
    if (!this.genAI) {
      throw new Error('Gemini client not initialized');
    }

    const config = configManager.getConfig();
    const model = this.genAI.getGenerativeModel({
      model: config.model || 'gemini-2.5-flash-preview-05-20',
      generationConfig: {
        maxOutputTokens: config.maxTokens || 8000
      }
    });

    const contents = this.convertMessagesToParts(messages);
    const result = await model.generateContentStream({ contents });

    let fullContent = '';
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullContent += chunkText;
      onChunk(chunkText);
    }

    const response = {
      content: fullContent,
      finishReason: 'stop'
    };

    if (onComplete) {
      onComplete(response);
    }

    return response;
  }

  async sendMessage(messages: Message[]): Promise<string> {
    if (!this.genAI) {
      throw new Error('Gemini client not initialized');
    }

    const config = configManager.getConfig();
    const model = this.genAI.getGenerativeModel({
      model: config.model || 'gemini-2.5-flash-preview-05-20',
      generationConfig: {
        maxOutputTokens: config.maxTokens || 8000
      }
    });

    const contents = this.convertMessagesToParts(messages);
    const result = await model.generateContent({ contents });
    return result.response.text();
  }

  async sendMessageWithTools(
    messages: Message[],
    functions: any[] = [],
    onToolCall?: (toolName: string, args: any) => void
  ): Promise<FunctionCallResponse> {
    if (!this.genAI) {
      throw new Error('Gemini client not initialized');
    }

    const config = configManager.getConfig();
    const model = this.genAI.getGenerativeModel({
      model: config.model || 'gemini-2.5-flash-preview-05-20',
      generationConfig: {
        maxOutputTokens: config.maxTokens || 8000
      },
      tools: this.convertToolsToGeminiFormat(functions)
    });

    const contents = this.convertMessagesToParts(messages);

    const result = await model.generateContent({ contents });

    // Handle tool calls
    const toolCalls: any[] = [];
    const response = result.response;
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.functionCall) {
          const { name, args } = part.functionCall;
          const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;

          if (onToolCall) {
            onToolCall(name, parsedArgs);
          }

          toolCalls.push({
            id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            function: {
              name,
              arguments: JSON.stringify(parsedArgs)
            }
          });
        }
      }
    }

    return {
      content: response.text(),
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop'
    };
  }

  async streamMessageWithTools(
    messages: Message[],
    functions: any[] = [],
    onChunk?: (chunk: string) => void,
    onToolCall?: (toolName: string, args: any) => void
  ): Promise<FunctionCallResponse> {
    // Gemini doesn't support streaming with tool calls yet
    return this.sendMessageWithTools(messages, functions, onToolCall);
  }
}
