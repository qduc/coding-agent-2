import { Router, Request, Response } from 'express'; // Added Request, Response
import { WebSessionManager } from '../implementations/WebSessionManager';
import { ApiResponse, SessionInfo, ChatMessage, ApiError, ErrorResponse } from '../types/api'; // Removed ChatSession, ValidationError (unused here)
import { validateRequest, ZodSchemaType } from '../middleware/validation'; // Added ZodSchemaType
import { generalLimiter } from '../middleware/rateLimiter'; // Using generalLimiter
import { paginate } from '../utils/pagination'; // Assuming this exists and is typed
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid'; // For generating message IDs

const router = Router();
const sessionManager = new WebSessionManager();

// Session Management Endpoints
router.get('/api/sessions', generalLimiter, async (req: Request, res: Response) => {
  try {
    const allSessions = sessionManager.getAllSessions(); // Use getter
    const sessionsInfo: SessionInfo[] = allSessions.map(session => ({
      id: session.id,
      createdAt: session.createdAt,
      lastActive: session.lastActivity, // Match SessionInfo type (lastActive vs lastActivity)
      messageCount: session.messages.length
    } as SessionInfo));

    res.json({
      success: true,
      data: sessions,
      timestamp: new Date()
    } as ApiResponse<SessionInfo[]>);
  } catch (error) {
    const apiError: ApiError = { code: 'SESSION_LIST_ERROR', message: 'Failed to list sessions', details: String(error), timestamp: new Date() };
    res.status(500).json({ success: false, error: apiError, timestamp: new Date() } as ErrorResponse);
  }
});

// Using generalLimiter as specific rateLimit setup is not fully clear from context
router.post('/api/sessions', generalLimiter, async (req: Request, res: Response) => {
  try {
    const session = sessionManager.createSession(); // This now returns ChatSession
    const sessionInfo: SessionInfo = {
      id: session.id,
      createdAt: session.createdAt,
      lastActive: session.lastActivity, // Match SessionInfo type
      messageCount: session.messages.length,
    };
    res.status(201).json({
      success: true,
      data: sessionInfo,
      timestamp: new Date()
    } as ApiResponse<SessionInfo>);
  } catch (error) {
    const apiError: ApiError = { code: 'SESSION_CREATION_ERROR', message: 'Failed to create session', details: String(error), timestamp: new Date() };
    res.status(500).json({ success: false, error: apiError, timestamp: new Date() } as ErrorResponse);
  }
});

const sessionIdParamsSchema = z.object({ sessionId: z.string().uuid() }); // Example: use UUID if that's the format

router.get('/api/sessions/:sessionId', generalLimiter, validateRequest({ params: sessionIdParamsSchema }), async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params; // Typed by Zod validation if using validateRequest properly
    const session = sessionManager.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: { code: 'SESSION_NOT_FOUND', message: 'Session not found', timestamp: new Date() },
        timestamp: new Date()
      } as ErrorResponse);
    }
    const sessionInfo: SessionInfo = {
      id: session.id,
      createdAt: session.createdAt,
      lastActive: session.lastActivity,
      messageCount: session.messages.length,
    };
    res.json({
      success: true,
      data: sessionInfo,
      timestamp: new Date()
    } as ApiResponse<SessionInfo>);
  } catch (error) {
    const apiError: ApiError = { code: 'SESSION_FETCH_ERROR', message: 'Failed to fetch session', details: String(error), timestamp: new Date() };
    res.status(500).json({ success: false, error: apiError, timestamp: new Date() } as ErrorResponse);
  }
});

router.delete('/api/sessions/:sessionId', generalLimiter, validateRequest({ params: sessionIdParamsSchema }), async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const success = sessionManager.terminateSession(sessionId); // Use terminateSession

    if (!success) {
      return res.status(404).json({
        success: false,
        error: { code: 'SESSION_NOT_FOUND', message: 'Session not found', timestamp: new Date() },
        timestamp: new Date()
      } as ErrorResponse);
    }

    res.json({
      success: true,
      data: { id: sessionId, message: 'Session terminated' },
      timestamp: new Date()
    } as ApiResponse<{ id: string; message: string }>);
  } catch (error) {
    const apiError: ApiError = { code: 'SESSION_DELETION_ERROR', message: 'Failed to delete session', details: String(error), timestamp: new Date() };
    res.status(500).json({ success: false, error: apiError, timestamp: new Date() } as ErrorResponse);
  }
});

// History Management Endpoints
const historyParamsSchema = z.object({ sessionId: z.string().uuid() });
const historyQuerySchema = z.object({ page: z.string().optional().default('1'), pageSize: z.string().optional().default('20') });


