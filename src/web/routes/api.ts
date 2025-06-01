import { Router, Request, Response } from 'express';
import { ApiResponse, StreamingResponse } from '../types/api';
import {
  generalLimiter,
  chatLimiter,
  generalLimiter,
  chatLimiter,
  validateChatMessage,
  validateSessionId,
  // Removed generalLimiter from here as it's already imported above
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
        data: response,
        timestamp: new Date()
      };

      res.json(apiResponse);
    } catch (error) {
      logger.error('Chat processing failed', { 
        error: { 
          name: (error instanceof Error) ? error.name : 'Error', 
          message: (error instanceof Error) ? error.message : String(error),
          stack: (error instanceof Error) ? error.stack : undefined
        } 
      });
      const apiError: ApiError = {
        code: 'CHAT_PROCESSING_ERROR',
        message: 'Chat processing failed',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      };
      const response: ApiResponse = {
        success: false,
        error: apiError,
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

      let session = sessionManager.getSession(sessionId);
      if (!session) {
        session = sessionManager.createSession(sessionId);
      }

      // Use agent.processMessage with onChunk callback
      try {
        await agent.processMessage(
          content,
          (chunk: string) => {
            const eventData: StreamingResponse = {
              event: 'data',
              data: chunk,
              timestamp: new Date()
            };
            res.write(`data: ${JSON.stringify(eventData)}\n\n`);
          },
          false // verbose flag, assuming false for now
        );

        const completeEvent: StreamingResponse = {
          event: 'complete',
          timestamp: new Date()
        };
        res.write(`data: ${JSON.stringify(completeEvent)}\n\n`);
      } catch (error) {
        logger.error('Streaming chat processing failed', {
          error: {
            name: (error instanceof Error) ? error.name : 'Error',
            message: (error instanceof Error) ? error.message : String(error),
            stack: (error instanceof Error) ? error.stack : undefined
          }
        });
        const errorEvent: StreamingResponse = {
          event: 'error',
          error: {
            code: 'STREAM_PROCESSING_ERROR',
            message: 'Stream processing failed',
            details: error instanceof Error ? error.message : String(error),
            timestamp: new Date()
          },
          timestamp: new Date()
        };
        res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
      } finally {
        res.end();
      }
    } catch (error) { // Catch errors from session management or header setting
      logger.error('Streaming chat setup failed', {
        error: {
          name: (error instanceof Error) ? error.name : 'Error',
          message: (error instanceof Error) ? error.message : String(error),
          stack: (error instanceof Error) ? error.stack : undefined
        }
      });
      // Ensure headers are set before writing error if not already sent
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
      }
      const criticalErrorEvent: StreamingResponse = {
        event: 'error',
        error: {
          code: 'STREAM_SETUP_ERROR',
          message: 'Stream setup failed',
          details: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        },
        timestamp: new Date()
      };
      res.write(`data: ${JSON.stringify(criticalErrorEvent)}\n\n`);
      res.end();
    }
  }
);

export default router;
