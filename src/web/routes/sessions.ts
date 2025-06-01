import { Router } from 'express';
import { WebSessionManager } from '../implementations/WebSessionManager';
import { ApiResponse, SessionInfo, ChatSession, ChatMessage, ValidationError } from '../types/api';
import { validateRequest } from '../middleware/validation';
import { generalRateLimit } from '../middleware/rateLimiter';
import { paginate } from '../utils/pagination';
import { z } from 'zod';

const router = Router();
const sessionManager = new WebSessionManager();

// Session Management Endpoints
router.get('/api/sessions', async (req, res) => {
  try {
    const sessions = Array.from(sessionManager.sessions.values()).map(session => ({
      id: session.id,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      messageCount: session.messages.length
    } as SessionInfo));

    res.json({
      success: true,
      data: sessions,
      timestamp: new Date()
    } as ApiResponse<SessionInfo[]>);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SESSION_LIST_ERROR',
        message: 'Failed to list sessions',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      },
      timestamp: new Date()
    });
  }
});

router.post('/api/sessions', rateLimit('session-creation', 5, 60), async (req, res) => {
  try {
    const session = sessionManager.createSession();
    res.status(201).json({
      success: true,
      data: {
        id: session.id,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity
      },
      timestamp: new Date()
    } as ApiResponse<SessionInfo>);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SESSION_CREATION_ERROR',
        message: 'Failed to create session',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      },
      timestamp: new Date()
    });
  }
});

router.get('/api/sessions/:sessionId', validateRequest({ sessionId: 'string' }), async (req, res) => {
  try {
    const { sessionId } = req.params;
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

    res.json({
      success: true,
      data: {
        id: session.id,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        messageCount: session.messages.length
      },
      timestamp: new Date()
    } as ApiResponse<SessionInfo>);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SESSION_FETCH_ERROR',
        message: 'Failed to fetch session',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      },
      timestamp: new Date()
    });
  }
});

router.delete('/api/sessions/:sessionId', validateRequest({ sessionId: 'string' }), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const success = sessionManager.endSession(sessionId);

    if (!success) {
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

    res.json({
      success: true,
      data: { id: sessionId },
      timestamp: new Date()
    } as ApiResponse<{ id: string }>);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SESSION_DELETION_ERROR',
        message: 'Failed to delete session',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      },
      timestamp: new Date()
    });
  }
});

// History Management Endpoints
router.get('/api/sessions/:sessionId/history',
  validateRequest({ sessionId: 'string' }),
  paginate(),
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { page = 1, pageSize = 20 } = req.query;
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
      } as PaginationMetadata

      const messages = session.messages;
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
        error: {
          code: 'HISTORY_FETCH_ERROR',
          message: 'Failed to fetch history',
          details: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        },
        timestamp: new Date()
      });
    }
  }
);

router.post('/api/sessions/:sessionId/history',
  validateRequest({
    sessionId: 'string',
    content: 'string',
    role: ['user', 'assistant', 'system']
  }),
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { content, role } = req.body;

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

      const message: ChatMessage = {
        content,
        role,
        timestamp: new Date()
      };

      sessionManager.addMessage(sessionId, message);

      res.status(201).json({
        success: true,
        data: message,
        timestamp: new Date()
      } as ApiResponse<ChatMessage>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'MESSAGE_ADD_ERROR',
          message: 'Failed to add message',
          details: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        },
        timestamp: new Date()
      });
    }
  }
);

router.delete('/api/sessions/:sessionId/history',
  validateRequest({ sessionId: 'string' }),
  async (req, res) => {
    try {
      const { sessionId } = req.params;
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
          error: {
            code: 'SESSION_NOT_FOUND',
            message: 'Session not found',
            timestamp: new Date()
          },
          timestamp: new Date()
        });
      }

      const results = session.messages.filter(message =>
        message.content.toLowerCase().includes(query.toLowerCase())
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
        error: {
          code: 'HISTORY_SEARCH_ERROR',
          message: 'Failed to search history',
          details: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        },
        timestamp: new Date()
      });
    }
  }
);

export default router;
