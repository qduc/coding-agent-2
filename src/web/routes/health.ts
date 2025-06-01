import { Router, Request, Response } from 'express';
import { ApiResponse, HealthCheckResponse } from '../types/api';
import { healthLimiter } from '../middleware';
import { LLMService } from '../../shared/services/llm';
import os from 'os';
import process from 'process';
import { WebSessionManager } from '../implementations/WebSessionManager';

const router = Router();

/**
 * Basic health check endpoint
 * @returns {ApiResponse<HealthCheckResponse>} Health status with core metrics
 */
router.get('/health', healthLimiter, async (req: Request, res: Response) => {
  try {
    const llmService = new LLMService();
    const llmStatus = await llmService.initialize() ? 'connected' : 'disconnected';

    const healthData: HealthCheckResponse = {
      status: 'healthy',
      version: process.env.npm_package_version || '0.1.0',
      uptime: process.uptime(),
      // timestamp: new Date(), // Removed: timestamp is part of ApiResponse, not HealthCheckResponse data
      services: {
        llm: llmStatus,
        fileSystem: 'connected', 
      }
    };

    res.json({
      success: true,
      data: healthData,
      timestamp: new Date()
    } as ApiResponse<HealthCheckResponse>);
    return;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Health check failed',
        details: err.message
      },
      data: null,
      timestamp: new Date()
    } as ApiResponse); // Assuming ApiError structure for error object
    return;
  }
});

/**
 * Detailed system status endpoint
 * @returns {ApiResponse<HealthCheckResponse>} Comprehensive system status
 */
router.get('/status', healthLimiter, async (req: Request, res: Response) => {
  try {
    const llmService = new LLMService();
    const llmInitialized = await llmService.initialize();
    // Instantiate sessionManager once or get instance if it's a singleton
    const sessionManager = new WebSessionManager(); // Or WebSessionManager.getInstance() if singleton
    const activeSessions = sessionManager.getActiveSessionCount();

    const statusData: HealthCheckResponse = { // This type has status, version, uptime, services. Metrics are not part of it.
                                             // The response below uses a structure that includes metrics.
                                             // This implies HealthCheckResponse might need to be extended or a different type used.
                                             // For now, I'll assume HealthCheckResponse is flexible or the user wants to fit data into it.
      status: 'healthy', 
      version: process.env.npm_package_version || '0.1.0',
      uptime: process.uptime(),
      // timestamp: new Date(), // Removed: timestamp is part of ApiResponse, not HealthCheckResponse data
      metrics: {
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: process.memoryUsage().heapUsed,
          rss: process.memoryUsage().rss
        },
        cpu: {
          count: os.cpus().length,
          load: os.loadavg(),
          // usage: process.cpuUsage() // cpuUsage() returns { user: number, system: number }
        }
      } as any, // Cast to any because 'metrics' is not in HealthCheckResponse
      services: {
        llm: llmInitialized ? 'connected' : 'disconnected',
        fileSystem: 'connected', // Changed from 'available'
        // sessions: activeSessions, // sessions and tools are not part of HealthCheckResponse.services
        // tools: 'available'
      }
    };

    res.json({
      success: true,
      data: statusData,
      timestamp: new Date()
    } as ApiResponse<HealthCheckResponse>);
    return;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get system status',
        details: err.message
      },
      data: null,
      timestamp: new Date()
    } as ApiResponse); // Assuming ApiError structure for error object
    return;
  }
});

/**
 * Readiness probe for Kubernetes/Docker
 * @returns {ApiResponse} Readiness status
 */
router.get('/ready', healthLimiter, async (req: Request, res: Response) => {
  try {
    const llmService = new LLMService();
    const llmReady = await llmService.initialize();
    
    if (!llmReady) {
      throw new Error('LLM service not ready');
    }

    res.json({
      success: true,
      data: { status: 'ready' }, // status here is fine as it's custom data for this response
      timestamp: new Date()
    } as ApiResponse<{ status: string }>);
    return;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    res.status(503).json({
      success: false,
      error: {
        code: 'NOT_READY',
        message: 'System not ready',
        details: err.message
      },
      data: null,
      timestamp: new Date()
    } as ApiResponse); // Assuming ApiError structure for error object
    return;
  }
});

/**
 * Liveness probe for Kubernetes/Docker
 * @returns {ApiResponse} Liveness status
 */
router.get('/live', healthLimiter, (req: Request, res: Response) => {
  res.json({
    success: true,
    data: { 
      status: 'alive', // status here is fine as it's custom data for this response
      uptime: process.uptime() 
    },
    timestamp: new Date()
  } as ApiResponse<{ status: string; uptime: number }>);
  return; 
});

export default router;
