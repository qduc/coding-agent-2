/**
 * @module Web
 * @version 1.0.0
 * @description Core web module for the Coding Agent application
 * 
 * Provides:
 * - HTTP server and routing
 * - WebSocket communication
 * - API endpoints and middleware
 * - Tool execution context for web
 * 
 * @example
 * // Basic usage:
 * import { startServer } from './web';
 * import { apiRouter } from './web/routes';
 * 
 * startServer({
 *   port: 3000,
 *   routes: [apiRouter]
 * });
 */

// Core Server
export * from './server';

// Routes
export * from './routes/api';
export * from './routes/project';
export * from './routes/tools';
export * from './routes/chat';

// Middleware
export * from './middleware/auth';
export * from './middleware/validation';
export * from './middleware/errorHandler';
export * from './middleware/context';

// WebSocket
export * from './sockets/events';
export * from './sockets/manager';
export * from './sockets/handlers';

// Implementations
export * from './implementations/WebToolExecutionContext';
export * from './implementations/WebInputHandler';

// Types
export * from './types/api';
export * from './types/validation';
export * from './types/websocket';
export * from './types/context';

// Utilities
export * from './utils/responseBuilder';
export * from './utils/requestValidator';
