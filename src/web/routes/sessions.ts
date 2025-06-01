import { Router, Request, Response } from 'express';
import { WebSessionManager } from '../implementations/WebSessionManager';
import { ApiResponse, SessionInfo, ChatMessage, ApiError, ErrorResponse } from '../types/api';
import { validateRequest } from '../middleware/validation';
import { generalLimiter } from '../middleware/rateLimiter';
import { paginateArray } from '../utils/pagination'; // Removed parsePaginationParams as it's not used in the provided snippet, ensure paginateArray handles parsing if needed
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
      data: sessionsInfo,
      timestamp: new Date()
    } as ApiResponse<SessionInfo[]>);
    return;
  } catch (error) {
    const apiError: ApiError = { code: 'SESSION_LIST_ERROR', message: 'Failed to list sessions', details: String(error), timestamp: new Date() };
    res.status(500).json({ success: false, error: apiError, timestamp: new Date() } as ErrorResponse);
    return;
  }
});

// Using generalLimiter as specific rateLimit setup is not fully clear from context
router.post('/api/sessions', generalLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const session = sessionManager.createSession();
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
    return;
  } catch (error) {
    const apiError: ApiError = { code: 'SESSION_CREATION_ERROR', message: 'Failed to create session', details: String(error), timestamp: new Date() };
    res.status(500).json({ success: false, error: apiError, timestamp: new Date() } as ErrorResponse);
    return;
  }
});

const sessionIdParamsSchema = z.object({ sessionId: z.string().uuid() });

router.get('/api/sessions/:sessionId', generalLimiter, validateRequest({ params: sessionIdParamsSchema }), async (req: Request, res: Response): Promise<void> => {
  try {
    // Assuming validateRequest populates req.params correctly after schema validation
    const { sessionId } = req.params as z.infer<typeof sessionIdParamsSchema>;
    const session = sessionManager.getSession(sessionId);

    if (!session) {
      res.status(404).json({
        success: false,
        error: { code: 'SESSION_NOT_FOUND', message: 'Session not found', timestamp: new Date() },
        timestamp: new Date()
      } as ErrorResponse);
      return;
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
    return;
  } catch (error) {
    const apiError: ApiError = { code: 'SESSION_FETCH_ERROR', message: 'Failed to fetch session', details: String(error), timestamp: new Date() };
    res.status(500).json({ success: false, error: apiError, timestamp: new Date() } as ErrorResponse);
    return;
  }
});

router.delete('/api/sessions/:sessionId', generalLimiter, validateRequest({ params: sessionIdParamsSchema }), async (req: Request, res: Response): Promise<void> => {
  try {
    // Assuming validateRequest populates req.params correctly
    const { sessionId } = req.params as z.infer<typeof sessionIdParamsSchema>;
    const success = sessionManager.terminateSession(sessionId);

    if (!success) {
      res.status(404).json({
        success: false,
        error: { code: 'SESSION_NOT_FOUND', message: 'Session not found', timestamp: new Date() },
        timestamp: new Date()
      } as ErrorResponse);
      return;
    }

    res.json({
      success: true,
      data: { id: sessionId, message: 'Session terminated' },
      timestamp: new Date()
    } as ApiResponse<{ id: string; message: string }>);
    return;
  } catch (error) {
    const apiError: ApiError = { code: 'SESSION_DELETION_ERROR', message: 'Failed to delete session', details: String(error), timestamp: new Date() };
    res.status(500).json({ success: false, error: apiError, timestamp: new Date() } as ErrorResponse);
    return;
  }
});

// History Management Endpoints
const historyParamsSchema = z.object({ sessionId: z.string().uuid() });
const historyQuerySchema = z.object({ page: z.string().optional().default('1'), pageSize: z.string().optional().default('20') });


router.get('/api/sessions/:sessionId/history',
  generalLimiter,
  validateRequest({ params: historyParamsSchema, query: historyQuerySchema }), // Kept as is, per rule for multi-key
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params as z.infer<typeof historyParamsSchema>;
      const { page, pageSize } = req.query as z.infer<typeof historyQuerySchema>; // Assuming Zod populates req.query
      const session = sessionManager.getSession(sessionId);

      if (!session) {
        res.status(404).json({
          success: false,
          error: { code: 'SESSION_NOT_FOUND', message: 'Session not found', timestamp: new Date() },
          timestamp: new Date()
        } as ErrorResponse);
        return;
      }

      const messages: ChatMessage[] = session.messages;
      const paginatedResponse = paginateArray(messages, Number(page), Number(pageSize));
      
      res.json(paginatedResponse);
      return;
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'HISTORY_FETCH_ERROR', message: 'Failed to fetch history', details: String(error), timestamp: new Date() },
        timestamp: new Date()
      } as ErrorResponse);
      return;
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
  validateRequest({ params: addMessageParamsSchema, body: addMessageBodySchema }), // Kept as is
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params as z.infer<typeof addMessageParamsSchema>;
      const { content, role } = req.body as z.infer<typeof addMessageBodySchema>; // Assuming Zod populates req.body

      const session = sessionManager.getSession(sessionId);
      if (!session) {
        res.status(404).json({
          success: false,
          error: { code: 'SESSION_NOT_FOUND', message: 'Session not found', timestamp: new Date() },
          timestamp: new Date()
        } as ErrorResponse);
        return;
      }

      const message: ChatMessage = {
        id: uuidv4(), // Add ID to ChatMessage
        content,
        role: role as ChatMessage['role'], // Ensure role matches ChatMessage role type
        timestamp: new Date()
      };

      sessionManager.addMessage(sessionId, message);

      res.status(201).json({
        success: true,
        data: message,
        timestamp: new Date()
      } as ApiResponse<ChatMessage>);
      return;
    } catch (error) {
      const apiError: ApiError = { code: 'MESSAGE_ADD_ERROR', message: 'Failed to add message', details: String(error), timestamp: new Date() };
      res.status(500).json({ success: false, error: apiError, timestamp: new Date() } as ErrorResponse);
      return;
    }
  }
);

