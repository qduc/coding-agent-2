import { AnthropicProvider } from '../providers/AnthropicProvider';
import { GeminiProvider } from '../providers/GeminiProvider';
import { logger } from '../utils/logger';

export async function createProvider(provider: string) {
  let providerInstance;
  switch (provider) {
    case 'openai':
      providerInstance = new (await import('../providers/OpenAIProvider')).OpenAIProvider();
      break;
    case 'anthropic':
      providerInstance = new AnthropicProvider();
      break;
    case 'gemini':
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

  logger.info(`Successfully created ${provider} provider`, {}, 'ProviderFactory');
  return providerInstance;
}
