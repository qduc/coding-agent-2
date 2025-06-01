import { Request, Response, NextFunction } from 'express';
import { ApiResponse, ErrorResponse, ApiError } from '../types/api';

/**
 * Global error handling middleware
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Error occurred:', error);

  let apiError: ApiError = {
    message: error.message || 'Internal server error',
    code: 'INTERNAL_ERROR',
    timestamp: new Date(),
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  };

  let statusCode = 500;

  // Handle specific error types
  if (error.name === 'ValidationError') {
    apiError.code = 'VALIDATION_ERROR';
    statusCode = 400;
  } else if (error.name === 'UnauthorizedError') {
    apiError.code = 'UNAUTHORIZED';
    statusCode = 401;
  } else if (error.name === 'NotFoundError') {
    apiError.code = 'NOT_FOUND';
    statusCode = 404;
  }

  const errorResponse: ErrorResponse = {
    success: false,
    error: apiError,
    timestamp: new Date(),
  };

  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response) => {
  const apiError: ApiError = {
    message: `Route ${req.method} ${req.path} not found`,
    code: 'NOT_FOUND',
    timestamp: new Date(),
  };
  const errorResponse: ErrorResponse = {
    success: false,
    error: apiError,
    timestamp: new Date(),
  };

  res.status(404).json(errorResponse);
};
