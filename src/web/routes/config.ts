import { Router, Request, Response } from 'express';
import { configManager } from '../../shared/core/config';
import { 
  ApiResponse, 
  WebConfiguration,
  ConfigValidationResult,
  ConfigProviderSettings,
  ConfigToolSettings,
  ConfigFeatureFlags,
  ApiError, // Added ApiError
  ErrorResponse, // Added ErrorResponse
  ValidationError
} from '../types/api';
import { 
  generalLimiter, 
  configUpdateLimiter 
} from '../middleware';
import { validateConfig, validateProviderConfig } from '../types/validation';
import { Logger, LogLevel } from '../../shared/utils/logger'; // Imported LogLevel
import { ZodIssue } from 'zod';

const router = Router();
const logger = Logger.getInstance();

// Helper function to map Zod issues to ValidationErrors
function mapZodIssuesToValidationErrors(zodIssues: ZodIssue[]): ValidationError[] {
  return zodIssues.map((issue: ZodIssue): ValidationError => {
    return {
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code, // ZodIssueCode is a string literal union, assignable to string
    };
  });
}

/**
 * Get complete configuration
 */
router.get('/', generalLimiter, async (req: Request, res: Response) => {
  try {
    const currentConfig = configManager.getConfig();
    // Construct data matching WebConfiguration type
    const webConfigData: WebConfiguration = {
      llm: {
        provider: currentConfig.provider || 'openai',
        model: currentConfig.model || '',
        apiKey: undefined, // API keys are not sent to client
        baseUrl: currentConfig.openaiApiBaseUrl,
        maxTokens: currentConfig.maxTokens
      },
      tools: {
        enabled: currentConfig.logToolUsage !== undefined ? currentConfig.logToolUsage : true, // Assuming logToolUsage maps to tools.enabled
        list: [], // ToolConfig list needs to be populated if required by WebConfiguration
        maxFileSize: (configManager.getConfig() as any).maxFileSize || 1024 * 1024, // Need to ensure maxFileSize is part of Config
        timeout: (configManager.getConfig() as any).timeout || 30000, // Need to ensure timeout is part of Config
        logUsage: currentConfig.logToolUsage || false,
      },
      logging: {
        level: (currentConfig.logLevel || 'info') as unknown as LogLevel,
        persist: currentConfig.enableFileLogging || false,
        maxLogSize: 0, // Placeholder, needs to come from config if available
        maxLogFiles: 0 // Placeholder
      },
      features: getFeatureFlags(), // This now returns the extended ConfigFeatureFlags
      // ui config is optional
    };

    const response: ApiResponse<WebConfiguration> = {
      success: true,
      data: {
        ...webConfigData,
      },
      timestamp: new Date()
    };
    res.json(response);
    return;
  } catch (error) {
    handleConfigError(res, error, 'Failed to retrieve configuration');
    return;
  }
});

/**
 * Get provider configuration
 */
router.get('/provider', generalLimiter, async (req: Request, res: Response) => {
  try {
    const currentConfig = configManager.getConfig();
    const providerSettings: ConfigProviderSettings = {
      provider: currentConfig.provider || 'openai',
      model: currentConfig.model || '',
      // apiKey is sensitive, should not be sent unless necessary and secured
      // apiKey: currentConfig.provider === 'openai' ? currentConfig.openaiApiKey :
      //          currentConfig.provider === 'anthropic' ? currentConfig.anthropicApiKey :
      //          currentConfig.geminiApiKey, // Omitting API key for security
      endpoint: currentConfig.openaiApiBaseUrl, // Renamed apiBaseUrl to endpoint to match type
      // maxTokens is part of llm settings, not directly in ConfigProviderSettings
      // If needed, ConfigProviderSettings type should be updated.
      // For now, adhering to existing ConfigProviderSettings type.
    };
    const response: ApiResponse<ConfigProviderSettings> = {
      success: true,
      data: providerSettings,
      timestamp: new Date()
    };
    res.json(response);
    return;
  } catch (error) {
    handleConfigError(res, error, 'Failed to retrieve provider configuration');
    return;
  }
});

/**
 * Get tool configuration
 */
router.get('/tools', generalLimiter, async (req: Request, res: Response) => {
  try {
    const currentConfig = configManager.getConfig();
    // Assuming ConfigToolSettings refers to general enablement, not specific tool properties from main Config
    // The Config interface has logToolUsage, but not directly maxFileSize or timeout for "tools" block.
    // These might be from a different config section or need to be added to Config.
    // For now, using existing properties from Config that seem relevant.
    const toolSettings: ConfigToolSettings = {
        enabled: currentConfig.logToolUsage || false, // Mapping logToolUsage to general tool enablement
        // whitelist/blacklist are not in current Config, so they'd be undefined or default.
    };
    const response: ApiResponse<ConfigToolSettings> = {
      success: true,
      data: toolSettings,
      timestamp: new Date()
    };
    res.json(response);
    return;
  } catch (error) {
    handleConfigError(res, error, 'Failed to retrieve tool configuration');
    return;
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
    return;
  } catch (error) {
    handleConfigError(res, error, 'Failed to retrieve feature flags');
    return;
  }
});

/**
 * Update complete configuration
 */
