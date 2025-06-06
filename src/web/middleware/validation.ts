import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { ApiResponse, ApiError } from '../types/api';
import { logger } from '../../shared/utils/logger';

// Common schemas
const sessionIdSchema = z.string().uuid();
const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

// Validation middleware factory
export const validate = (schema: z.ZodSchema, target: 'body' | 'query' | 'params' = 'body') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req[target] = await schema.parseAsync(req[target]);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err: z.ZodIssue) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: errors,
            timestamp: new Date(),
          },
          timestamp: new Date(),
        };

        logger.warn('Validation failed', { errors });
        res.status(400).json(response);
        return;
      }
      next(error);
    }
  };
};

export const validateRequest = validate;

// Specific validators
export const validateSessionId = (req: Request, res: Response, next: NextFunction): void => {
  const sessionId = req.headers['x-session-id'] || req.query.sessionId;

  try {
    if (sessionId) {
      sessionIdSchema.parse(sessionId);
    }
    next();
    return;
  } catch (error) {
    const apiError: ApiError = {
      code: 'INVALID_SESSION_ID',
      message: 'Invalid session ID format',
      timestamp: new Date(),
    };
    const response: ApiResponse = {
      success: false,
      error: apiError,
      timestamp: new Date(),
    };
    res.status(400).json(response);
    return;
  }
};

export const validateChatMessage = validate(
  z.object({
    content: z.string().min(1).max(10000),
    sessionId: z.string().uuid().optional(),
  })
);

export const validateToolExecution = validate(
  z.object({
    toolId: z.string().min(1),
    input: z.record(z.unknown()),
    sessionId: z.string().uuid().optional(),
  })
);

export const validateConfigUpdate = validate(
  z.object({
    key: z.string().min(1),
    value: z.unknown(),
  })
);

export const validateProjectPath = validate(
  z.object({
    path: z.string().min(1),
  }),
  'query'
);

export const validatePagination = validate(paginationSchema, 'query');

// Conditional validation helpers
export const validateIf = (condition: (req: Request) => boolean, validator: (req: Request, res: Response, next: NextFunction) => void) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (condition(req)) {
      validator(req, res, next);
    } else {
      next();
    }
  };
};

// Custom validator example
export const validateFileUpload = (allowedTypes: string[], maxSize: number) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const file = (req as any).file;

    if (!file) {
      const apiError: ApiError = {
        code: 'FILE_REQUIRED',
        message: 'File is required',
        timestamp: new Date(),
      };
      const response: ApiResponse = {
        success: false,
        error: apiError,
        timestamp: new Date(),
      };
      res.status(400).json(response);
      return;
    }

    if (!allowedTypes.includes(file.mimetype)) {
      const apiError: ApiError = {
        code: 'INVALID_FILE_TYPE',
        message: `Only ${allowedTypes.join(', ')} files are allowed`,
        timestamp: new Date(),
      };
      const response: ApiResponse = {
        success: false,
        error: apiError,
        timestamp: new Date(),
      };
      res.status(400).json(response);
      return;
    }

    if (file.size > maxSize) {
      const apiError: ApiError = {
        code: 'FILE_TOO_LARGE',
        message: `File exceeds maximum size of ${maxSize} bytes`,
        timestamp: new Date(),
      };
      const response: ApiResponse = {
        success: false,
        error: apiError,
        timestamp: new Date(),
      };
      res.status(400).json(response);
      return;
    }

    next();
    return;
  };
};
