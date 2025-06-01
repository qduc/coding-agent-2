export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  status?: 'streaming' | 'error' | 'completed';
}

export interface ToolExecution {
  id: string;
  toolName: string;
  input?: any;
  output?: string;
  error?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  duration?: number;
  timestamp: string;
}
