import { Socket } from 'socket.io';
import { IInputHandler } from '../../shared/interfaces';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  ChatMessageEvent,
  SessionJoinEvent
} from '../types/websocket';
import { SocketEvents } from '../sockets/events';

/**
 * Web-based input handler using WebSocket communication
 */
export class WebInputHandler implements IInputHandler {
  constructor(private socket: Socket<ClientToServerEvents, ServerToClientEvents>) {}

  /**
   * Read input from WebSocket message (not applicable for web interface)
   * This method is primarily for compatibility with CLI interface
   */
  async readInput(prompt?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Input timeout'));
      }, 30000); // 30 second timeout

      this.socket.once(SocketEvents.CHAT_MESSAGE, (data: ChatMessageEvent) => {
        clearTimeout(timeout);
        resolve(data.content);
      });

      if (prompt) {
        this.socket.emit(SocketEvents.CHAT_RESPONSE, {
          messageId: `prompt_${Date.now()}`,
          content: prompt,
          isComplete: true,
          timestamp: new Date()
        });
      }
    });
  }

  /**
   * Read command from WebSocket (not applicable for web interface)
   * Web interface uses direct message handling instead
   */
  async readCommand(): Promise<{command: string; args: string[]}> {
    const input = await this.readInput();
    const parts = input.trim().split(/\s+/);
    return {
      command: parts[0] || '',
      args: parts.slice(1)
    };
  }

  /**
   * Handle interactive mode through WebSocket events
   */
  async handleInteractiveMode(
    onInput: (input: string) => Promise<void>,
    onEnd: () => void
  ): Promise<void> {
    this.socket.on(SocketEvents.CHAT_MESSAGE, async (data: ChatMessageEvent) => {
      try {
        await onInput(data.content);
      } catch (error) {
        console.error('Error handling input:', error);
        this.socket.emit(SocketEvents.CHAT_ERROR, {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        });
      }
    });

    this.socket.on(SocketEvents.SESSION_LEAVE, () => {
      onEnd();
    });

    this.socket.on(SocketEvents.DISCONNECT, () => {
      onEnd();
    });
  }
}
