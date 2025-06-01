import { Router, Request, Response } from 'express';
import { ApiResponse, ConfigResponse } from '../types/api';
import { generalLimiter } from '../middleware';

const router = Router();

/**
 * Get application configuration
 */
router.get('/config', generalLimiter, async (req: Request, res: Response) => {
  try {
    // TODO: Get actual configuration from shared config
    const configData: ConfigResponse = {
      availableModels: [
        'gpt-4',
        'gpt-4-turbo-preview',
        'gpt-3.5-turbo',
        'claude-3-opus',
        'claude-3-sonnet',
        'gemini-pro'
      ],
      currentModel: process.env.DEFAULT_MODEL || 'gpt-4',
      features: {
        toolExecution: true,
        streaming: true,
        sessions: true
      }
    };

    const response: ApiResponse<ConfigResponse> = {
      success: true,
      data: configData,
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: 'Failed to retrieve configuration',
      timestamp: new Date()
    };
    res.status(500).json(response);
  }
});

export default router;
