import { GoogleGenerativeAI, Content, Part, Tool } from '@google/generative-ai';
import { BaseLLMProvider } from '../BaseLLMProvider';
import { Message, StreamingResponse, FunctionCallResponse } from '../../types/llm';
import { SchemaAdapter } from '../schemaAdapter';

/**
 * Google Gemini provider implementation
 */
export class GeminiProvider extends BaseLLMProvider {
  private genAI: GoogleGenerativeAI | null = null;

  getProviderName(): string {
    return 'gemini';
  }

  protected getDefaultModel(): string {
    return 'gemini-2.5-flash-preview-05-20';
  }

  /**
   * Initialize Gemini client
   */
  async initialize(): Promise<boolean> {
    try {
      this.refreshConfig();
      
      if (!this.validateApiKey(this.config.geminiApiKey, 'GEMINI_API_KEY')) {
        return false;
      }

      this.genAI = new GoogleGenerativeAI(this.config.geminiApiKey!);
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize Gemini provider:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Convert messages to Gemini parts format, allowing passthrough for Gemini-native messages
   */
  private convertMessagesToParts(messages: any[]): Content[] {
    const convertedMessages: Content[] = [];
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      
      // Handle Gemini-native format
      if (msg.parts) {
        if (!msg.parts || msg.parts.length === 0) {
          continue; // Skip empty parts rather than throwing
        }
        convertedMessages.push(msg);
        continue;
      }
      
      // Handle tool results (role: 'tool')
      if (msg.role === 'tool' && msg.tool_call_id) {
        // Find the corresponding tool call in previous messages to get the function name
        let functionName = 'unknown_function';
        for (let j = i - 1; j >= 0; j--) {
          const prevMsg = messages[j];
          if (prevMsg.role === 'assistant' && prevMsg.tool_calls) {
            const toolCall = prevMsg.tool_calls.find((tc: any) => tc.id === msg.tool_call_id);
            if (toolCall) {
              functionName = toolCall.function.name;
              break;
            }
          }
        }
        
        // Convert tool result to Gemini function response format
        convertedMessages.push({
          role: 'user',
          parts: [{
            functionResponse: {
              name: functionName,
              response: { result: msg.content || '' }
            }
          }]
        });
        continue;
      }
      
      // Handle assistant messages with tool calls
      if (msg.role === 'assistant' && msg.tool_calls) {
        const parts: Part[] = [];
        
        // Add text content if present
        if (msg.content) {
          parts.push({ text: msg.content });
        }
        
        // Add tool calls as function calls
        for (const toolCall of msg.tool_calls) {
          try {
            const args = typeof toolCall.function.arguments === 'string' 
              ? this.parseToolArguments(toolCall.function.arguments)
              : toolCall.function.arguments;
            
            parts.push({
              functionCall: {
                name: toolCall.function.name,
                args
              }
            });
          } catch (error) {
            console.warn(`Failed to parse tool call arguments for ${toolCall.function.name}:`, error);
          }
        }
        
        if (parts.length > 0) {
          convertedMessages.push({
            role: 'model',
            parts
          });
        }
        continue;
      }
      
      // Handle regular messages
      const parts: Part[] = [];
      if (msg.content) {
        parts.push({ text: msg.content });
      }
      
      if (parts.length > 0) {
        convertedMessages.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts
        });
      }
    }
    
    return convertedMessages;
  }

  /**
   * Convert tools to Gemini function declarations format
   * Uses SchemaAdapter to handle schema transformation and strip unsupported fields
   */
  private convertToolsToGeminiFormat(functions: any[]): Tool[] {
    // Normalize tools first, then convert to Gemini format
    const normalizedTools = this.validateAndNormalizeTools(functions);
    const geminiDeclarations = SchemaAdapter.convertToGemini(normalizedTools);

    return [{
      functionDeclarations: geminiDeclarations
    }];
  }

  protected async _streamMessage(
    messages: Message[],
    onChunk: (chunk: string) => void,
    onComplete?: (response: StreamingResponse) => void,
    functions?: any[]
  ): Promise<StreamingResponse> {
    this.ensureInitialized();

    if (!this.genAI) {
      throw new Error('Gemini client not initialized');
    }

    this.logApiCall('streamMessage', messages.length);

    const model = this.genAI.getGenerativeModel({
      model: this.getModelName(),
      generationConfig: {
        maxOutputTokens: this.config.maxTokens || 8000
      }
    });

    try {
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
    } catch (error) {
      throw this.formatError(error, 'streamMessage');
    }
  }

  protected async _sendMessage(messages: Message[], functions?: any[]): Promise<string> {
    this.ensureInitialized();

    if (!this.genAI) {
      throw new Error('Gemini client not initialized');
    }

    this.logApiCall('sendMessage', messages.length);

    const model = this.genAI.getGenerativeModel({
      model: this.getModelName(),
      generationConfig: {
        maxOutputTokens: this.config.maxTokens || 8000
      }
    });

    try {
      const contents = this.convertMessagesToParts(messages);
      const result = await model.generateContent({ contents });
      return result.response.text();
    } catch (error) {
      throw this.formatError(error, 'sendMessage');
    }
  }

  protected async _sendMessageWithTools(
    messages: Message[],
    functions: any[] = [],
    onToolCall?: (toolName: string, args: any) => void
  ): Promise<FunctionCallResponse> {
    this.ensureInitialized();

    if (!this.genAI) {
      throw new Error('Gemini client not initialized');
    }

    const normalizedFunctions = this.validateAndNormalizeTools(functions);
    this.logApiCall('sendMessageWithTools', messages.length, { functionsCount: normalizedFunctions.length });

    const model = this.genAI.getGenerativeModel({
      model: this.getModelName(),
      generationConfig: {
        maxOutputTokens: this.config.maxTokens || 8000
      },
      tools: normalizedFunctions.length > 0 ? this.convertToolsToGeminiFormat(normalizedFunctions) : undefined
    });

    try {
      const contents = this.convertMessagesToParts(messages);
      const result = await model.generateContent({ contents });

      // Handle tool calls
      const toolCalls: any[] = [];
      const response = result.response;
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.functionCall) {
            const { name, args } = part.functionCall;
            const parsedArgs = typeof args === 'string' ? this.parseToolArguments(args) : args;

            this.handleToolCall(name, parsedArgs, onToolCall);

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
        content: toolCalls.length > 0 ? null : response.text(),
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop'
      };
    } catch (error) {
      throw this.formatError(error, 'sendMessageWithTools');
    }
  }

  protected async _streamMessageWithTools(
    messages: Message[],
    functions: any[] = [],
    onChunk?: (chunk: string) => void,
    onToolCall?: (toolName: string, args: any) => void
  ): Promise<FunctionCallResponse> {
    // Gemini doesn't support streaming with tool calls yet
    return this._sendMessageWithTools(messages, functions, onToolCall);
  }
}