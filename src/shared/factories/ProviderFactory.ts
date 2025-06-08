import { logger } from '../utils/logger';

export async function createProvider(provider: string) {
  let providerInstance;
  switch (provider) {
    case 'openai':
      const { OpenAIProvider } = await import('../services/providers/OpenAIProvider');
      providerInstance = new OpenAIProvider();
      break;
    case 'anthropic':
      const { AnthropicProvider } = await import('../services/providers/AnthropicProvider');
      providerInstance = new AnthropicProvider();
      break;
    case 'gemini':
      const { GeminiProvider } = await import('../services/providers/GeminiProvider');
      providerInstance = new GeminiProvider();
      break;
    default:
      logger.error(`Unknown provider: ${provider}`, new Error(`Unknown provider: ${provider}`), {}, 'ProviderFactory');
      throw new Error(`Unknown provider: ${provider}`);
  }

  const initialized = await providerInstance.initialize();
  if (!initialized) {
    logger.error(`Failed to initialize ${provider} provider`, new Error(`Failed to initialize ${provider} provider`), {}, 'ProviderFactory');
    throw new Error(`Failed to initialize ${provider} provider`);
  }

  return providerInstance;
}
