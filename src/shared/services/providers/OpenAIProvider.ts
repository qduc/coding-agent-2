import OpenAI from 'openai';
import { BaseLLMProvider } from '../BaseLLMProvider';
import { LLMProvider, Message, FunctionCallResponse, ResponsesApiResponse, ResponsesInput, ReasoningConfig } from '../../types/llm';
import { logger } from '../../utils/logger';
import { SchemaAdapter } from '../schemaAdapter';

export class OpenAIProvider extends BaseLLMProvider {
  private openai: OpenAI | null = null;
  private previousResponseId: string | null = null; // For multi-turn Responses API

  getProviderName(): string {
    return 'openai';
  }

  protected getDefaultModel(): string {
    return 'gpt-4';
  }

  async initialize(): Promise<boolean> {
    try {
      this.refreshConfig();
      const isOpenRouter = this.config.openaiApiBaseUrl?.includes('openrouter.ai');
      const apiKey = isOpenRouter ? process.env.OPENROUTER_API_KEY : this.config.openaiApiKey;

      if (!this.validateApiKey(apiKey, isOpenRouter ? 'OPENROUTER_API_KEY' : 'OPENAI_API_KEY')) {
        return false;
      }

      const baseURL = isOpenRouter
        ? 'https://openrouter.ai/api/v1'
        : (this.config.openaiApiBaseUrl || 'https://api.openai.com/v1');

      this.openai = new OpenAI({
        apiKey: apiKey!,
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
      logger.info(`${isOpenRouter ? 'OpenRouter' : 'OpenAI'} provider initialized successfully`, { model: this.config.model }, 'OpenAIProvider');
      return true;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Unknown error');
      logger.error(`Failed to initialize OpenAI provider`, errorObj, {}, 'OpenAIProvider');
      return false;
    }
  }

  protected async testConnection(isOpenRouter: boolean = false): Promise<void> {
    if (!this.openai) throw new Error('OpenAI client not initialized');

    try {
      if (isOpenRouter) {
        await this.openai.chat.completions.create({
          messages: [{ role: 'user', content: 'test' }],
          model: 'openai/gpt-4.1-mini',
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



  protected async _sendMessageWithTools(
    messages: Message[],
    functions: any[] = [],
    onToolCall?: (toolName: string, args: any) => void
  ): Promise<FunctionCallResponse> {
    this.ensureInitialized();

    const normalizedFunctions = this.validateAndNormalizeTools(functions);
    this.logApiCall('wowsendMessageWithTools', messages.length, { functionsCount: normalizedFunctions.length });

    try {
      const requestParams: any = {
        model: this.getModelName(),
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          ...(msg.tool_calls && { tool_calls: msg.tool_calls }),
          ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id })
        })),
      };

      // Add function calling if functions are provided
      if (normalizedFunctions.length > 0) {
        // Convert tools to OpenAI format using SchemaAdapter
        const openAIFunctions = SchemaAdapter.convertToOpenAI(normalizedFunctions);

        requestParams.tools = openAIFunctions.map(func => ({
          type: 'function',
          function: func
        }));
        requestParams.tool_choice = 'auto';
      }

      const response = await this.openai!.chat.completions.create(requestParams);

      const choice = response.choices[0];
      if (choice.message.tool_calls) {
        for (const toolCall of choice.message.tool_calls) {
          const { name, arguments: argsString } = toolCall.function;
          const parsedArgs = this.parseToolArguments(argsString);
          this.handleToolCall(name, parsedArgs, onToolCall);
        }
      }

      return {
        content: choice.message.content,
        tool_calls: choice.message.tool_calls,
        finishReason: choice.finish_reason,
        usage: this.buildUsageResponse(response.usage)
      };
    } catch (error) {
      throw this.formatError(error, 'sendMessageWithTools');
    }
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
      const normalizedTools = this.validateAndNormalizeTools(tools);
      const openAIFunctions = SchemaAdapter.convertToOpenAI(normalizedTools);

      // Send to LLM with tool schemas (single pass)
      const response = await this.sendMessageWithTools(
        messages,
        openAIFunctions,
        undefined
      );

      // For full tool execution loop, use ToolOrchestrator instead
      if (response.tool_calls && response.tool_calls.length > 0) {
        if (verbose) {
          logger.debug(`🔧 OpenAI requested ${response.tool_calls.length} tool call(s) - use ToolOrchestrator for full execution`, {
            toolCallCount: response.tool_calls.length
          }, 'OpenAIProvider');
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
    // Force using Responses API if configured, regardless of model
    if (this.config.useResponsesApi) {
      return true;
    }

    // Otherwise, use Responses API only for reasoning models
    return this.isReasoningModel(model);
  }

  protected isReasoningModel(model: string): boolean {
    // Identify models that support or benefit from the Responses API with reasoning
    const modelLower = model.toLowerCase();

    // Check for all known reasoning model series (o1, o3, o4)
    if (modelLower.startsWith('codex') || modelLower.startsWith('o1') || modelLower.startsWith('o3') || modelLower.startsWith('o4')) {
      return true;
    }

    // Legacy support for models with 'reasoning' in the name
    return modelLower.includes('reasoning');
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
    this.ensureInitialized();

    if (!this.openai) throw new Error('OpenAI client not initialized');

    try {
      const defaultModel = this.getModelName();

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

}