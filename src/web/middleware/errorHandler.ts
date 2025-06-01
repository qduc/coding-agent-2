import { Request, Response, NextFunction } from 'express';
import { ApiResponse, ErrorResponse } from '../types/api';

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

  const errorResponse: ErrorResponse = {
    error: error.message || 'Internal server error',
    code: 'INTERNAL_ERROR',
    timestamp: new Date(),
  };

  // Handle specific error types
  if (error.name === 'ValidationError') {
    errorResponse.code = 'VALIDATION_ERROR';
    res.status(400).json(errorResponse);
    return;
  }

  if (error.name === 'UnauthorizedError') {
    errorResponse.code = 'UNAUTHORIZED';
    res.status(401).json(errorResponse);
    return;
  }

  // Default to 500 Internal Server Error
  res.status(500).json(errorResponse);
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response) => {
  const errorResponse: ErrorResponse = {
    error: `Route ${req.method} ${req.path} not found`,
    code: 'NOT_FOUND',
    timestamp: new Date(),
  };

  res.status(404).json(errorResponse);
};
