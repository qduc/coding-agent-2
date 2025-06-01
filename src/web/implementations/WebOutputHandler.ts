import { Socket } from 'socket.io';
import { IOutputHandler, OutputStyle } from '../../shared/interfaces';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  ChatResponseEvent,
  ErrorEvent
} from '../types/websocket';
import { SocketEvents } from '../sockets/events';

/**
 * Web-based output handler using WebSocket communication
 */
export class WebOutputHandler implements IOutputHandler {
  private messageIdCounter = 0;

  constructor(private socket: Socket<ClientToServerEvents, ServerToClientEvents>) {}

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${++this.messageIdCounter}`;
  }

  /**
   * Write standard output through WebSocket
   */
  writeOutput(content: string, style?: OutputStyle): void {
    const responseEvent: ChatResponseEvent = {
      messageId: this.generateMessageId(),
      content,
      isComplete: true,
      timestamp: new Date()
    };

    this.socket.emit(SocketEvents.CHAT_RESPONSE, responseEvent);
  }

  /**
   * Write error output through WebSocket
   */
  writeError(error: string | Error, details?: Record<string, unknown>): void {
    const errorMessage = error instanceof Error ? error.message : error;

    const errorEvent: ErrorEvent = {
      messageId: this.generateMessageId(),
      error: errorMessage,
      timestamp: new Date()
    };

    this.socket.emit(SocketEvents.CHAT_ERROR, errorEvent);
  }

  /**
   * Write success message through WebSocket
   */
  writeSuccess(message: string): void {
    this.writeOutput(`✅ ${message}`, { color: 'success' });
  }

  /**
   * Render and output markdown content through WebSocket
   */
  writeMarkdown(markdown: string): void {
    this.writeOutput(markdown);
  }

  /**
   * Stream content in chunks (useful for LLM streaming responses)
   */
  streamContent(content: string, messageId?: string, isComplete: boolean = false): void {
    const responseEvent: ChatResponseEvent = {
      messageId: messageId || this.generateMessageId(),
      content,
      isComplete,
      timestamp: new Date()
    };

    this.socket.emit(SocketEvents.CHAT_RESPONSE, responseEvent);
  }

  /**
   * Send tool execution status updates
   */
  sendToolStatus(toolName: string, status: 'start' | 'progress' | 'complete', data?: any): void {
    const messageId = this.generateMessageId();

    switch (status) {
      case 'start':
        this.socket.emit(SocketEvents.TOOL_START, {
          messageId,
          toolId: `tool_${Date.now()}`,
          toolName,
          input: data
        });
        break;
      case 'progress':
        this.socket.emit(SocketEvents.TOOL_PROGRESS, {
          messageId,
          toolId: `tool_${Date.now()}`,
          progress: data || 'Processing...'
        });
        break;
      case 'complete':
        this.socket.emit(SocketEvents.TOOL_COMPLETE, {
          messageId,
          toolId: `tool_${Date.now()}`,
          output: data,
          success: true
        });
        break;
    }
  }
}
