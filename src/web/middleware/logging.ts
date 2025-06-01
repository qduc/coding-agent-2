import { Request, Response, NextFunction } from 'express';
import { Logger } from '../../shared/utils/logger';

const logger = Logger.getInstance();

/**
 * Middleware to log incoming requests
 */
export const requestLogger = (req: Request, _res: Response, next: NextFunction) => {
  logger.debug(`${req.method} ${req.originalUrl}`);
  next();
};

/**
 * Middleware to log responses
 */
export const responseLogger = (_req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  res.send = function(body) {
    logger.debug(`Response: ${res.statusCode}`);
    return originalSend.call(this, body);
  };
  next();
};
