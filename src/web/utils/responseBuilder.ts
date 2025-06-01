import { ApiResponse, ErrorResponse, ApiError } from '../types/api';

/**
 * Utility functions for building consistent API responses
 */

export function buildSuccessResponse<T>(data: T, metadata?: any): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date(),
    metadata
  };
}

export function buildErrorResponse(
  error: string | ApiError,
  code: number = 400
): ErrorResponse {
  const errorObj = typeof error === 'string'
    ? { code: 'GENERIC_ERROR', message: error, timestamp: new Date() }
    : error;

  return {
    success: false,
    error: errorObj,
    timestamp: new Date()
  };
}

export function buildValidationErrorResponse(
  errors: Array<{ field: string; message: string; code: string }>
): ErrorResponse {
  return buildErrorResponse({
    code: 'VALIDATION_ERROR',
    message: 'Validation failed',
    details: errors,
    timestamp: new Date()
  });
}
