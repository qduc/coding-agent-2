import { LLMProvider, Message, FunctionCallResponse } from '../types/llm';
import { configManager, Config } from '../core/config';
import { ToolLogger } from '../utils/toolLogger';
import { SchemaAdapter } from './schemaAdapter';
import { logger } from '../utils/logger';
import { readFileSync, existsSync } from 'fs';
import { resolve, isAbsolute } from 'path';

/**
 * Abstract base class for LLM providers that implements common functionality
 * to reduce code duplication across provider implementations.
 */
export abstract class BaseLLMProvider implements LLMProvider {
  protected initialized = false;
  protected config: Config;

  constructor() {
    this.config = configManager.getConfig();
  }

  // Abstract methods that must be implemented by concrete providers
  abstract initialize(): Promise<boolean>;
  abstract getProviderName(): string;

  // Abstract internal methods that handle processed messages
  protected abstract _sendMessageWithTools(
    messages: Message[],
    functions?: any[],
    onToolCall?: (toolName: string, args: any) => void,
    abortSignal?: AbortSignal
  ): Promise<FunctionCallResponse>;

  // Public methods that process file references before calling abstract methods


  async sendMessageWithTools(
    messages: Message[],
    functions?: any[],
    onToolCall?: (toolName: string, args: any) => void,
    abortSignal?: AbortSignal
  ): Promise<FunctionCallResponse> {
    const processedMessages = this.processFileReferences(messages);
    return this._sendMessageWithTools(processedMessages, functions, onToolCall, abortSignal);
  }


  // Concrete methods with shared implementation

  /**
   * Check if the provider is ready for use
   */
  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Get the model name from configuration
   */
  getModelName(): string {
    this.config = configManager.getConfig();
    return this.config.model || this.getDefaultModel();
  }

  /**
   * Get the default model for this provider
   */
  protected abstract getDefaultModel(): string;

  /**
   * Validate and normalize tool functions using SchemaAdapter
   */
  protected validateAndNormalizeTools(functions: any[]): any[] {
    if (!functions || functions.length === 0) {
      return [];
    }
    return SchemaAdapter.normalizeAll(functions);
  }

  /**
   * Handle tool call callbacks (UI only, no logging here)
   */
  protected handleToolCall(toolName: string, args: any, onToolCall?: (toolName: string, args: any) => void): void {
    // Removed ToolLogger.logToolCall to avoid duplicate tool start messages
    if (onToolCall) {
      onToolCall(toolName, args);
    }
  }

  /**
   * Parse tool call arguments safely
   */
  protected parseToolArguments(argsString: string): any {
    try {
      return JSON.parse(argsString);
    } catch (error) {
      logger.warn(`Failed to parse tool arguments: ${argsString}`, { error: error instanceof Error ? error.message : String(error) }, this.getProviderName());
      return {};
    }
  }

  /**
   * Format error messages consistently
   */
  protected formatError(error: unknown, context: string): Error {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const providerName = this.getProviderName();
    return new Error(`${providerName} API error in ${context}: ${errorMessage}`);
  }

  /**
   * Log API calls for debugging
   */
  protected logApiCall(method: string, messageCount: number, additionalInfo: Record<string, any> = {}): void {
    logger.debug(`${this.getProviderName()} ${method} called`, {
      messageCount,
      model: this.getModelName(),
      ...additionalInfo
    }, this.getProviderName());
  }

  /**
   * Build usage response object in standard format
   */
  protected buildUsageResponse(usage: any): { promptTokens: number; completionTokens: number; totalTokens: number; cacheUsage?: any } | undefined {
    if (!usage) {
      return undefined;
    }

    // Extract cache usage if available (only for Anthropic)
    const cacheUsage = this.extractCacheUsage(usage);

    // Handle different provider usage formats
    if (usage.input_tokens !== undefined && usage.output_tokens !== undefined) {
      // Anthropic format
      const response: { promptTokens: number; completionTokens: number; totalTokens: number; cacheUsage?: any } = {
        promptTokens: usage.input_tokens,
        completionTokens: usage.output_tokens,
        totalTokens: usage.input_tokens + usage.output_tokens
      };

      if (cacheUsage) {
        response.cacheUsage = cacheUsage;
      }

      return response;
    } else if (usage.prompt_tokens !== undefined && usage.completion_tokens !== undefined) {
      // OpenAI format
      return {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens || (usage.prompt_tokens + usage.completion_tokens)
      };
    } else if (usage.total_tokens !== undefined) {
      // Generic format with total tokens
      return {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: usage.total_tokens
      };
    }

    return undefined;
  }

  /**
   * Extract cache usage information from API response (for Anthropic)
   */
  protected extractCacheUsage(usage: any): any {
    if (!usage) return undefined;

    const cacheUsage: any = {};

    if (usage.cache_creation_input_tokens) {
      cacheUsage.cache_creation_input_tokens = usage.cache_creation_input_tokens;
    }

    if (usage.cache_read_input_tokens) {
      cacheUsage.cache_read_input_tokens = usage.cache_read_input_tokens;
    }

    if (usage.cache_creation) {
      cacheUsage.cache_creation = usage.cache_creation;
    }

    return Object.keys(cacheUsage).length > 0 ? cacheUsage : undefined;
  }

