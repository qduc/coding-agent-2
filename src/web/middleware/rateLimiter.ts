import rateLimit from 'express-rate-limit';

/**
 * Rate limiting middleware configurations
 */

export const configUpdateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs
  message: {
    success: false,
    error: 'Too many configuration updates, please try again later',
    timestamp: new Date()
  },
  standardHeaders: true,
  legacyHeaders: false
});

export const executionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 tool executions per minute
  message: {
    success: false,
    error: 'Too many tool executions, please try again later',
    timestamp: new Date()
  },
  standardHeaders: true,
  legacyHeaders: false
});

export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests, please try again later',
    timestamp: new Date()
  },
  standardHeaders: true,
  legacyHeaders: false
});

export { rateLimit };
