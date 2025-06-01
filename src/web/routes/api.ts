import { Router, Request, Response } from 'express';
import { ApiResponse } from '../types/api';
import { generalLimiter, chatLimiter, validateChatMessage, validateSessionId } from '../middleware';

const router = Router();

/**
 * Test endpoint for API functionality
 */
router.get('/test', generalLimiter, (req: Request, res: Response) => {
  const response: ApiResponse<string> = {
    success: true,
    data: 'API is working correctly',
    timestamp: new Date()
  };
  res.json(response);
});

/**
 * Chat endpoint for REST API (fallback when WebSocket not available)
 */
router.post('/chat',
  chatLimiter,
  validateSessionId,
  validateChatMessage,
  async (req: Request, res: Response) => {
    try {
      const { content } = req.body;
      const sessionId = req.headers['x-session-id'] as string;

      // TODO: Integrate with shared Agent/Orchestrator
      // For now, return a placeholder response
      const response: ApiResponse<{ message: string; messageId: string }> = {
        success: true,
        data: {
          message: `Echo: ${content}`,
          messageId: `msg_${Date.now()}`
        },
        timestamp: new Date()
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: 'Chat processing failed',
        timestamp: new Date()
      };
      res.status(500).json(response);
    }
  }
);

export default router;
