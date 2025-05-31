import OpenAI from 'openai';
import chalk from 'chalk';
import { configManager } from '../core/config';
import * as os from 'os';
import { execSync } from 'child_process';
import { ToolLogger } from '../utils/toolLogger';

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
}

export class LLMService implements LLMProvider {
  private openai: OpenAI | null = null;
  private initialized = false;

  /**
   * Initialize OpenAI client
   */
  async initialize(): Promise<boolean> {
    try {
      const config = configManager.getConfig();

      if (!config.openaiApiKey) {
        return false;
      }

      this.openai = new OpenAI({
        apiKey: config.openaiApiKey
      });

      // Test the connection
      await this.testConnection();
      this.initialized = true;
      return true;
    } catch (error) {
      console.error(chalk.red('Failed to initialize OpenAI:'), error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Test OpenAI connection
   */
  private async testConnection(): Promise<void> {
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
    return this.initialized && this.openai !== null;
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

      if (onComplete) {
        onComplete(response);
      }

      return response;
    } catch (error) {
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

    try {
      const response = await this.openai!.chat.completions.create({
        model: config.model || 'gpt-4-turbo-preview',
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        max_tokens: config.maxTokens || 4000,
        temperature: 0.7
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
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
      content: `You are a helpful coding assistant. You help developers understand, analyze, and work with their code.

${environmentInfo}

Key capabilities:
- Read and analyze files in the project
- Explain code functionality and structure
- Help debug issues and suggest improvements
- Provide clear, concise explanations
- Ask clarifying questions when needed

Always be helpful, accurate, and focused on the specific coding task at hand.`
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
}

// Export singleton instance
export const llmService = new LLMService();