router.delete('/api/sessions/:sessionId/history',
  generalLimiter,
  validateRequest({ params: historyParamsSchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params as z.infer<typeof historyParamsSchema>; // Assuming Zod populates req.params
      const session = sessionManager.getSession(sessionId);

      if (!session) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: 'Session not found',
            timestamp: new Date()
          },
          timestamp: new Date()
        } as ErrorResponse);
        return;
      }

      sessionManager.clearHistory(sessionId);

      res.json({
        success: true,
        data: { id: sessionId, message: 'History cleared' },
        timestamp: new Date()
      } as ApiResponse<{ id: string; message: string }>);
      return;
    } catch (error) {
      const apiError: ApiError = { code: 'HISTORY_CLEAR_ERROR', message: 'Failed to clear history', details: String(error), timestamp: new Date() };
      res.status(500).json({ success: false, error: apiError, timestamp: new Date() } as ErrorResponse);
      return;
    }
  }
);

const searchHistoryParamsSchema = z.object({ sessionId: z.string().uuid() });
// query for search should be in req.query, not req.params
const searchHistoryQuerySchema = z.object({ 
  query: z.string(),
  page: z.string().optional().default('1'),
  pageSize: z.string().optional().default('20'),
});


router.get('/api/sessions/:sessionId/history/search',
  generalLimiter,
  validateRequest({ params: searchHistoryParamsSchema, query: searchHistoryQuerySchema }), // Kept as is
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params as z.infer<typeof searchHistoryParamsSchema>;
      const { query, page, pageSize } = req.query as z.infer<typeof searchHistoryQuerySchema>; // Assuming Zod populates req.query
      const session = sessionManager.getSession(sessionId);

      if (!session) {
        res.status(404).json({
          success: false,
          error: { code: 'SESSION_NOT_FOUND', message: 'Session not found', timestamp: new Date() },
          timestamp: new Date()
        } as ErrorResponse);
        return;
      }

      const searchQuery = query.toLowerCase();
      const results = session.messages.filter(message =>
        message.content.toLowerCase().includes(searchQuery)
      );
      
      const paginatedResponse = paginateArray(results, Number(page), Number(pageSize));

      res.json(paginatedResponse);
      return;
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'HISTORY_SEARCH_ERROR', message: 'Failed to search history', details: String(error), timestamp: new Date() },
        timestamp: new Date()
      } as ErrorResponse);
      return;
    }
  }
);

export default router;
