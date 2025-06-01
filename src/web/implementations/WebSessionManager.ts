import { ISessionManager, Message } from '../../shared/interfaces';
import { ChatSession, ChatMessage } from '../types/websocket';
import { v4 as uuidv4 } from 'uuid';

/**
 * Web-based session manager for managing chat sessions
 */
export class WebSessionManager implements ISessionManager {
  public sessionId: string = '';
  public conversationHistory: Message[] = [];

  public sessions: Map<string, ChatSession> = new Map();
  // sessionId and conversationHistory seem to be for a "primary" session,
  // while the manager handles multiple sessions in the `sessions` map.
  // This design might need review, but I'll stick to fixing current issues.

  constructor(sessionId?: string) {
    if (sessionId) {
      this.sessionId = sessionId;
      // If a session ID is provided at construction, try to load it or create it.
      if (!this.sessions.has(sessionId)) {
        this.startSession(sessionId);
      } else {
        const existingSession = this.sessions.get(sessionId);
        if (existingSession) {
          this.conversationHistory = this.convertChatMessagesToMessages(existingSession.messages);
        }
      }
    }
  }

  /**
   * Start or set a session as active
   */
  async startSession(sessionIdToStart?: string): Promise<void> {
    this.sessionId = sessionIdToStart || uuidv4();
    
    let session = this.sessions.get(this.sessionId);
    if (!session) {
      session = {
        id: this.sessionId,
        messages: [],
        createdAt: new Date(),
        lastActivity: new Date()
      };
      this.sessions.set(this.sessionId, session);
    }
    this.conversationHistory = this.convertChatMessagesToMessages(session.messages);
  }

  /**
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
  private convertChatMessageToMessage(chatMessage: ChatMessage): Message {
    return {
      role: chatMessage.role, // Assuming ChatMessage.role is compatible with Message.role
      content: chatMessage.content
    };
  }

  /**
   * Add message to a specific session
   */
  addMessage(sessionId: string, message: ChatMessage): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messages.push(message);
      session.lastActivity = new Date();

      // If this is the "active" session for this manager instance, update its history too
      if (this.sessionId === sessionId) {
        this.conversationHistory.push(this.convertChatMessageToMessage(message));
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
   * Create a new session, optionally with a specific ID
   */
  createSession(sessionIdToCreate?: string): ChatSession {
    const id = sessionIdToCreate || uuidv4();
    // Avoid overwriting if session with this ID already exists, unless intended.
    // For now, let's assume it creates if not exists, or returns existing if id is provided and found.
    // Or, more simply, always creates with the given ID or a new one.
    if (sessionIdToCreate && this.sessions.has(sessionIdToCreate)) {
        // This case needs clarification: error, return existing, or overwrite?
        // For now, let's assume we overwrite or it's an ID that's known not to exist.
        // Or, better, if an ID is provided, we expect to create THAT session.
    }

    const newSession: ChatSession = {
      id: id,
      messages: [],
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.sessions.set(id, newSession);
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

  /**
   * Get the count of active sessions
   */
  getActiveSessionCount(): number {
    return this.sessions.size;
  }
}
