import express, { Express } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import path from 'path';

// Import middleware
import { corsMiddleware, generalLimiter, errorHandler, notFoundHandler } from './middleware';

// Import routes
import { 
  healthRoutes,
  configRoutes,
  apiRoutes,
  authRoutes,
  toolsRoutes,
  projectRoutes,
  chatRoutes,
  fileRoutes,
  userRoutes
} from './routes';

// Import additional middleware
import { requestLogger, responseLogger } from './middleware/logging';
import { sessionMiddleware } from './middleware/session';
import { validateApiKey } from './middleware/auth';

// Import WebSocket handling
import {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
} from './types/websocket';
import { ChatHandler, SocketEvents } from './sockets';

/**
 * Express server with Socket.IO integration for the coding agent web interface
 */
export class WebServer {
  private app: Express;
  private server: any;
  private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  private port: number;

  constructor(port: number = 3001) {
    this.port = port;
    this.app = express();
    this.server = createServer(this.app);

    // Initialize Socket.IO
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: process.env.NODE_ENV === 'production'
          ? process.env.FRONTEND_URL || 'http://localhost:3000'
          : ['http://localhost:3000', 'http://127.0.0.1:3000'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupErrorHandling();
  }

  /**
   * Configure Express middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-eval'"], // Needed for some dev tools
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:"],
        },
      },
    }));

    // Request logging
    this.app.use(requestLogger);
    
    // CORS
    this.app.use(corsMiddleware);

    // Session handling
    this.app.use(sessionMiddleware);

    // Body parsing
    this.app.use(bodyParser.json({ limit: '5mb' })); // Increased for file uploads
    this.app.use(bodyParser.urlencoded({ extended: true, limit: '5mb' }));

    // Rate limiting
    this.app.use('/api', generalLimiter);
    this.app.use('/api/tools', validateApiKey); // Additional auth for tools API

    // Response logging
    this.app.use(responseLogger);

    // Static file serving (for frontend)
    if (process.env.NODE_ENV === 'production') {
      this.app.use(express.static(path.join(__dirname, '../../frontend/build')));
    }
  }

  /**
   * Configure API routes
   */
  private setupRoutes(): void {
    // Health check routes (no /api prefix for easier load balancer access)
    this.app.use('/', healthRoutes);

    // API routes
    this.app.use('/api', apiRoutes);
    this.app.use('/api/config', configRoutes);
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/tools', toolsRoutes);
    this.app.use('/api/projects', projectRoutes);
    this.app.use('/api/chat', chatRoutes);
    this.app.use('/api/files', fileRoutes);
    this.app.use('/api/users', userRoutes);

    // Serve React app for all other routes in production
    if (process.env.NODE_ENV === 'production') {
      this.app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../../frontend/build/index.html'));
      });
    }
  }

  /**
   * Configure WebSocket handling
   */
  private setupWebSocket(): void {
    this.io.on(SocketEvents.CONNECTION, (socket) => {
      console.log(`Client connected: ${socket.id}`);

      // Create chat handler for this socket
      const chatHandler = new ChatHandler(socket);

      // Handle connection errors
      socket.on(SocketEvents.ERROR, (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
      });

      socket.on(SocketEvents.DISCONNECT, (reason) => {
        console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
      });
    });

    // Handle server-level errors
    this.io.engine.on('connection_error', (err) => {
      console.error('Connection error:', err);
    });
  }

  /**
   * Configure error handling
   */
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server.listen(this.port, () => {
          console.log(`🚀 Coding Agent Web Server running on port ${this.port}`);
          console.log(`🌐 API available at: http://localhost:${this.port}/api`);
          console.log(`🔌 WebSocket available at: ws://localhost:${this.port}`);

          if (process.env.NODE_ENV !== 'production') {
            console.log(`📊 Health check: http://localhost:${this.port}/health`);
            console.log(`⚙️  Config: http://localhost:${this.port}/api/config`);
          }

          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the server gracefully
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      console.log('🛑 Shutting down web server...');

      // Close Socket.IO connections
      this.io.close(() => {
        console.log('✅ WebSocket connections closed');
      });

      // Close HTTP server
      this.server.close(() => {
        console.log('✅ HTTP server closed');
        resolve();
      });
    });
  }

  /**
   * Get the Express app instance
   */
  getApp(): Express {
    return this.app;
  }

  /**
   * Get the Socket.IO server instance
   */
  getIO(): SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {
    return this.io;
  }

  /**
   * Get server info
   */
  getInfo() {
    return {
      port: this.port,
      environment: process.env.NODE_ENV || 'development',
      socketConnections: this.io.engine.clientsCount
    };
  }
}

// Create and export default server instance
export const webServer = new WebServer(parseInt(process.env.PORT || '3001', 10));
