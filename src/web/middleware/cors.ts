import cors from 'cors';
import { CorsOptions } from 'cors';

/**
 * CORS configuration for the web server
 */
export const corsOptions: CorsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL || 'http://localhost:3000'
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id'],
};

export const corsMiddleware = cors(corsOptions);
