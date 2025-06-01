import { z } from 'zod';
import { ApiResponse, ValidationError } from '../types/api';

/**
 * Request validation utilities using Zod schemas
 */

export function validateRequestBody<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { isValid: boolean; data?: T; errors?: ValidationError[] } {
  try {
    const validatedData = schema.parse(data);
    return { isValid: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationErrors: ValidationError[] = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }));
      return { isValid: false, errors: validationErrors };
    }
    return {
      isValid: false,
      errors: [{ field: 'unknown', message: 'Validation failed', code: 'VALIDATION_ERROR' }]
    };
  }
}

export function validateQuery<T>(
  schema: z.ZodSchema<T>,
  query: unknown
): { isValid: boolean; data?: T; errors?: ValidationError[] } {
  return validateRequestBody(schema, query);
}

export function validateParams<T>(
  schema: z.ZodSchema<T>,
  params: unknown
): { isValid: boolean; data?: T; errors?: ValidationError[] } {
  return validateRequestBody(schema, params);
}
