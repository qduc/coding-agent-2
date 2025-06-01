import { Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  ChatMessageEvent,
  SessionJoinEvent,
  SocketData
} from '../types/websocket';
import { SocketEvents, SocketRoomManager } from './events';
import { WebInputHandler, WebOutputHandler, WebSessionManager, WebToolExecutionContext } from '../implementations';
import { Agent } from '../../shared/core/agent';

/**
 * Handles WebSocket chat events and integrates with the shared Agent
 */
export class ChatHandler {
  private agent: Agent;
  private inputHandler: WebInputHandler;
  private outputHandler: WebOutputHandler;
  private sessionManager: WebSessionManager;
  private toolExecutionContext: WebToolExecutionContext;

  constructor(private socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>) {
    this.outputHandler = new WebOutputHandler(socket);
    this.inputHandler = new WebInputHandler(socket);
    this.sessionManager = new WebSessionManager();
    this.toolExecutionContext = new WebToolExecutionContext(this.outputHandler);

    this.agent = new Agent({
      inputHandler: this.inputHandler,
      toolContext: this.toolExecutionContext
    });

    this.setupEventHandlers();
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    this.socket.on(SocketEvents.CHAT_MESSAGE, this.handleChatMessage.bind(this));
    this.socket.on(SocketEvents.SESSION_JOIN, this.handleSessionJoin.bind(this));
    this.socket.on(SocketEvents.SESSION_LEAVE, this.handleSessionLeave.bind(this));
    this.socket.on(SocketEvents.DISCONNECT, this.handleDisconnect.bind(this));
  }

  /**
   * Handle incoming chat messages
   */
  private async handleChatMessage(data: ChatMessageEvent): Promise<void> {
    try {
      console.log(`Received message: ${data.content}`);

      // If session ID provided, ensure we're in the right session
      if (data.sessionId && data.sessionId !== this.sessionManager.sessionId) {
        await this.sessionManager.startSession(data.sessionId);
        this.socket.data.sessionId = data.sessionId;
      }

      // Initialize agent if not ready
      if (!this.agent.isReady()) {
        await this.agent.initialize();
      }

      // Process the message through the agent with streaming
      const response = await this.agent.processMessage(
        data.content,
        (chunk: string) => {
          // Stream response chunks to client
          this.outputHandler.streamContent(chunk, undefined, false);
        }
      );

      // Send final complete response
      this.outputHandler.streamContent('', undefined, true);

    } catch (error) {
      console.error('Error processing chat message:', error);
      this.socket.emit(SocketEvents.CHAT_ERROR, {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date()
      });
    }
  }

  /**
   * Handle session join requests
   */
  private async handleSessionJoin(data: SessionJoinEvent): Promise<void> {
    try {
      const { sessionId } = data;

      // Leave current room if in one
      if (this.socket.data.sessionId) {
        this.socket.leave(SocketRoomManager.getSessionRoom(this.socket.data.sessionId));
      }

      // Join new session room
      this.socket.join(SocketRoomManager.getSessionRoom(sessionId));
      this.socket.data.sessionId = sessionId;

      // Load or create session
      const existingSession = this.sessionManager.getSession(sessionId);
      if (existingSession) {
        await this.sessionManager.loadConversation(sessionId);
      } else {
        await this.sessionManager.startSession(sessionId);
      }

      // Notify client of successful join
      this.socket.emit(SocketEvents.SESSION_UPDATED, {
        session: this.sessionManager.getSession(sessionId)!
      });

      console.log(`Client joined session: ${sessionId}`);

    } catch (error) {
      console.error('Error joining session:', error);
      this.socket.emit(SocketEvents.CHAT_ERROR, {
        error: 'Failed to join session',
        timestamp: new Date()
      });
    }
  }

  /**
   * Handle session leave requests
   */
  private async handleSessionLeave(): Promise<void> {
    try {
      if (this.socket.data.sessionId) {
        this.socket.leave(SocketRoomManager.getSessionRoom(this.socket.data.sessionId));
        await this.sessionManager.endSession(true);
        this.socket.data.sessionId = undefined;
        console.log('Client left session');
      }
    } catch (error) {
      console.error('Error leaving session:', error);
    }
  }

  /**
   * Handle client disconnection
   */
  private async handleDisconnect(): Promise<void> {
    try {
      if (this.socket.data.sessionId) {
        await this.sessionManager.endSession(true);
        console.log(`Client disconnected from session: ${this.socket.data.sessionId}`);
      }
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  }

  /**
   * Get current session information
   */
  getCurrentSession() {
    return this.socket.data.sessionId ? this.sessionManager.getSession(this.socket.data.sessionId) : null;
  }
}
