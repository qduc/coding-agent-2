/**
 * WebSocket event types and interfaces for real-time communication
 */

export interface ChatMessage {
  id: string;
  content: string;
  timestamp: Date;
  role: 'user' | 'assistant' | 'system' | 'tool';
  toolExecutions?: ToolExecution[];
}

export interface ToolExecution {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  startTime: Date;
  endTime?: Date;
  input?: any;
  output?: any;
  error?: string;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  createdAt: Date;
  lastActivity: Date;
}

/**
 * WebSocket Events
 */
export interface ServerToClientEvents {
  'chat:response': (data: ChatResponseEvent) => void;
  'chat:tool_start': (data: ToolStartEvent) => void;
  'chat:tool_progress': (data: ToolProgressEvent) => void;
  'chat:tool_complete': (data: ToolCompleteEvent) => void;
  'chat:error': (data: ErrorEvent) => void;
  'session:updated': (data: SessionUpdateEvent) => void;
}

export interface ClientToServerEvents {
  'chat:message': (data: ChatMessageEvent) => void;
  'session:join': (data: SessionJoinEvent) => void;
  'session:leave': () => void;
}

export interface InterServerEvents {
  // Room-based events for scaling
}

export interface SocketData {
  sessionId?: string;
  userId?: string;
}

/**
 * Event Data Interfaces
 */
export interface ChatMessageEvent {
  content: string;
  sessionId?: string;
}

export interface ChatResponseEvent {
  messageId: string;
  content: string;
  isComplete: boolean;
  timestamp: Date;
}

export interface ToolStartEvent {
  messageId: string;
  toolId: string;
  toolName: string;
  input: any;
}

export interface ToolProgressEvent {
  messageId: string;
  toolId: string;
  progress: string;
}

export interface ToolCompleteEvent {
  messageId: string;
  toolId: string;
  output: any;
  success: boolean;
  error?: string;
}

export interface ErrorEvent {
  messageId?: string;
  error: string;
  timestamp: Date;
}

export interface SessionJoinEvent {
  sessionId: string;
}

export interface SessionUpdateEvent {
  session: ChatSession;
}
