import OpenAI from 'openai';
import { LLMProvider, Message, StreamingResponse, FunctionCallResponse, ResponsesApiResponse, ResponsesInput, ReasoningConfig } from '../types/llm';
import { configManager } from '../core/config';
import { logger } from '../utils/logger';
import { ToolLogger } from '../utils/toolLogger';
import { SchemaAdapter } from '../services/schemaAdapter';

export class OpenAIProvider implements LLMProvider {
  private openai: OpenAI | null = null;
  private initialized = false;
  private previousResponseId: string | null = null; // For multi-turn Responses API

  getProviderName(): string {
    return 'openai';
  }

  getModelName(): string {
    return this.config.model || 'gpt-4';
  }

  async initialize(): Promise<boolean> {
    try {
      const config = configManager.getConfig();
      const isOpenRouter = config.openaiApiBaseUrl?.includes('openrouter.ai');
      const apiKey = isOpenRouter ? process.env.OPENROUTER_API_KEY : config.openaiApiKey;

      if (!apiKey) {
        logger.error(`${isOpenRouter ? 'OpenRouter' : 'OpenAI'} API key not configured`, undefined, {}, 'OpenAIProvider');
        return false;
      }

      const baseURL = isOpenRouter
        ? 'https://openrouter.ai/api/v1'
        : (config.openaiApiBaseUrl || 'https://api.openai.com/v1');

      this.openai = new OpenAI({
        apiKey,
        baseURL,
        defaultHeaders: isOpenRouter ? {
          'HTTP-Referer': 'https://github.com/qduc/coding-agent',
          'X-Title': 'coding-agent',
          'OpenAI-Organization': 'openrouter',
        } : undefined
      });

      // Test the connection
      await this.testConnection(!!isOpenRouter);
      this.initialized = true;
      logger.info(`${isOpenRouter ? 'OpenRouter' : 'OpenAI'} provider initialized successfully`, { model: config.model }, 'OpenAIProvider');
      return true;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Unknown error');
      logger.error(`Failed to initialize OpenAI provider`, errorObj, {}, 'OpenAIProvider');
      return false;
    }
  }

  private async testConnection(isOpenRouter: boolean): Promise<void> {
    if (!this.openai) throw new Error('OpenAI client not initialized');

    try {
      if (isOpenRouter) {
        await this.openai.chat.completions.create({
          messages: [{ role: 'user', content: 'test' }],
          model: 'openai/gpt-3.5-turbo',
          max_tokens: 1
        });
      } else {
        await this.openai.models.list();
      }
    } catch (error) {
      // Log the specific error for debugging
      const errorObj = error instanceof Error ? error : new Error('Unknown error');
      logger.error('Connection test failed', errorObj, { isOpenRouter }, 'OpenAIProvider');
      throw error;
    }
  }

  isReady(): boolean {
    return this.initialized && this.openai !== null;
  }

  async sendMessage(messages: Message[]): Promise<string> {
    const config = configManager.getConfig();
    const model = config.model || 'gpt-4o-2024-11-20';

    // Use Responses API for reasoning models
    if (this.shouldUseResponsesApi(model)) {
      try {
        const input = this.convertMessagesToResponsesInput(messages);
        const response = await this.sendResponsesMessage(input, {
          model,
          reasoning: this.isReasoningModel(model) ? { effort: 'medium' } : undefined,
          store: true,
          previous_response_id: this.previousResponseId || undefined
        });

        return response.output_text || '';
      } catch (error) {
        logger.warn('Responses API failed, falling back to Chat Completions', { model, error: error instanceof Error ? error.message : String(error) }, 'OpenAIProvider');
        // Fall through to Chat Completions API
      }
    }

    try {
      const response = await this.openai!.chat.completions.create({
        model,
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      });

      const responseContent = response.choices[0]?.message?.content || '';

      logger.debug('OpenAI message sent successfully', {
        messageCount: messages.length,
        responseLength: responseContent.length,
        model: model,
        usage: response.usage
      }, 'OpenAIProvider');

      return responseContent;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Unknown OpenAI API error');
      logger.error('OpenAI API error in sendMessage', errorObj, {
        messageCount: messages.length,
        model: model
      }, 'OpenAIProvider');

      if (error instanceof Error) {
        throw new Error(`OpenAI API error: ${error.message}`);
      }
      throw new Error('Unknown OpenAI API error');
    }
  }

