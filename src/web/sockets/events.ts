/**
 * WebSocket event constants and helpers
 */

export const SocketEvents = {
  // Client to Server
  CHAT_MESSAGE: 'chat:message',
  SESSION_JOIN: 'session:join',
  SESSION_LEAVE: 'session:leave',

  // Server to Client
  CHAT_RESPONSE: 'chat:response',
  TOOL_START: 'chat:tool_start',
  TOOL_PROGRESS: 'chat:tool_progress',
  TOOL_COMPLETE: 'chat:tool_complete',
  CHAT_ERROR: 'chat:error',
  SESSION_UPDATED: 'session:updated',

  // Connection events
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
} as const;

export type SocketEventType = typeof SocketEvents[keyof typeof SocketEvents];

/**
 * Socket room management helpers
 */
export class SocketRoomManager {
  private static readonly SESSION_PREFIX = 'session:';

  static getSessionRoom(sessionId: string): string {
    return `${this.SESSION_PREFIX}${sessionId}`;
  }

  static extractSessionId(room: string): string | null {
    if (room.startsWith(this.SESSION_PREFIX)) {
      return room.substring(this.SESSION_PREFIX.length);
    }
    return null;
  }
}
