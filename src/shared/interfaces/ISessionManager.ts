import { Message } from '../services/llm';

export type { Message };

/**
 * Interface for managing conversation sessions
 */
export interface ISessionManager {
  /**
   * Unique session identifier
   */
  sessionId: string;

  /**
   * Full conversation history
   */
  conversationHistory: Message[];

  /**
   * Start a new session
   * @param sessionId Optional custom session ID
   */
  startSession(sessionId?: string): Promise<void>;

  /**
   * End current session
   * @param save Whether to persist the session
   */
  endSession(save?: boolean): Promise<void>;

  /**
   * Save current conversation
   * @param path Optional custom save path
   */
  saveConversation(path?: string): Promise<void>;

  /**
   * Load conversation from storage
   * @param sessionId Session ID to load
   */
  loadConversation(sessionId: string): Promise<Message[]>;
}
