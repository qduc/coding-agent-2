#!/usr/bin/env node

import { webServer } from './server';

/**
 * Start the web server
 */
async function startServer() {
  try {
    // Validate environment
    // if (!process.env.API_KEY) {
    //   console.error('❌ API_KEY environment variable is required');
    //   process.exit(1);
    // }

    // Log startup info
    console.log('🚀 Starting Coding Agent Web Server');
    console.log('📋 Environment:', process.env.NODE_ENV || 'development');
    console.log('🔑 API Routes:');
    console.log('  - /api/config');
    console.log('  - /api/auth');
    console.log('  - /api/tools');
    console.log('  - /api/projects');
    console.log('  - /api/chat');
    console.log('  - /api/files');
    console.log('  - /api/users');

    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n📡 Received ${signal}. Starting graceful shutdown...`);
      try {
        // Close database connections, caches, etc here if needed
        await webServer.stop();
        console.log('✅ Server shutdown complete');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });

    // Start the server
    await webServer.start();

    // Verify health endpoint
    const healthCheck = await fetch(`http://localhost:${process.env.PORT || 3001}/health`);
    if (!healthCheck.ok) {
      throw new Error('Health check failed');
    }
    console.log('✅ Health check passed');

    // Verify API endpoints
    const apiCheck = await fetch(`http://localhost:${process.env.PORT || 3001}/api`);
    if (!apiCheck.ok) {
      throw new Error('API root endpoint failed');
    }
    console.log('✅ API endpoints verified');

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start if this file is run directly
if (require.main === module) {
  startServer();
}
