import { ISessionManager, Message } from '../../shared/interfaces';
import { ChatSession, ChatMessage } from '../types/websocket';
import { v4 as uuidv4 } from 'uuid';

/**
 * Web-based session manager for managing chat sessions
 */
export class WebSessionManager implements ISessionManager {
  public sessionId: string = '';
  public conversationHistory: Message[] = [];

  private sessions: Map<string, ChatSession> = new Map();

  constructor(sessionId?: string) {
    if (sessionId) {
      this.sessionId = sessionId;
    }
  }

  /**
   * Start a new session
   */
  async startSession(sessionId?: string): Promise<void> {
    this.sessionId = sessionId || uuidv4();
    this.conversationHistory = [];

    const newSession: ChatSession = {
      id: this.sessionId,
      messages: [],
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.sessions.set(this.sessionId, newSession);
  }

  /**
   * End current session
   */
  async endSession(save: boolean = true): Promise<void> {
    if (save && this.sessionId) {
      await this.saveConversation();
    }

    this.conversationHistory = [];
    this.sessionId = '';
  }

  /**
   * Save current conversation
   */
  async saveConversation(path?: string): Promise<void> {
    if (!this.sessionId) {
      throw new Error('No active session to save');
    }

    const session = this.sessions.get(this.sessionId);
    if (session) {
      session.lastActivity = new Date();
      // TODO: Implement persistent storage (file system, database, etc.)
      console.log(`Session ${this.sessionId} saved with ${this.conversationHistory.length} messages`);
    }
  }

  /**
   * Load conversation from storage
   */
  async loadConversation(sessionId: string): Promise<Message[]> {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessionId = sessionId;
      this.conversationHistory = this.convertChatMessagesToMessages(session.messages);
      return this.conversationHistory;
    }

    // TODO: Load from persistent storage
    return [];
  }

  /**
   * Add message to current session
   */
  addMessage(message: Message): void {
    this.conversationHistory.push(message);

    if (this.sessionId) {
      const session = this.sessions.get(this.sessionId);
      if (session) {
        const chatMessage: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          content: message.content || '',
          timestamp: new Date(),
          role: message.role as 'user' | 'assistant'
        };

        session.messages.push(chatMessage);
        session.lastActivity = new Date();
      }
    }
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): ChatSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Remove session
   */
  removeSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Create a new session
   */
  createSession(): ChatSession {
    const sessionId = uuidv4();
    const newSession: ChatSession = {
      id: sessionId,
      messages: [],
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.sessions.set(sessionId, newSession);
    return newSession;
  }

  /**
   * End session by ID (overloaded version that takes sessionId)
   * @param sessionId The ID of the session to end
   */
  terminateSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Clear history for a session
   */
  clearHistory(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messages = [];
      session.lastActivity = new Date();
      return true;
    }
    return false;
  }

  /**
   * Convert ChatMessage[] to Message[] format
   */
  private convertChatMessagesToMessages(chatMessages: ChatMessage[]): Message[] {
    return chatMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId: string): { messageCount: number; duration: number } | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return {
      messageCount: session.messages.length,
      duration: session.lastActivity.getTime() - session.createdAt.getTime()
    };
  }
}