router.get('/api/sessions/:sessionId/history',
  generalLimiter,
  validateRequest({ params: historyParamsSchema, query: historyQuerySchema }),
  paginate(), // Assuming paginate middleware is correctly set up
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params as ZodSchemaType<typeof historyParamsSchema>;
      const { page, pageSize } = req.query as ZodSchemaType<typeof historyQuerySchema>;
      const session = sessionManager.getSession(sessionId);

      if (!session) {
        return res.status(404).json({
          success: false,
          error: { code: 'SESSION_NOT_FOUND', message: 'Session not found', timestamp: new Date() },
          timestamp: new Date()
        } as ErrorResponse);
      }

      const messages: ChatMessage[] = session.messages;
      const total = messages.length;
      const start = (Number(page) - 1) * Number(pageSize);
      const end = start + Number(pageSize);
      const paginatedMessages = messages.slice(start, end);

      res.json({
        success: true,
        data: paginatedMessages,
        timestamp: new Date(),
        metadata: {
          page: Number(page),
          pageSize: Number(pageSize),
          total
        }
      } as ApiResponse<ChatMessage[]>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'HISTORY_FETCH_ERROR', message: 'Failed to fetch history', details: String(error), timestamp: new Date() },
        timestamp: new Date()
      } as ErrorResponse);
    }
  }
);

const addMessageParamsSchema = z.object({ sessionId: z.string().uuid() });
const addMessageBodySchema = z.object({
  content: z.string(),
  role: z.enum(['user', 'assistant', 'system', 'tool']), // Match ChatMessage role type
});

router.post('/api/sessions/:sessionId/history',
  generalLimiter,
  validateRequest({ params: addMessageParamsSchema, body: addMessageBodySchema }),
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params as ZodSchemaType<typeof addMessageParamsSchema>;
      const { content, role } = req.body as ZodSchemaType<typeof addMessageBodySchema>;

      const session = sessionManager.getSession(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: { code: 'SESSION_NOT_FOUND', message: 'Session not found', timestamp: new Date() },
          timestamp: new Date()
        } as ErrorResponse);
      }

      const message: ChatMessage = {
        id: uuidv4(), // Add ID to ChatMessage
        content,
        role,
        timestamp: new Date()
      };

      sessionManager.addMessage(sessionId, message); // Use modified addMessage

      res.status(201).json({
        success: true,
        data: message,
        timestamp: new Date()
      } as ApiResponse<ChatMessage>);
    } catch (error) {
      const apiError: ApiError = { code: 'MESSAGE_ADD_ERROR', message: 'Failed to add message', details: String(error), timestamp: new Date() };
      res.status(500).json({ success: false, error: apiError, timestamp: new Date() } as ErrorResponse);
    }
  }
);

router.delete('/api/sessions/:sessionId/history',
  generalLimiter,
  validateRequest({ params: historyParamsSchema }),
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params as ZodSchemaType<typeof historyParamsSchema>;
      const session = sessionManager.getSession(sessionId);

      if (!session) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: 'Session not found',
            timestamp: new Date()
          },
          timestamp: new Date()
        });
      }

      sessionManager.clearHistory(sessionId);

      res.json({
        success: true,
        data: { id: sessionId },
        timestamp: new Date()
      } as ApiResponse<{ id: string }>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'HISTORY_CLEAR_ERROR',
          message: 'Failed to clear history',
          details: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        },
        timestamp: new Date()
      });
    }
  }
);

router.get('/api/sessions/:sessionId/history/search',
  validateRequest({
    sessionId: 'string',
    query: 'string'
  }),
  paginate(),
  async (req, res) => {
    try {
      const { sessionId, query } = req.params;
      const { page = 1, pageSize = 20 } = req.query;
      const session = sessionManager.getSession(sessionId);

      if (!session) {
        return res.status(404).json({
          success: false,
          error: { code: 'SESSION_NOT_FOUND', message: 'Session not found', timestamp: new Date() },
          timestamp: new Date()
        } as ErrorResponse);
      }

      const searchQuery = (query as string).toLowerCase(); // Ensure query is string
      const results = session.messages.filter(message =>
        message.content.toLowerCase().includes(searchQuery)
      );
      const total = results.length;
      const start = (Number(page) - 1) * Number(pageSize);
      const end = start + Number(pageSize);
      const paginatedResults = results.slice(start, end);

      res.json({
        success: true,
        data: paginatedResults,
        timestamp: new Date(),
        metadata: {
          page: Number(page),
          pageSize: Number(pageSize),
          total
        }
      } as ApiResponse<ChatMessage[]>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'HISTORY_SEARCH_ERROR', message: 'Failed to search history', details: String(error), timestamp: new Date() },
        timestamp: new Date()
      } as ErrorResponse);
    }
  }
);

export default router;