router.post('/', configUpdateLimiter, async (req: Request, res: Response) => {
  try {
    const validation = validateConfig(req.body);
    if (!validation.success) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: { 
          code: 'VALIDATION_ERROR',
          message: 'Invalid configuration',
          validationErrors: mapZodIssuesToValidationErrors(validation.errors),
          timestamp: new Date(),
        },
        data: null,
        timestamp: new Date()
      };
      res.status(400).json(errorResponse);
      return;
    }

    await configManager.saveConfig(req.body);
    logger.info('Configuration updated', { event: 'config_update' });

    const newConfig = configManager.getConfig();
    const webConfigData: WebConfiguration = { // Reconstruct WebConfiguration
      llm: {
        provider: newConfig.provider || 'openai',
        model: newConfig.model || '',
        baseUrl: newConfig.openaiApiBaseUrl,
        maxTokens: newConfig.maxTokens
      },
      tools: {
        enabled: newConfig.logToolUsage !== undefined ? newConfig.logToolUsage : true,
        list: [],
        maxFileSize: (newConfig as any).maxFileSize || 1024 * 1024,
        timeout: (newConfig as any).timeout || 30000,
        logUsage: newConfig.logToolUsage || false,
      },
      logging: {
        level: (newConfig.logLevel || 'info') as unknown as LogLevel,
        persist: newConfig.enableFileLogging || false,
        maxLogSize: 0,
        maxLogFiles: 0
      },
      features: getFeatureFlags(),
    };

    const response: ApiResponse<WebConfiguration> = {
      success: true,
      data: webConfigData,
      timestamp: new Date()
    };
    res.json(response);
    return;
  } catch (error) {
    handleConfigError(res, error, 'Failed to update configuration');
    return;
  }
});

/**
 * Update provider configuration
 */
router.put('/provider', configUpdateLimiter, async (req: Request, res: Response) => {
  try {
    const validation = validateProviderConfig(req.body);
    if (!validation.success) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: { 
          code: 'VALIDATION_ERROR',
          message: 'Invalid provider configuration',
          validationErrors: mapZodIssuesToValidationErrors(validation.errors),
          timestamp: new Date(),
        },
        data: null,
        timestamp: new Date()
      };
      res.status(400).json(errorResponse);
      return;
    }

    const currentConfig = configManager.getConfig();
    // req.body should be validated to be Partial<Config> or specific provider settings
    const mergedConfig = { ...currentConfig, ...req.body };

    await configManager.saveConfig(mergedConfig); // Changed updateConfig to saveConfig
    logger.info('Provider configuration updated', { event: 'provider_config_update' });
    
    const newProviderConfig = configManager.getConfig(); // Get the latest config
    const providerSettings: ConfigProviderSettings = {
        provider: newProviderConfig.provider || 'openai',
        model: newProviderConfig.model || '',
        apiKey: req.body.apiKey, // Assuming apiKey from request is what's set, but it's not saved to file by saveConfig
        endpoint: newProviderConfig.openaiApiBaseUrl, // Match ConfigProviderSettings type
    };

    const response: ApiResponse<ConfigProviderSettings> = {
      success: true,
      data: providerSettings,
      timestamp: new Date()
    };
    res.json(response);
    return;
  } catch (error) {
    handleConfigError(res, error, 'Failed to update provider configuration');
    return;
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
        isValid: validation.success,
        errors: validation.success ? undefined : mapZodIssuesToValidationErrors(validation.errors),
        warnings: []
      },
      timestamp: new Date()
    };
    res.json(response);
    return;
  } catch (error) {
    handleConfigError(res, error, 'Failed to validate configuration');
    return;
  }
});

// Helper functions
function getAvailableModels(provider?: string): string[] {
  const models = {
    openai: ['gpt-4', 'gpt-4-turbo-preview', 'gpt-3.5-turbo'],
    anthropic: ['claude-3-opus', 'claude-3-sonnet', 'claude-2.1'], // Example models
    gemini: ['gemini-pro', 'gemini-ultra'] // Example models
  };
  // Ensure provider is a valid key
  if (provider && provider in models) {
    return models[provider as keyof typeof models];
  }
  // Return all models if no specific provider or provider is invalid
  return [...models.openai, ...models.anthropic, ...models.gemini];
}

function getFeatureFlags(): ConfigFeatureFlags {
  // This should match the ConfigFeatureFlags type in api.ts
  return {
    toolExecution: true, // from original
    streaming: true,     // from original
    sessions: true,      // from original
    codeAnalysis: true,  // Added
    autoSave: false,     // Added, assuming default false
    fileAccess: true     // This is the correct property as per ConfigFeatureFlags type
  };
}

function handleConfigError(res: Response, error: unknown, message: string) {
  const logger = Logger.getInstance();
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error(message, { 
    name: err.name, 
    message: err.message,
    stack: err.stack
  });

  const apiError: ApiError = {
    code: 'CONFIG_OPERATION_FAILED',
    message: message,
    details: err.message,
    timestamp: new Date()
  };

  const errorResponse: ErrorResponse = { 
    success: false,
    error: apiError,
    data: null, // Ensure ErrorResponse has a data field, typically null
    timestamp: new Date()
  };
  res.status(500).json(errorResponse);
  return;
}

export default router;