  /**
   * Check if provider is initialized and throw error if not
   */
  protected ensureInitialized(): void {
    if (!this.isReady()) {
      throw new Error(`${this.getProviderName()} service not initialized. Run setup first.`);
    }
  }

  /**
   * Extract system message from messages array
   */
  protected extractSystemMessage(messages: Message[]): string {
    const systemMessage = messages.find(msg => msg.role === 'system');
    return systemMessage?.content || '';
  }

  /**
   * Standard implementation for sending tool results
   * Can be overridden by providers that need custom behavior
   */
  async sendToolResults(
    messages: Message[],
    toolResults: Array<{ tool_call_id: string; content: string }>,
    functions: any[] = []
  ): Promise<FunctionCallResponse> {
    this.ensureInitialized();

    // Add tool result messages to the conversation
    const updatedMessages = [...messages];
    for (const result of toolResults) {
      updatedMessages.push({
        role: 'tool',
        content: result.content,
        tool_call_id: result.tool_call_id
      });
    }

    // Process file references and send the updated conversation back to the LLM
    const processedMessages = this.processFileReferences(updatedMessages);
    return this._sendMessageWithTools(processedMessages, functions);
  }


  /**
   * Refresh configuration from config manager
   */
  protected refreshConfig(): void {
    this.config = configManager.getConfig();
  }

  /**
   * Test connection implementation that can be overridden by providers
   */
  protected async testConnection(): Promise<void> {
    // Default implementation - providers can override for specific testing
    logger.debug(`${this.getProviderName()} connection test - using default implementation`, {}, this.getProviderName());
  }

  /**
   * Get provider-specific configuration section
   */
  protected getProviderConfig(): any {
    const providerName = this.getProviderName();
    return this.config[providerName] || {};
  }

  /**
   * Validate API key for the provider
   */
  protected validateApiKey(apiKey: string | undefined, keyName: string): boolean {
    if (!apiKey) {
      logger.error(`${keyName} not configured for ${this.getProviderName()} provider`, new Error(`Missing ${keyName}`), {}, this.getProviderName());
      return false;
    }
    return true;
  }

  /**
   * Process messages to include file content for file path references
   */
  protected processFileReferences(messages: Message[]): Message[] {
    return messages.map(message => {
      if (message.role === 'user' || message.role === 'assistant') {
        const processedContent = this.expandFileReferences(message.content || '');
        return { ...message, content: processedContent };
      }
      return message;
    });
  }

  /**
   * Detect file path references and expand them with file content
   * Only matches patterns that begin with @ sign (e.g., @package.json, @src/file.ts)
   */
  private expandFileReferences(content: string): string {
    // Simplified pattern: must start with @ followed by file path with extension
    const filePathPattern = /@([a-zA-Z0-9\/_\-\.]+\.[a-zA-Z0-9]+)/g;

    const fileBlocks: string[] = [];
    const processedFilePaths = new Set<string>();
    let cleanedContent = content;
    let match;

    // First pass: collect all unique file references and their content
    while ((match = filePathPattern.exec(content)) !== null) {
      const [fullMatch, filePath] = match;

      // Skip if we've already processed this file
      if (processedFilePaths.has(filePath)) continue;

      // Try to resolve the file path
      const resolvedPath = this.resolveFilePath(filePath);

      if (resolvedPath && existsSync(resolvedPath)) {
        try {
          const fileContent = readFileSync(resolvedPath, 'utf-8');
          const fileExtension = filePath.split('.').pop() || '';

          // Create a code block with the file content
          const codeBlock = `\`\`\`${fileExtension}\n// File: ${filePath}\n${fileContent}\n\`\`\``;
          fileBlocks.push(codeBlock);
          processedFilePaths.add(filePath);

          logger.debug(`Collected file reference: ${filePath}`, { resolvedPath }, this.getProviderName());
        } catch (error) {
          logger.warn(`Failed to read file: ${filePath}`, {
            error: error instanceof Error ? error.message : String(error)
          }, this.getProviderName());
        }
      }
    }

    // Second pass: replace file references with more natural language
    if (processedFilePaths.size > 0) {
      // Replace @filePath references with natural references
      for (const filePath of processedFilePaths) {
        const referencePattern = new RegExp(`@${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
        const fileName = filePath.split('/').pop() || filePath;
        cleanedContent = cleanedContent.replace(referencePattern, `the above ${fileName} file`);
      }
    }

    // Combine file blocks at the beginning + cleaned content
    if (fileBlocks.length > 0) {
      return fileBlocks.join('\n\n') + '\n\n' + cleanedContent.trim();
    }

    return content;
  }

  /**
   * Resolve file path relative to current working directory
   */
  private resolveFilePath(filePath: string): string {
    if (isAbsolute(filePath)) {
      return filePath;
    }

    // Try relative to current working directory
    const cwdPath = resolve(process.cwd(), filePath);
    if (existsSync(cwdPath)) {
      return cwdPath;
    }

    // Try common project root patterns
    const commonRoots = ['./src/', './'];
    for (const root of commonRoots) {
      const rootPath = resolve(process.cwd(), root, filePath);
      if (existsSync(rootPath)) {
        return rootPath;
      }
    }

    return cwdPath; // Return the cwd path as fallback
  }
}