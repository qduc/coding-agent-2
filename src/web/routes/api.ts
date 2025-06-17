import { Router, Request, Response } from 'express';
import { ApiResponse, StreamingResponse, ApiError } from '../types/api'; // Added ApiError
import {
  generalLimiter,
  chatLimiter,
  validateChatMessage,
  validateSessionId,
} from '../middleware';
import { WebSessionManager } from '../implementations/WebSessionManager';
import { Agent } from '../../shared/core/agent';
import { Logger } from '../../shared/utils/logger';

const router = Router();
const logger = Logger.getInstance();
const sessionManager = new WebSessionManager();
const agent = new Agent();

/**
 * API Information Endpoint
 */
router.get('/info', generalLimiter, (req: Request, res: Response) => {
  const response: ApiResponse<{
    version: string;
    capabilities: string[];
    endpoints: string[];
  }> = {
    success: true,
    data: {
      version: '1.0.0',
      capabilities: [
        'chat',
        'session-management',
        'tool-execution'
      ],
      endpoints: [
        'GET /api/info',
        'GET /api/test',
        'POST /api/chat'
      ],
    },
    timestamp: new Date()
  };
  res.json(response);
});

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

      let session = sessionManager.getSession(sessionId);
      if (!session) {
        session = sessionManager.createSession(sessionId);
      }
      // agent.processMessage expects (userMessage: string, onChunk?: (chunk: string) => void, verbose?: boolean)
      // The `session` object here is a ChatSession, not an agent session or options object.
      // We need to decide where `verbose` comes from. Defaulting to false.
      // The `onChunk` is not used in the non-streaming version.
      const agentResponse = await agent.processMessage(content, undefined, false);

      const apiResponse: ApiResponse<typeof agentResponse> = {
        success: true,
        data: agentResponse, // Corrected from 'response' to 'agentResponse'
        timestamp: new Date()
      };

      res.json(apiResponse);
      return;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Chat processing failed', { 
        name: err.name, 
        message: err.message,
        stack: err.stack
      });
      const apiError: ApiError = {
        code: 'CHAT_PROCESSING_ERROR',
        message: 'Chat processing failed',
        details: err.message,
        timestamp: new Date()
      };
      const errorResponse: ApiResponse<null> = { // Explicitly type error response
        success: false,
        error: apiError,
        data: null,
        timestamp: new Date()
      };
      res.status(500).json(errorResponse);
      return;
    }
  }
);


export default router;
