import { Router, Request, Response } from 'express';
import { configManager } from '../../shared/core/config';
import { 
  ApiResponse, 
  WebConfiguration,
  ConfigValidationResult,
  ConfigProviderSettings,
  ConfigToolSettings,
  ConfigFeatureFlags
} from '../types/api';
import { 
  generalLimiter, 
  configUpdateLimiter 
} from '../middleware';
import { validateConfig, validateProviderConfig } from '../types/validation';
import { Logger } from '../../shared/utils/logger';

const router = Router();
const logger = Logger.getInstance();

/**
 * Get complete configuration
 */
router.get('/', generalLimiter, async (req: Request, res: Response) => {
  try {
    const config = configManager.getConfig();
    const response: ApiResponse<WebConfiguration> = {
      success: true,
      data: {
        ...config,
        availableModels: getAvailableModels(config.provider),
        features: getFeatureFlags()
      },
      timestamp: new Date()
    };
    res.json(response);
  } catch (error) {
    handleConfigError(res, error, 'Failed to retrieve configuration');
  }
});

/**
 * Get provider configuration
 */
router.get('/provider', generalLimiter, async (req: Request, res: Response) => {
  try {
    const config = configManager.getConfig();
    const response: ApiResponse<ConfigProviderSettings> = {
      success: true,
      data: {
        provider: config.provider,
        apiKey: config.provider === 'openai' ? config.openaiApiKey : 
               config.provider === 'anthropic' ? config.anthropicApiKey :
               config.geminiApiKey,
        apiBaseUrl: config.openaiApiBaseUrl,
        model: config.model,
        maxTokens: config.maxTokens
      },
      timestamp: new Date()
    };
    res.json(response);
  } catch (error) {
    handleConfigError(res, error, 'Failed to retrieve provider configuration');
  }
});

/**
 * Get tool configuration
 */
router.get('/tools', generalLimiter, async (req: Request, res: Response) => {
  try {
    const config = configManager.getConfig();
    const response: ApiResponse<ConfigToolSettings> = {
      success: true,
      data: {
        logToolUsage: config.logToolUsage || false,
        maxFileSize: config.maxFileSize || 1024 * 1024, // 1MB default
        timeout: config.timeout || 30000 // 30s default
      },
      timestamp: new Date()
    };
    res.json(response);
  } catch (error) {
    handleConfigError(res, error, 'Failed to retrieve tool configuration');
  }
});

/**
 * Get feature flags
 */
router.get('/features', generalLimiter, async (req: Request, res: Response) => {
  try {
    const response: ApiResponse<ConfigFeatureFlags> = {
      success: true,
      data: getFeatureFlags(),
      timestamp: new Date()
    };
    res.json(response);
  } catch (error) {
    handleConfigError(res, error, 'Failed to retrieve feature flags');
  }
});

/**
 * Update complete configuration
 */
router.post('/', configUpdateLimiter, async (req: Request, res: Response) => {
  try {
    const validation = validateConfig(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid configuration',
          details: validation.errors
        },
        timestamp: new Date()
      } as ApiResponse);
    }

    await configManager.updateConfig(req.body);
    logger.info('Configuration updated', { event: 'config_update' });

    const response: ApiResponse<WebConfiguration> = {
      success: true,
      data: {
        ...configManager.getConfig(),
        availableModels: getAvailableModels(req.body.provider),
        features: getFeatureFlags()
      },
      timestamp: new Date()
    };
    res.json(response);
  } catch (error) {
    handleConfigError(res, error, 'Failed to update configuration');
  }
});

/**
 * Update provider configuration
 */
router.put('/provider', configUpdateLimiter, async (req: Request, res: Response) => {
  try {
    const validation = validateProviderConfig(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid provider configuration',
          details: validation.errors
        },
        timestamp: new Date()
      } as ApiResponse);
    }

    const currentConfig = configManager.getConfig();
    const updatedConfig = {
      ...currentConfig,
      ...req.body
    };

    await configManager.updateConfig(updatedConfig);
    logger.info('Provider configuration updated', { event: 'provider_config_update' });

    const response: ApiResponse<ConfigProviderSettings> = {
      success: true,
      data: {
        provider: updatedConfig.provider,
        apiKey: req.body.apiKey,
        apiBaseUrl: updatedConfig.openaiApiBaseUrl,
        model: updatedConfig.model,
        maxTokens: updatedConfig.maxTokens
      },
      timestamp: new Date()
    };
    res.json(response);
  } catch (error) {
    handleConfigError(res, error, 'Failed to update provider configuration');
  }
});

/**
 * Validate configuration
 */
router.post('/validate', generalLimiter, async (req: Request, res: Response) => {
  try {
    const validation = validateConfig(req.body);
    const response: ApiResponse<ConfigValidationResult> = {
      success: true,
      data: {
        valid: validation.success,
        errors: validation.success ? undefined : validation.errors,
        warnings: []
      },
      timestamp: new Date()
    };
    res.json(response);
  } catch (error) {
    handleConfigError(res, error, 'Failed to validate configuration');
  }
});

// Helper functions
function getAvailableModels(provider?: string): string[] {
  const models = {
    openai: ['gpt-4', 'gpt-4-turbo-preview', 'gpt-3.5-turbo'],
    anthropic: ['claude-3-opus', 'claude-3-sonnet', 'claude-2.1'],
    gemini: ['gemini-pro', 'gemini-ultra']
  };
  return provider ? models[provider as keyof typeof models] || [] : 
    [...models.openai, ...models.anthropic, ...models.gemini];
}

function getFeatureFlags(): ConfigFeatureFlags {
  return {
    toolExecution: true,
    streaming: true,
    sessions: true,
    codeAnalysis: true,
    fileManagement: true
  };
}

function handleConfigError(res: Response, error: unknown, message: string) {
  const logger = Logger.getInstance();
  logger.error(message, { error });

  const response: ApiResponse = {
    success: false,
    error: message,
    ...(error instanceof Error ? {
      details: error.message
    } : {
      details: String(error)
    }),
    timestamp: new Date()
  };
  res.status(500).json(response);
}

export default router;
