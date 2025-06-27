import { OpenAIProvider } from './OpenAIProvider';
import { parseLlamaToolCalls } from '../../utils/llamaToolCallParser';
import { logger } from '../../utils/logger';

export class OpenRouterProvider extends OpenAIProvider {
  getProviderName(): string {
    return 'openrouter';
  }

  protected getDefaultModel(): string {
    // You may want to set a default OpenRouter model here
    return 'openrouter/codestral-latest';
  }

  async initialize(): Promise<boolean> {
    this.refreshConfig();
    // Always use OpenRouter endpoint and key
    this.config.openaiApiBaseUrl = 'https://openrouter.ai/api/v1';
    const apiKey = process.env.OPENROUTER_API_KEY || this.config.openaiApiKey;
    if (!this.validateApiKey(apiKey, 'OPENROUTER_API_KEY')) {
      return false;
    }
    // Set OpenRouter-specific headers if needed
    this.config.openaiHeaders = {
      'HTTP-Referer': 'https://github.com/qduc/coding-agent',
      'X-Title': 'coding-agent',
      'OpenAI-Organization': 'openrouter',
    };
    return super.initialize();
  }

  protected async _sendMessageWithTools(
    messages: any[],
    functions: any[] = [],
    onToolCall?: (toolName: string, args: any) => void
  ): Promise<any> {
    // Use parent logic to get response
    const response = await super._sendMessageWithTools(messages, functions, onToolCall);
    const model = this.getModelName().toLowerCase();
    if (model.includes('llama')) {
      // If tool_calls present and in OpenAI format, skip parsing
      if (Array.isArray(response.tool_calls) && response.tool_calls.every(tc => tc && tc.function && typeof tc.function.name === 'string')) {
        logger.debug('[OpenRouterProvider] Llama model returned OpenAI-style tool_calls JSON, skipping parse.', { tool_calls: response.tool_calls }, 'OpenRouterProvider');
        return response;
      }
      // If tool_calls present and in Llama2/3 JSON format (flat objects with type/name/parameters), convert to standard format
      if (Array.isArray(response.tool_calls) && response.tool_calls.every(tc => tc && tc.type === 'function' && typeof tc.name === 'string' && tc.parameters && typeof tc.parameters === 'object')) {
        logger.debug('[OpenRouterProvider] Llama model returned flat tool_calls JSON, converting to standard format.', { tool_calls: response.tool_calls }, 'OpenRouterProvider');
        response.tool_calls = response.tool_calls.map((tc, idx) => ({
          id: `llama-${Date.now()}-${idx}`,
          type: 'function',
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.parameters)
          }
        }));
        return response;
      }
      // Otherwise, parse Llama tool call format from content
      const toolCalls = parseLlamaToolCalls(response.content || '');
      if (Array.isArray(toolCalls)) {
        const formattedToolCalls = toolCalls
          .filter(call => call && call.name)
          .map((call, idx) => ({
            id: `llama-${Date.now()}-${idx}`,
            type: 'function',
            function: {
              name: call.name,
              arguments: JSON.stringify(call.args || {})
            }
          }));
        for (const toolCall of formattedToolCalls) {
          this.handleToolCall(toolCall.function.name, JSON.parse(toolCall.function.arguments), onToolCall);
        }
        response.tool_calls = formattedToolCalls.length > 0 ? formattedToolCalls : undefined;
      } else {
        logger.debug(`[OpenRouterProvider] parseLlamaToolCalls did not return an array`, { toolCalls }, 'OpenRouterProvider');
      }
    }
    return response;
  }
}
