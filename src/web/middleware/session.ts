import { Request, Response, NextFunction } from 'express';
import { WebSessionManager } from '../implementations/WebSessionManager';

const sessionManager = new WebSessionManager();

/**
 * Middleware to handle session management
 */
export const sessionMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  // Extract session from headers or cookies if needed
  const sessionId = req.headers['x-session-id'] as string || req.cookies?.sessionId;

  if (sessionId) {
    const session = sessionManager.getSession(sessionId);
    if (session) {
      // Attach session to request object for route handlers
      (req as any).session = session;
    }
  }

  next();
};