  async streamMessage(
    messages: Message[],
    onChunk: (chunk: string) => void,
    onComplete?: (response: StreamingResponse) => void
  ): Promise<StreamingResponse> {
    const config = configManager.getConfig();
    const model = config.model || 'gpt-4-turbo-preview';

    // Use Responses API for reasoning models
    if (this.shouldUseResponsesApi(model)) {
      try {
        const input = this.convertMessagesToResponsesInput(messages);
        const response = await this.streamResponsesMessage(input, {
          model,
          reasoning: this.isReasoningModel(model) ? { effort: 'medium' } : undefined,
          store: true,
          previous_response_id: this.previousResponseId || undefined
        }, onChunk);

        const streamingResponse: StreamingResponse = {
          content: response.output_text || '',
          finishReason: response.status === 'completed' ? 'stop' : null,
          usage: response.usage ? {
            promptTokens: response.usage.input_tokens,
            completionTokens: response.usage.output_tokens,
            totalTokens: response.usage.total_tokens
          } : undefined
        };

        if (onComplete) {
          onComplete(streamingResponse);
        }

        return streamingResponse;
      } catch (error) {
        logger.warn('Responses API streaming failed, falling back to Chat Completions', { model, error: error instanceof Error ? error.message : String(error) }, 'OpenAIProvider');
        // Fall through to Chat Completions API
      }
    }

    try {
      const stream = await this.openai!.chat.completions.create({
        model,
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        stream: true,
      });

      let fullContent = '';
      let finishReason: string | null = null;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.content) {
          fullContent += delta.content;
          onChunk(delta.content);
        }

        if (chunk.choices[0]?.finish_reason) {
          finishReason = chunk.choices[0].finish_reason;
        }
      }

      const response: StreamingResponse = {
        content: fullContent,
        finishReason
      };

      logger.debug('Streaming message completed', {
        messageCount: messages.length,
        responseLength: fullContent.length,
        finishReason
      }, 'OpenAIProvider');

      if (onComplete) {
        onComplete(response);
      }

      return response;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Unknown OpenAI API error');
      logger.error('OpenAI streaming API error', errorObj, {
        messageCount: messages.length,
        model
      }, 'OpenAIProvider');

