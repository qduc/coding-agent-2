import { Router, Request, Response } from 'express';
import { ApiResponse, StreamingResponse } from '../types/api';
import { 
  generalLimiter, 
  chatLimiter, 
  validateChatMessage, 
  validateSessionId 
} from '../middleware';
import { WebSessionManager } from '../implementations/WebSessionManager';
import { Agent } from '../../shared/agent/Agent';
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
        'streaming',
        'session-management',
        'tool-execution'
      ],
      endpoints: [
        'GET /api/info',
        'GET /api/test',
        'POST /api/chat',
        'POST /api/chat/stream'
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
      
      const session = sessionManager.getOrCreateSession(sessionId);
      const response = await agent.processMessage(content, session);

      const apiResponse: ApiResponse<typeof response> = {
        success: true,
        data: response,
        timestamp: new Date()
      };

      res.json(apiResponse);
    } catch (error) {
      logger.error('Chat processing failed', { error });
      const response: ApiResponse = {
        success: false,
        error: 'Chat processing failed',
        timestamp: new Date()
      };
      res.status(500).json(response);
    }
  }
);

/**
 * Streaming chat endpoint
 */
router.post('/chat/stream',
  chatLimiter,
  validateSessionId,
  validateChatMessage,
  async (req: Request, res: Response) => {
    try {
      const { content } = req.body;
      const sessionId = req.headers['x-session-id'] as string;
      
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const session = sessionManager.getOrCreateSession(sessionId);
      const stream = await agent.processMessageStream(content, session);

      for await (const chunk of stream) {
        const event: StreamingResponse = {
          event: 'data',
          data: chunk
        };
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }

      const completeEvent: StreamingResponse = {
        event: 'complete',
        timestamp: new Date()
      };
      res.write(`data: ${JSON.stringify(completeEvent)}\n\n`);
      res.end();
    } catch (error) {
      logger.error('Streaming chat failed', { error });
      const event: StreamingResponse = {
        event: 'error',
        error: {
          code: 'STREAM_ERROR',
          message: 'Stream processing failed',
          timestamp: new Date()
        }
      };
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      res.end();
    }
  }
);

export default router;
