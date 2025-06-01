import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/api';

/**
 * Request validation middleware
 */
export const validateChatMessage = (req: Request, res: Response, next: NextFunction) => {
  const { content } = req.body;

  if (!content || typeof content !== 'string') {
    const response: ApiResponse = {
      success: false,
      error: 'Message content is required and must be a string',
      timestamp: new Date()
    };
    res.status(400).json(response);
    return;
  }

  if (content.trim().length === 0) {
    const response: ApiResponse = {
      success: false,
      error: 'Message content cannot be empty',
      timestamp: new Date()
    };
    res.status(400).json(response);
    return;
  }

  if (content.length > 10000) {
    const response: ApiResponse = {
      success: false,
      error: 'Message content is too long (max 10,000 characters)',
      timestamp: new Date()
    };
    res.status(400).json(response);
    return;
  }

  next();
};

/**
 * Session ID validation middleware
 */
export const validateSessionId = (req: Request, res: Response, next: NextFunction) => {
  const sessionId = req.headers['x-session-id'] || req.query.sessionId;

  if (sessionId && typeof sessionId === 'string') {
    // Basic UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid session ID format',
        timestamp: new Date()
      };
      res.status(400).json(response);
      return;
    }
  }

  next();
};
