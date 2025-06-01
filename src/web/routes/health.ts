import { Router, Request, Response } from 'express';
import { ApiResponse, HealthCheckResponse } from '../types/api';
import { healthLimiter } from '../middleware';

const router = Router();

/**
 * Health check endpoint
 */
router.get('/health', healthLimiter, async (req: Request, res: Response) => {
  try {
    const uptime = process.uptime();

    // TODO: Add actual service health checks
    const healthData: HealthCheckResponse = {
      status: 'healthy',
      version: process.env.npm_package_version || '0.1.0',
      uptime,
      services: {
        llm: 'connected', // TODO: Check actual LLM service status
      }
    };

    const response: ApiResponse<HealthCheckResponse> = {
      success: true,
      data: healthData,
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: 'Health check failed',
      timestamp: new Date()
    };
    res.status(500).json(response);
  }
});

/**
 * Readiness probe for Kubernetes/Docker
 */
router.get('/ready', (req: Request, res: Response) => {
  // TODO: Add readiness checks (database connections, etc.)
  res.status(200).json({ status: 'ready' });
});

/**
 * Liveness probe for Kubernetes/Docker
 */
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({ status: 'alive' });
});

export default router;
