/**
 * Validation utilities for tools
 *
 * Provides parameter validation, path validation, and file extension checking
 * for tool inputs to ensure they meet the expected format and constraints.
 */

import * as path from 'path';
import * as fs from 'fs';
import { ToolSchema, PropertySchema, ToolError } from './types';

/**
 * Validates parameters against a tool schema
 */
export function validateParams(params: any, schema: ToolSchema): void {
  if (!params || typeof params !== 'object') {
    throw new ToolError('Parameters must be an object', 'VALIDATION_ERROR');
  }

  // Check required parameters
  if (schema.required) {
    for (const requiredParam of schema.required) {
      if (!(requiredParam in params)) {
        throw new ToolError(`Missing required parameter: ${requiredParam}`, 'VALIDATION_ERROR');
      }
    }
  }

  // Validate each parameter
  if (schema.properties) {
    for (const [paramName, paramValue] of Object.entries(params)) {
      const propSchema = schema.properties[paramName];
      if (propSchema) {
        validateProperty(paramName, paramValue, propSchema);
      }
    }
  }
}

/**
 * Validates a single property against its schema
 */
function validateProperty(name: string, value: any, schema: PropertySchema): void {
  // Type validation
  if (schema.type) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== schema.type) {
      throw new ToolError(`Parameter '${name}' must be of type ${schema.type}, got ${actualType}`, 'VALIDATION_ERROR');
    }
  }

  // String validations
  if (schema.type === 'string' && typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      throw new ToolError(`Parameter '${name}' must be at least ${schema.minLength} characters long`, 'VALIDATION_ERROR');
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      throw new ToolError(`Parameter '${name}' must be at most ${schema.maxLength} characters long`, 'VALIDATION_ERROR');
    }
    if (schema.pattern) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        throw new ToolError(`Parameter '${name}' does not match required pattern`, 'VALIDATION_ERROR');
      }
    }
  }

  // Number validations
  if (schema.type === 'number' && typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      throw new ToolError(`Parameter '${name}' must be at least ${schema.minimum}`, 'VALIDATION_ERROR');
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      throw new ToolError(`Parameter '${name}' must be at most ${schema.maximum}`, 'VALIDATION_ERROR');
    }
  }

  // Array validations
  if (schema.type === 'array' && Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      throw new ToolError(`Parameter '${name}' must have at least ${schema.minItems} items`, 'VALIDATION_ERROR');
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      throw new ToolError(`Parameter '${name}' must have at most ${schema.maxItems} items`, 'VALIDATION_ERROR');
    }
    if (schema.items) {
      value.forEach((item, index) => {
        validateProperty(`${name}[${index}]`, item, schema.items!);
      });
    }
  }
}

/**
 * Validates that a path is safe and within allowed boundaries
 */
export function validatePath(filePath: string, options: { allowAbsolute?: boolean; mustExist?: boolean } = {}): void {
  if (!filePath || typeof filePath !== 'string') {
    throw new ToolError('Path must be a non-empty string', 'VALIDATION_ERROR');
  }

  const normalizedPath = path.normalize(filePath);

  // Check for path traversal attempts
  if (normalizedPath.includes('..')) {
    throw new ToolError('Path traversal is not allowed', 'VALIDATION_ERROR');
  }

  // Check absolute path restrictions
  if (!options.allowAbsolute && path.isAbsolute(normalizedPath)) {
    throw new ToolError('Absolute paths are not allowed', 'VALIDATION_ERROR');
  }

  // Check if file must exist
  if (options.mustExist) {
    try {
      if (!fs.existsSync(normalizedPath)) {
        throw new ToolError(`Path does not exist: ${normalizedPath}`, 'VALIDATION_ERROR');
      }
    } catch (error) {
      if (error instanceof ToolError) {
        throw error;
      }
      throw new ToolError(`Cannot access path: ${normalizedPath}`, 'VALIDATION_ERROR');
    }
  }
}

/**
 * Validates file extension against allowed extensions
 */
export function validateFileExtension(filePath: string, allowedExtensions: string[]): void {
  if (!filePath || typeof filePath !== 'string') {
    throw new ToolError('File path must be a non-empty string', 'VALIDATION_ERROR');
  }

  if (!allowedExtensions || allowedExtensions.length === 0) {
    return; // No restrictions
  }

  const ext = path.extname(filePath).toLowerCase();
  const normalizedExtensions = allowedExtensions.map(e => e.toLowerCase().startsWith('.') ? e.toLowerCase() : `.${e.toLowerCase()}`);

  if (!normalizedExtensions.includes(ext)) {
    throw new ToolError(`File extension '${ext}' is not allowed. Allowed extensions: ${normalizedExtensions.join(', ')}`, 'VALIDATION_ERROR');
  }
}