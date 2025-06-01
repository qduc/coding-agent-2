// Core middleware
export * from './cors';
export * from './rateLimiter';
export * from './rateLimit';
export * from './errorHandler';
export * from './auth';
export * from './context';

// Validation middleware
export * from './validation';

// Re-export specific validators for convenience
export {
  validateChatMessage,
  validateSessionId,
  validateToolExecution,
  validateConfigUpdate,
  validateProjectPath,
  validatePagination,
  validateRequest
} from './validation';

export {
  configUpdateLimiter,
  executionLimiter,
  generalRateLimit
} from './rateLimiter';

// Also export from rateLimit.ts for backward compatibility
export {
  generalLimiter,
  chatLimiter,
  healthLimiter
} from './rateLimit';
