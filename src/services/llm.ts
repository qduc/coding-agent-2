import OpenAI from 'openai';
import chalk from 'chalk';
import { configManager } from '../core/config';
import * as os from 'os';
import { execSync } from 'child_process';
import { ToolLogger } from '../utils/toolLogger';
import { AnthropicProvider } from './anthropicProvider';
import { GeminiProvider } from './geminiProvider';
import { logger } from '../utils/logger';

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
}

export interface StreamingResponse {
  content: string;
  finishReason: string | null;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface FunctionCallResponse {
  content: string | null;
  tool_calls?: any[];
  finishReason: string | null;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/** Interface for LLM providers. */
export interface LLMProvider {
  initialize(): Promise<boolean>;
  isReady(): boolean;
  streamMessage(
    messages: Message[],
    onChunk: (chunk: string) => void,
    onComplete?: (response: StreamingResponse) => void
  ): Promise<StreamingResponse>;
  sendMessage(messages: Message[]): Promise<string>;
  sendMessageWithTools(
    messages: Message[],
    functions?: any[],
    onToolCall?: (toolName: string, args: any) => void
  ): Promise<FunctionCallResponse>;
  streamMessageWithTools(
    messages: Message[],
    functions?: any[],
    onChunk?: (chunk: string) => void,
    onToolCall?: (toolName: string, args: any) => void
  ): Promise<FunctionCallResponse>;
  sendToolResults?(
    messages: Message[],
    toolResults: Array<{ tool_call_id: string; content: string }>,
    functions?: any[]
  ): Promise<FunctionCallResponse>;
  streamToolResults?(
    messages: Message[],
    toolResults: Array<{ tool_call_id: string; content: string }>,
    functions?: any[],
    onChunk?: (chunk: string) => void,
    onToolCall?: (toolName: string, args: any) => void
  ): Promise<FunctionCallResponse>;
  processWithNativeToolLoop?(
    userInput: string,
    tools: any[],
    onChunk?: (chunk: string) => void,
    verbose?: boolean
  ): Promise<string>;
}

export class LLMService implements LLMProvider {
  private openai: OpenAI | null = null;
  private anthropicProvider: AnthropicProvider | null = null;
  private geminiProvider: GeminiProvider | null = null;
  private initialized = false;
  private currentProvider: LLMProvider | null = null;

  /**
   * Initialize the appropriate provider based on configuration
   */
  async initialize(): Promise<boolean> {
    try {
      const config = configManager.getConfig();
      const provider = config.provider || 'openai';

      logger.info('Initializing LLM provider', { provider }, 'LLMService');

      if (provider === 'openai') {
        return this.initializeOpenAI();
      } else if (provider === 'anthropic') {
        return this.initializeAnthropic();
      } else if (provider === 'gemini') {
        return this.initializeGemini();
      } else {
        throw new Error(`Unknown provider: ${provider}`);
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Unknown error');
      logger.error('Failed to initialize LLM provider', errorObj, { provider: configManager.getConfig().provider }, 'LLMService');
      console.error(chalk.red('Failed to initialize LLM provider:'), errorObj.message);
      return false;
    }
  }

  /**
   * Initialize Gemini provider
   */
  private async initializeGemini(): Promise<boolean> {
    logger.debug('Initializing Gemini provider', {}, 'LLMService');

    if (!this.geminiProvider) {
      this.geminiProvider = new GeminiProvider();
    }

    const success = await this.geminiProvider.initialize();
    if (success) {
      this.currentProvider = this.geminiProvider;
      this.initialized = true;
      logger.info('Gemini provider initialized successfully', {}, 'LLMService');
    } else {
      logger.error('Failed to initialize Gemini provider', undefined, {}, 'LLMService');
    }
    return success;
  }

  /**
   * Initialize OpenAI provider
   */
  private async initializeOpenAI(): Promise<boolean> {
    const config = configManager.getConfig();

    logger.debug('Initializing OpenAI provider', { model: config.model }, 'LLMService');

    if (!config.openaiApiKey) {
      logger.error('OpenAI API key not configured', undefined, {}, 'LLMService');
      return false;
    }

    this.openai = new OpenAI({
      apiKey: config.openaiApiKey
    });

    try {
      // Test the connection
      await this.testOpenAIConnection();
      this.currentProvider = this;
      this.initialized = true;
      logger.info('OpenAI provider initialized successfully', { model: config.model }, 'LLMService');
      return true;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Unknown error');
      logger.error('Failed to initialize OpenAI provider', errorObj, { model: config.model }, 'LLMService');
      return false;
    }
  }

  /**
   * Initialize Anthropic provider
   */
  private async initializeAnthropic(): Promise<boolean> {
    logger.debug('Initializing Anthropic provider', {}, 'LLMService');

    if (!this.anthropicProvider) {
      this.anthropicProvider = new AnthropicProvider();
    }

    const success = await this.anthropicProvider.initialize();
    if (success) {
      this.currentProvider = this.anthropicProvider;
      this.initialized = true;
      logger.info('Anthropic provider initialized successfully', {}, 'LLMService');
    } else {
      logger.error('Failed to initialize Anthropic provider', undefined, {}, 'LLMService');
    }
    return success;
  }

  /**
   * Test OpenAI connection
   */
  private async testOpenAIConnection(): Promise<void> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    // Simple test to verify API key works
    await this.openai.models.list();
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.initialized && this.currentProvider !== null;
  }

  /**
   * Get the current provider name for debugging
   */
  getCurrentProvider(): string {
    const config = configManager.getConfig();
    return config.provider || 'openai';
  }

  /**
   * Get the current provider name for routing decisions
   */
  get provider(): string {
    if (this.currentProvider instanceof OpenAI) return 'openai';
    if (this.currentProvider instanceof AnthropicProvider) return 'anthropic';
    if (this.currentProvider instanceof GeminiProvider) return 'gemini';
    return 'unknown';
  }

  /**
   * Send a message and get streaming response
   */
  async streamMessage(
    messages: Message[],
    onChunk: (chunk: string) => void,
    onComplete?: (response: StreamingResponse) => void
  ): Promise<StreamingResponse> {
    if (!this.isReady()) {
      throw new Error('LLM service not initialized. Run setup first.');
    }

    const config = configManager.getConfig();
    const provider = config.provider || 'openai';

    if ((provider === 'anthropic' || provider === 'gemini') && this.currentProvider) {
      return this.currentProvider.streamMessage(messages, onChunk, onComplete);
    }

    // OpenAI implementation (keep existing code for backwards compatibility)
    return this.streamMessageOpenAI(messages, onChunk, onComplete);
  }

  /**
   * OpenAI-specific streaming implementation
   */
  private async streamMessageOpenAI(
    messages: Message[],
    onChunk: (chunk: string) => void,
    onComplete?: (response: StreamingResponse) => void
  ): Promise<StreamingResponse> {
    const config = configManager.getConfig();

    try {
      const stream = await this.openai!.chat.completions.create({
        model: config.model || 'gpt-4-turbo-preview',
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        max_tokens: config.maxTokens || 4000,
        stream: true,
        temperature: 0.7
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
      }, 'LLMService');

      if (onComplete) {
        onComplete(response);
      }

      return response;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Unknown OpenAI API error');
      logger.error('OpenAI streaming API error', errorObj, {
        messageCount: messages.length,
        model: config.model
      }, 'LLMService');

      if (error instanceof Error) {
        throw new Error(`OpenAI API error: ${error.message}`);
      }
      throw new Error('Unknown OpenAI API error');
    }
  }

  /**
   * Send a simple message and get complete response
   */
  async sendMessage(messages: Message[]): Promise<string> {
    if (!this.isReady()) {
      throw new Error('LLM service not initialized. Run setup first.');
    }

    const config = configManager.getConfig();
    const provider = config.provider || 'openai';

    if ((provider === 'anthropic' || provider === 'gemini') && this.currentProvider) {
      return this.currentProvider.sendMessage(messages);
    }

    // OpenAI implementation
    return this.sendMessageOpenAI(messages);
  }

  /**
   * OpenAI-specific sendMessage implementation
   */
  private async sendMessageOpenAI(messages: Message[]): Promise<string> {
    const config = configManager.getConfig();

    try {
      const response = await this.openai!.chat.completions.create({
        model: config.model || 'gpt-4o-2024-11-20',
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        max_tokens: config.maxTokens || 8000,
        temperature: 0.7
      });

      const responseContent = response.choices[0]?.message?.content || '';

      logger.debug('OpenAI message sent successfully', {
        messageCount: messages.length,
        responseLength: responseContent.length,
        model: config.model,
        usage: response.usage
      }, 'LLMService');

      return responseContent;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Unknown OpenAI API error');
      logger.error('OpenAI API error in sendMessage', errorObj, {
        messageCount: messages.length,
        model: config.model
      }, 'LLMService');

      if (error instanceof Error) {
        throw new Error(`OpenAI API error: ${error.message}`);
      }
      throw new Error('Unknown OpenAI API error');
    }
  }

  /**
   * Send a message with function calling support
   */
  async sendMessageWithTools(
    messages: Message[],
    functions: any[] = [],
    onToolCall?: (toolName: string, args: any) => void
  ): Promise<FunctionCallResponse> {
    if (!this.isReady()) {
      throw new Error('LLM service not initialized. Run setup first.');
    }

    const config = configManager.getConfig();
    const provider = config.provider || 'openai';

    if ((provider === 'anthropic' || provider === 'gemini') && this.currentProvider) {
      return this.currentProvider.sendMessageWithTools(messages, functions, onToolCall);
    }

    // OpenAI implementation
    return this.sendMessageWithToolsOpenAI(messages, functions, onToolCall);
  }

  /**
   * OpenAI-specific sendMessageWithTools implementation
   */
  private async sendMessageWithToolsOpenAI(
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
        max_tokens: config.maxTokens || 8000,
        temperature: 0.7
      };

      // Add function calling if functions are provided
      if (functions.length > 0) {
        requestParams.tools = functions.map(func => ({
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

  /**
   * Send a message with function calling support and streaming
   */
  async streamMessageWithTools(
    messages: Message[],
    functions: any[] = [],
    onChunk?: (chunk: string) => void,
    onToolCall?: (toolName: string, args: any) => void
  ): Promise<FunctionCallResponse> {
    if (!this.isReady()) {
      throw new Error('LLM service not initialized. Run setup first.');
    }

    const config = configManager.getConfig();
    const provider = config.provider || 'openai';

    if ((provider === 'anthropic' || provider === 'gemini') && this.currentProvider) {
      return this.currentProvider.streamMessageWithTools(messages, functions, onChunk, onToolCall);
    }

    // OpenAI implementation
    return this.streamMessageWithToolsOpenAI(messages, functions, onChunk, onToolCall);
  }

  /**
   * OpenAI-specific streamMessageWithTools implementation
   */
  private async streamMessageWithToolsOpenAI(
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
        max_tokens: config.maxTokens || 4000,
        temperature: 0.7,
        stream: true
      };

      // Add function calling if functions are provided
      if (functions.length > 0) {
        requestParams.tools = functions.map(func => ({
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

  /**
   * Create a system message for coding assistant context
   */
  createSystemMessage(): Message {
    let gitBranch = 'unknown';
    try {
      gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    } catch {}
    const environmentInfo = `Environment:
- OS: ${os.type()} ${os.release()} (${process.platform}/${process.arch})
- Node.js: ${process.version}
- Working directory: ${process.cwd()}
- Git branch: ${gitBranch}`;

    return {
      role: 'system',
      content: `You are an expert coding assistant specialized in helping developers understand, analyze, and work with their codebase.

${environmentInfo}

Core capabilities:
- Read and analyze project files to understand code structure and patterns
- Explain complex code functionality with clear, technical explanations
- Debug issues by analyzing code flow and identifying potential problems
- Suggest improvements following best practices and existing code patterns
- Help refactor code while maintaining functionality and style consistency
- Generate unit tests that follow the project's testing patterns
- Provide architectural insights and identify potential design issues

Guidelines for interactions:
- Always analyze the existing codebase patterns before suggesting changes
- Provide specific, actionable advice with code examples when helpful
- Ask clarifying questions when requirements are ambiguous
- Consider performance, security, and maintainability implications
- Respect the project's coding style and conventions
- Break down complex problems into manageable steps
- Validate assumptions by examining related code files when needed

When suggesting code changes:
- Follow the existing code style and patterns in the project
- Consider the impact on other parts of the codebase
- Provide clear explanations for why changes are recommended
- Include error handling and edge case considerations
- Suggest appropriate tests for new functionality

Focus on being precise, helpful, and aligned with software engineering best practices.`
    };
  }

  /**
   * Format user input as a message
   */
  createUserMessage(content: string): Message {
    return {
      role: 'user',
      content
    };
  }

  /**
   * Format assistant response as a message
   */
  createAssistantMessage(content: string): Message {
    return {
      role: 'assistant',
      content
    };
  }

  /**
   * Send tool results back to the LLM and get the final response
   */
  async sendToolResults(
    messages: Message[],
    toolResults: Array<{ tool_call_id: string; content: string }>,
    functions: any[] = []
  ): Promise<FunctionCallResponse> {
    if (!this.isReady()) {
      throw new Error('LLM service not initialized. Run setup first.');
    }

    const config = configManager.getConfig();
    const provider = config.provider || 'openai';

    if ((provider === 'anthropic' || provider === 'gemini') && this.currentProvider) {
      // Use provider-specific implementation if available
      if ('sendToolResults' in this.currentProvider && this.currentProvider.sendToolResults) {
        return this.currentProvider.sendToolResults(messages, toolResults, functions);
      }
    }

    // Fallback: Add tool result messages and call sendMessageWithTools
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

  /**
   * Send tool results back to the LLM and get streaming response
   */
  async streamToolResults(
    messages: Message[],
    toolResults: Array<{ tool_call_id: string; content: string }>,
    functions: any[] = [],
    onChunk?: (chunk: string) => void,
    onToolCall?: (toolName: string, args: any) => void
  ): Promise<FunctionCallResponse> {
    if (!this.isReady()) {
      throw new Error('LLM service not initialized. Run setup first.');
    }

    const config = configManager.getConfig();
    const provider = config.provider || 'openai';

    if ((provider === 'anthropic' || provider === 'gemini') && this.currentProvider) {
      // Use provider-specific implementation if available
      if ('streamToolResults' in this.currentProvider && this.currentProvider.streamToolResults) {
        return this.currentProvider.streamToolResults(messages, toolResults, functions, onChunk, onToolCall);
      }
    }

    // Fallback: Add tool result messages and call streamMessageWithTools
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



  /**
   * Process input with native tool loop (Anthropic-style continuous conversation)
   */
  async processWithNativeToolLoop(
    userInput: string,
    tools: any[],
    onChunk?: (chunk: string) => void,
    verbose: boolean = false
  ): Promise<string> {
    if (!this.isReady()) {
      throw new Error('LLM service not initialized. Run setup first.');
    }

    const config = configManager.getConfig();
    const provider = config.provider || 'openai';

    if (provider === 'gemini' && this.currentProvider) {
      // Use Gemini-specific chat-based tool loop
      return this.processWithGeminiChatLoop(userInput, tools, onChunk, verbose);
    } else if ((provider === 'anthropic') && this.currentProvider) {
      // Use provider-specific implementation if available
      if ('processWithNativeToolLoop' in this.currentProvider && this.currentProvider.processWithNativeToolLoop) {
        return this.currentProvider.processWithNativeToolLoop(userInput, tools, onChunk, verbose);
      }
    }

    // Fallback implementation for OpenAI using the same pattern
    return this.processWithNativeToolLoopOpenAI(userInput, tools, onChunk, verbose);
  }

  /**
   * OpenAI-specific native tool loop implementation
   * Follows the Anthropic pattern: continuous conversation until no more tool calls
   */
  private async processWithNativeToolLoopOpenAI(
    userInput: string,
    tools: any[],
    onChunk?: (chunk: string) => void,
    verbose: boolean = false
  ): Promise<string> {
    // Initialize conversation with system message and user input
    let messages: Message[] = [
      this.createSystemMessage(),
      { role: 'user', content: userInput }
    ];

    const maxIterations = 10; // Prevent infinite loops
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;

      if (verbose) {
        console.log(chalk.blue(`🔄 OpenAI tool loop iteration ${iterations}...`));
      }

      try {
        // Send to LLM with tool schemas
        const response = await this.streamMessageWithTools(
          messages,
          tools,
          onChunk
        );

        // Check if we have tool calls to execute
        if (response.tool_calls && response.tool_calls.length > 0) {
          if (verbose) {
            console.log(chalk.yellow(`🔧 OpenAI requested ${response.tool_calls.length} tool call(s)`));
          }

          // Add assistant's response with tool calls to conversation
          messages.push({
            role: 'assistant',
            content: response.content,
            tool_calls: response.tool_calls
          });

          // Note: This is a simplified implementation
          // In practice, tool execution should be handled by the orchestrator
          // For now, we return the tool call requests for the orchestrator to handle
          return JSON.stringify({
            type: 'tool_calls_required',
            tool_calls: response.tool_calls,
            messages: messages
          });
        } else {
          // No tool calls - this is the final response
          const finalResponse = response.content || '';

          if (verbose) {
            console.log(chalk.green('✅ OpenAI tool loop completed'));
          }

          return finalResponse;
        }
      } catch (error) {
        throw new Error(`Failed to process OpenAI tool loop in iteration ${iterations}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    throw new Error(`Maximum iterations (${maxIterations}) reached without completion`);
  }

  /**
   * Gemini-specific chat-based tool loop implementation
   * Follows Gemini's chat API pattern with functionDeclarations
   */
  private async processWithGeminiChatLoop(
    userInput: string,
    tools: any[],
    onChunk?: (chunk: string) => void,
    verbose: boolean = false
  ): Promise<string> {
    if (!this.geminiProvider) {
      throw new Error('Gemini provider not initialized');
    }

    // Convert tools to Gemini's functionDeclarations format
    const functionDeclarations = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.input_schema?.properties || {},
        required: tool.input_schema?.required || []
      }
    }));

    if (verbose) {
      console.log(chalk.blue(`🔄 Starting Gemini chat with ${functionDeclarations.length} tools...`));
    }

    try {
      // For now, fallback to regular streaming since we need to implement chat loop in provider
      const messages = [this.createUserMessage(userInput)];
      const response = await this.geminiProvider.streamMessageWithTools(
        messages,
        tools,
        onChunk
      );

      if (verbose) {
        console.log(chalk.green('✅ Gemini response completed'));
      }

      return response.content || '';
    } catch (error) {
      throw new Error(`Gemini chat loop failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const llmService = new LLMService();
