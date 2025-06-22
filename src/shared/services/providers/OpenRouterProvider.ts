import { OpenAIProvider } from './OpenAIProvider';

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
}