      if (error instanceof Error) {
        throw new Error(`OpenAI API error: ${error.message}`);
      }
      throw new Error('Unknown OpenAI API error');
    }
  }

  async sendMessageWithTools(
    messages: Message[],
    functions: any[] = [],
    onToolCall?: (toolName: string, args: any) => void
  ): Promise<FunctionCallResponse> {
    const config = configManager.getConfig();

    try {
      const requestParams: any = {
        model: config.model || 'gpt-4o-2024-11-20',
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          ...(msg.tool_calls && { tool_calls: msg.tool_calls }),
          ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id })
        })),
      };

      // Add function calling if functions are provided
      if (functions.length > 0) {
        // Convert tools to OpenAI format using SchemaAdapter
        const normalizedTools = SchemaAdapter.normalizeAll(functions);
        const openAIFunctions = SchemaAdapter.convertToOpenAI(normalizedTools);
        
        requestParams.tools = openAIFunctions.map(func => ({
          type: 'function',
          function: func
        }));
        requestParams.tool_choice = 'auto';
      }

      const response = await this.openai!.chat.completions.create(requestParams);

      const choice = response.choices[0];
      const { logToolUsage } = configManager.getConfig();
      if (choice.message.tool_calls) {
        for (const toolCall of choice.message.tool_calls) {
          const { name, arguments: argsString } = toolCall.function;
          let parsedArgs: any;
          try {
            parsedArgs = JSON.parse(argsString);
          } catch {
            parsedArgs = argsString;
          }
          if (logToolUsage) {
            ToolLogger.logToolCall(name, parsedArgs);
          }
          if (onToolCall) {
            onToolCall(name, parsedArgs);
          }
        }
      }
      return {
        content: choice.message.content,
        tool_calls: choice.message.tool_calls,
        finishReason: choice.finish_reason,
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens
        } : undefined
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`OpenAI API error: ${error.message}`);
      }
      throw new Error('Unknown OpenAI API error');
    }
  }

  async streamMessageWithTools(
    messages: Message[],
    functions: any[] = [],
    onChunk?: (chunk: string) => void,
    onToolCall?: (toolName: string, args: any) => void
  ): Promise<FunctionCallResponse> {
    const config = configManager.getConfig();

    try {
      const requestParams: any = {
        model: config.model || 'gpt-4-turbo-preview',
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          ...(msg.tool_calls && { tool_calls: msg.tool_calls }),
          ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id })
        })),
        stream: true
      };

      // Add function calling if functions are provided
      if (functions.length > 0) {
        // Convert tools to OpenAI format using SchemaAdapter
        const normalizedTools = SchemaAdapter.normalizeAll(functions);
        const openAIFunctions = SchemaAdapter.convertToOpenAI(normalizedTools);
        
        requestParams.tools = openAIFunctions.map(func => ({
          type: 'function',
          function: func
        }));
        requestParams.tool_choice = 'auto';
      }

      const stream = await this.openai!.chat.completions.create(requestParams) as any;

      let fullContent = '';
      let finishReason: string | null = null;
      let toolCalls: any[] | undefined;
      const { logToolUsage } = configManager.getConfig();

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        // Handle content streaming
        if (delta?.content) {
          fullContent += delta.content;
          if (onChunk) {
            onChunk(delta.content);
          }
        }

        // Handle tool calls
        if (delta?.tool_calls) {
          if (!toolCalls) {
            toolCalls = [];
          }

          for (const toolCallDelta of delta.tool_calls) {
            const index = toolCallDelta.index || 0;

            if (!toolCalls[index]) {
              toolCalls[index] = {
                id: toolCallDelta.id,
                type: 'function',
                function: { name: '', arguments: '' }
              };
            }

            if (toolCallDelta.function?.name) {
              toolCalls[index].function.name += toolCallDelta.function.name;
            }

            if (toolCallDelta.function?.arguments) {
              toolCalls[index].function.arguments += toolCallDelta.function.arguments;
            }
          }
        }

        if (chunk.choices[0]?.finish_reason) {
          finishReason = chunk.choices[0].finish_reason;
        }
      }

      // Log and call tool callbacks
      if (toolCalls) {
        for (const toolCall of toolCalls) {
          const { name, arguments: argsString } = toolCall.function;
          let parsedArgs: any;
          try {
            parsedArgs = JSON.parse(argsString);
          } catch {
            parsedArgs = argsString;
          }
          if (logToolUsage) {
            ToolLogger.logToolCall(name, parsedArgs);
          }
          if (onToolCall) {
            onToolCall(name, parsedArgs);
          }
        }
      }

      return {
        content: fullContent || null,
        tool_calls: toolCalls,
        finishReason,
        // Note: streaming doesn't provide usage info in the same way
        usage: undefined
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`OpenAI API error: ${error.message}`);
      }
      throw new Error('Unknown OpenAI API error');
    }
  }

  async sendToolResults(
    messages: Message[],
    toolResults: Array<{ tool_call_id: string; content: string }>,
    functions: any[] = []
  ): Promise<FunctionCallResponse> {
    // Add tool result messages and call sendMessageWithTools
    const updatedMessages = [...messages];
    for (const result of toolResults) {
      updatedMessages.push({
        role: 'tool',
        content: result.content,
        tool_call_id: result.tool_call_id
      });
    }

    return this.sendMessageWithTools(updatedMessages, functions);
  }

  async streamToolResults(
    messages: Message[],
    toolResults: Array<{ tool_call_id: string; content: string }>,
    functions: any[] = [],
    onChunk?: (chunk: string) => void,
    onToolCall?: (toolName: string, args: any) => void
  ): Promise<FunctionCallResponse> {
    // Add tool result messages and call streamMessageWithTools
    const updatedMessages = [...messages];
    for (const result of toolResults) {
      updatedMessages.push({
        role: 'tool',
        content: result.content,
        tool_call_id: result.tool_call_id
      });
    }

    return this.streamMessageWithTools(updatedMessages, functions, onChunk, onToolCall);
  }

  async processWithNativeToolLoop(
    userInput: string,
    tools: any[],
    onChunk?: (chunk: string) => void,
    verbose: boolean = false
  ): Promise<string> {
    // This method is deprecated in favor of the orchestrator pattern
    // For OpenAI, tool execution should be handled by ToolOrchestrator with OpenAIStrategy
    // This implementation provides basic compatibility for legacy code
    
    // Initialize conversation with system message and user input
    let messages: Message[] = [
      {
        role: 'system',
        content: `You are an expert coding assistant specialized in helping developers understand, analyze, and work with their codebase.`
      },
      { role: 'user', content: userInput }
    ];

    try {
      // Convert tools to OpenAI format using SchemaAdapter
      const normalizedTools = SchemaAdapter.normalizeAll(tools);
      const openAIFunctions = SchemaAdapter.convertToOpenAI(normalizedTools);
      
      // Send to LLM with tool schemas (single pass)
      const response = await this.streamMessageWithTools(
        messages,
        openAIFunctions,
        onChunk
      );

      // For full tool execution loop, use ToolOrchestrator instead
      if (response.tool_calls && response.tool_calls.length > 0) {
        if (verbose) {
          console.log(`🔧 OpenAI requested ${response.tool_calls.length} tool call(s) - use ToolOrchestrator for full execution`);
        }
        
        // Return indication that tool calls are needed
        return JSON.stringify({
          type: 'tool_calls_required',
          tool_calls: response.tool_calls,
          content: response.content,
          message: 'Use ToolOrchestrator.processMessage() for complete tool execution'
        });
      }

      return response.content || '';
    } catch (error) {
      throw new Error(`Failed to process OpenAI tool loop: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Helper methods for OpenAI Responses API
  protected shouldUseResponsesApi(model: string): boolean {
    // Determine if this model should use the Responses API instead of Chat Completions
    // For now, we're considering only certain models as "reasoning models"
    return this.isReasoningModel(model);
  }

  protected isReasoningModel(model: string): boolean {
    // Identify models that support or benefit from the Responses API with reasoning
    return model.includes('reasoning');
  }

  protected convertMessagesToResponsesInput(messages: Message[]): ResponsesInput[] {
    // Convert standard chat messages to Responses API format
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content || ''
    })) as ResponsesInput[];
  }

  async sendResponsesMessage(
    input: string | ResponsesInput[],
    options?: {
      model?: string;
      reasoning?: ReasoningConfig;
      tools?: any[];
      include?: string[];
      store?: boolean;
      previous_response_id?: string;
      instructions?: string;
      temperature?: number;
      max_output_tokens?: number;
    }
  ): Promise<ResponsesApiResponse> {
    if (!this.openai) throw new Error('OpenAI client not initialized');

    try {
      const config = configManager.getConfig();
      const defaultModel = config.model || 'gpt-4-turbo-preview';

      // Build request parameters
      const requestParams: any = {
        model: options?.model || defaultModel,
        input: typeof input === 'string' ? input : {
          type: 'conversation',
          messages: input.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        },
        // Optional parameters
        ...(options?.reasoning && { reasoning: options.reasoning }),
        ...(options?.tools && { tools: options.tools }),
        ...(options?.include && { include: options.include }),
        ...(options?.store !== undefined && { store: options.store }),
        ...(options?.previous_response_id && { previous_response_id: options.previous_response_id }),
        ...(options?.instructions && { instructions: options.instructions }),
        ...(options?.temperature !== undefined && { temperature: options.temperature }),
        ...(options?.max_output_tokens && { max_output_tokens: options.max_output_tokens })
      };

      // Call the Responses API
      const response = await (this.openai as any).beta.responses.create(requestParams);

      // Store response ID for multi-turn conversations
      if (response.response_id) {
        this.previousResponseId = response.response_id;
      }

      return {
        response_id: response.response_id,
        output_text: response.output_text,
        status: response.status,
        usage: response.usage ? {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
          total_tokens: response.usage.total_tokens
        } : undefined
      };
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Unknown OpenAI API error');
      logger.error('OpenAI Responses API error', errorObj, {
        modelSpecified: options?.model != null
      }, 'OpenAIProvider');

      throw new Error(`OpenAI Responses API error: ${errorObj.message}`);
    }
  }

  async streamResponsesMessage(
    input: string | ResponsesInput[],
    options?: {
      model?: string;
      reasoning?: ReasoningConfig;
      tools?: any[];
      include?: string[];
      store?: boolean;
      previous_response_id?: string;
      instructions?: string;
      temperature?: number;
      max_output_tokens?: number;
    },
    onChunk?: (chunk: string) => void
  ): Promise<ResponsesApiResponse> {
    if (!this.openai) throw new Error('OpenAI client not initialized');

    try {
      const config = configManager.getConfig();
      const defaultModel = config.model || 'gpt-4-turbo-preview';

      // Build request parameters (same as non-streaming)
      const requestParams: any = {
        model: options?.model || defaultModel,
        input: typeof input === 'string' ? input : {
          type: 'conversation',
          messages: input.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        },
        // Optional parameters
        ...(options?.reasoning && { reasoning: options.reasoning }),
        ...(options?.tools && { tools: options.tools }),
        ...(options?.include && { include: options.include }),
        ...(options?.store !== undefined && { store: options.store }),
        ...(options?.previous_response_id && { previous_response_id: options.previous_response_id }),
        ...(options?.instructions && { instructions: options.instructions }),
        ...(options?.temperature !== undefined && { temperature: options.temperature }),
        ...(options?.max_output_tokens && { max_output_tokens: options.max_output_tokens }),
        // Add streaming
        stream: true
      };

      // Call the Responses API with streaming
      const stream = await (this.openai as any).beta.responses.create(requestParams);

      let responseId: string | undefined;
      let outputText = '';
      let status = 'incomplete';
      let usage: { input_tokens: number; output_tokens: number; total_tokens: number } | undefined;

      for await (const chunk of stream) {
        // Accumulate response ID (should be the same in all chunks)
        if (chunk.response_id && !responseId) {
          responseId = chunk.response_id;
        }

        // Accumulate text content
        if (chunk.delta?.output_text) {
          outputText += chunk.delta.output_text;
          if (onChunk) {
            onChunk(chunk.delta.output_text);
          }
        }

        // Track status
        if (chunk.status) {
          status = chunk.status;
        }

        // Track usage (only present in the final chunk)
        if (chunk.usage) {
          usage = {
            input_tokens: chunk.usage.input_tokens,
            output_tokens: chunk.usage.output_tokens,
            total_tokens: chunk.usage.total_tokens
          };
        }
      }

      // Store response ID for multi-turn conversations
      if (responseId) {
        this.previousResponseId = responseId;
      }

      return {
        response_id: responseId,
        output_text: outputText,
        status,
        usage
      };
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Unknown OpenAI API error');
      logger.error('OpenAI Responses API streaming error', errorObj, {
        modelSpecified: options?.model != null
      }, 'OpenAIProvider');

      throw new Error(`OpenAI Responses API streaming error: ${errorObj.message}`);
    }
  }
}
